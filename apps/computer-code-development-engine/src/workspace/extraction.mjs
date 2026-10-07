/**
 * Extracting a directory of the house repository into a repository of its own, composed back at the
 * same path as a submodule. Software with its own lifecycle lives in its own repository; the house
 * repository is the superproject that composes it, so every path that names it keeps resolving.
 *
 * The history is rewritten in a shared clone: every commit that touched any path the directory has
 * had, with the directory at the root. Commits that land under the directory while the rewrite runs
 * are carried over as patches. The directory then becomes the submodule in place: its index is read
 * from the extracted commit and no file is moved, so an edit another writer has not committed stays
 * an edit, now inside the submodule. What the superproject ignored there is ignored by the new
 * repository's own `.gitignore`. The change to the superproject is committed by its exact paths;
 * landing it on origin/main is the caller's.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { executeJavascriptNodeCommandAsynchronously } from "@red-cup-engineering/execute-javascript-node-command-service/asynchronously";
import { gitCommand, gitExtractionPlan, gitSubmodulePlan, gitWorktreePlan, splitNullOutput } from "@red-cup-engineering/git-services-section/git-command-codec";

import { runStep } from "./worktree.mjs";

const REWRITE_POLICY = Object.freeze({ timeoutMilliseconds: 3_600_000, outputLimit: 64 * 1024 * 1024 });

const step = (runner, plan, cwd) => runStep(runner, plan, cwd, REWRITE_POLICY);
const output = async (runner, plan, cwd) => (await step(runner, plan, cwd)).stdout;

/** Every directory `directory` has been, newest first, read off the renames of its tracked files. */
async function historicDirectories({ repository, directory, runner }) {
  const files = splitNullOutput(await output(runner, gitWorktreePlan.trackedFiles(directory), repository));
  const probe = files.find((file) => file === `${directory}/package.json`) ?? files.find((file) => file === `${directory}/README.md`) ?? files[0];
  if (!probe) throw new Error(`extraction: no Git-tracked files under ${directory}`);
  const relative = probe.slice(directory.length);
  const names = splitNullOutput(await output(runner, gitExtractionPlan.names(probe), repository));
  return [...new Set([directory, ...names.filter((name) => name.endsWith(relative)).map((name) => name.slice(0, -relative.length))])];
}

/** Rewrite a shared clone of `repository` to the history of `directories`, then carry over whatever
 *  landed under `directory` after `base`, until the rewrite's tree is the directory's tree at HEAD. */
async function rewrite({ repository, directory, directories, base, clone, runner }) {
  await step(runner, gitExtractionPlan.cloneShared(repository, clone), repository);
  await step(runner, gitExtractionPlan.rewriteTo(directories), clone);
  await step(runner, gitExtractionPlan.checkout("main"), clone);
  for (let from = base; ;) {
    const tree = (await output(runner, gitExtractionPlan.tree("HEAD"), clone)).trim();
    const head = (await output(runner, gitExtractionPlan.head(), repository)).trim();
    const wanted = (await output(runner, gitExtractionPlan.tree(head, directory), repository)).trim();
    if (tree === wanted) return (await output(runner, gitExtractionPlan.head(), clone)).trim();
    if (head === from) throw new Error(`extraction: the rewritten tree ${tree} is not ${directory} at ${head} (${wanted})`);
    const patches = await output(runner, gitExtractionPlan.patchesSince(from, directory), repository);
    if (patches.length > 0) await step(runner, gitExtractionPlan.applyPatches(patches), clone);
    from = head;
  }
}

/** Extract `directory` of the checkout `repository` to `url` (an existing, empty repository) and
 *  compose it back as the submodule `name` at the same path, committed by its exact paths. */
export async function extractSubmodule({ repository, directory, name, url, message, runner = executeJavascriptNodeCommandAsynchronously }) {
  if (existsSync(path.join(repository, ".git", "modules", name))) throw new Error(`extraction: the superproject already holds a submodule repository named ${name}`);
  const base = (await output(runner, gitExtractionPlan.head(), repository)).trim();
  const directories = await historicDirectories({ repository, directory, runner });
  const ignored = splitNullOutput(await output(runner, gitExtractionPlan.ignored(directory), repository))
    .filter((entry) => entry.startsWith("!! "))
    .map((entry) => entry.slice(3).slice(directory.length + 1));
  const scratch = mkdtempSync(path.join(tmpdir(), `extract-${name}-`));
  try {
    const extracted = await rewrite({ repository, directory, directories, base, clone: path.join(scratch, name), runner });
    await step(runner, gitExtractionPlan.pushMain(url), path.join(scratch, name));

    const submodule = path.join(repository, directory);
    await step(runner, gitExtractionPlan.init(), submodule);
    await step(runner, gitExtractionPlan.addOrigin(url), submodule);
    await step(runner, gitExtractionPlan.fetchMain(), submodule);
    await step(runner, gitCommand(["update-ref", "refs/heads/main", extracted]), submodule);
    await step(runner, gitExtractionPlan.adopt(extracted), submodule);
    await step(runner, gitExtractionPlan.track(), submodule);

    // What the superproject ignored inside the directory is ignored by the new repository itself.
    const status = splitNullOutput(await output(runner, gitCommand(["status", "--porcelain=v1", "-z", "--untracked-files=normal"]), submodule));
    const untracked = new Set(status.filter((entry) => entry.startsWith("?? ")).map((entry) => entry.slice(3)));
    const ignore = ignored.filter((entry) => untracked.has(entry));
    if (ignore.length > 0) {
      const file = path.join(submodule, ".gitignore");
      const kept = existsSync(file) ? readFileSync(file, "utf8") : "";
      writeFileSync(file, `${kept}${kept === "" || kept.endsWith("\n") ? "" : "\n"}${ignore.map((entry) => `/${entry}`).join("\n")}\n`);
      await step(runner, gitCommand(["add", "--", ".gitignore"]), submodule);
      await step(runner, gitCommand(["commit", "--quiet", "--only", "--file=-", "--", ".gitignore"], { input: "Ignore what the superproject ignored here\n" }), submodule);
      await step(runner, gitExtractionPlan.pushMain(url), submodule);
      // origin/main is read again, so the superproject's push finds the gitlink's commit on a remote.
      await step(runner, gitExtractionPlan.fetchMain(), submodule);
    }

    await step(runner, gitExtractionPlan.untrack(directory), repository);
    await step(runner, gitSubmodulePlan.add(url, directory, name), repository);
    await step(runner, gitSubmodulePlan.absorb(directory), repository);
    await step(runner, gitCommand(["config", "--file", ".gitmodules", `submodule.${name}.branch`, "main"]), repository);
    await step(runner, gitCommand(["commit", "--quiet", "--file=-", "--", ".gitmodules", directory], { input: `${message}\n` }), repository);
    return {
      directory,
      name,
      url,
      directories,
      extracted,
      composed: (await output(runner, gitExtractionPlan.tree("HEAD", directory), repository)).trim(),
      commit: (await output(runner, gitExtractionPlan.head(), repository)).trim(),
      ignored: ignore,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

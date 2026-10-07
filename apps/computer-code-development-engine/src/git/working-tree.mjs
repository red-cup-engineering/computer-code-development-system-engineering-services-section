/**
 * git/working-tree — the working tree a program writes, and the custody it holds there.
 *
 * A program that retains records in the repository (a campaign's receipts, a persona's turn, a
 * census, a channel's production state) runs from released bytes when the node runs it as a job,
 * and a release tree is not a checkout. So the node names the tree: its declared working tree
 * (NODE_JOB_WORKING_TREE) and the repository paths the job holds there (NODE_JOB_CUSTODY, a JSON
 * array, from the job's `workingTree.custody` in its declaration under deploy/jobs/, which no other job of the
 * deployment overlaps). Outside a node job, a person at a checkout, the working tree is the
 * checkout enclosing the program and its custody is unbounded.
 *
 * Either way the program reads and writes its data at `here`: its own directory as that path stands
 * in the working tree. It commits through `retain`, which refuses a path outside its custody and
 * commits the rest by exact path (commitGitPaths), into the working tree or a repository nested in
 * it (a submodule). This replaces each program's own `git rev-parse --show-toplevel` beside its
 * source, which found no repository in a release tree.
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commitGitPaths } from "./operations.mjs";

// A release tree's root holds its release receipt (node-runtime-release-promotion-service).
const RELEASE_RECEIPT = "release-receipt.json";

const toplevelOf = (directory) => {
  try {
    return realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch {
    return undefined;
  }
};

function releaseRootOf(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    if (existsSync(path.join(current, RELEASE_RECEIPT))) return current;
    if (path.dirname(current) === current) return undefined;
  }
}

const posix = (file) => file.split(path.sep).join("/");

function custodyOf(text) {
  if (text === undefined || text === "") return null;
  const custody = JSON.parse(text);
  if (!Array.isArray(custody) || custody.some((entry) => typeof entry !== "string" || entry === "" || path.isAbsolute(entry) || path.normalize(entry).startsWith(".."))) {
    throw new TypeError("working tree: NODE_JOB_CUSTODY must be a JSON array of repository-relative paths");
  }
  return Object.freeze(custody.map((entry) => posix(path.normalize(entry)).replace(/\/+$/, "")));
}

/**
 * The working tree the program at `moduleUrl` writes: { root, here, custody, holds(file), retain }.
 * `root` is the working tree, `here` the module's directory there, `custody` the repository paths
 * it holds (null when unbounded). `retain({ paths, message, repository?, push? })` commits exact
 * paths, relative to `repository` (the working tree unless a repository nested in it is named), and
 * returns { repository, committed, pushed, obstructions? }.
 * @param {string | URL} moduleUrl the program's own `import.meta.url`
 */
export function workingTreeOf(moduleUrl, { environment = process.env } = {}) {
  const directory = path.dirname(realpathSync(fileURLToPath(moduleUrl)));
  const releaseRoot = releaseRootOf(directory);
  const sourceRoot = releaseRoot ?? toplevelOf(directory);
  const named = environment.NODE_JOB_WORKING_TREE?.trim() || undefined;
  if (named === undefined && releaseRoot !== undefined) {
    throw new TypeError(`working tree: ${directory} is a release, not a checkout; run it as a node job that holds working-tree custody`);
  }
  const root = named === undefined ? sourceRoot : realpathSync(named);
  if (root === undefined) throw new TypeError(`working tree: ${directory} is in no checkout and no node job names a working tree`);
  const here = path.join(root, path.relative(sourceRoot, directory));
  const custody = named === undefined ? null : custodyOf(environment.NODE_JOB_CUSTODY);
  const holds = (file) => {
    const relative = posix(path.relative(root, path.resolve(root, file)));
    if (relative.startsWith("../") || relative === "..") return false;
    return custody === null || custody.some((held) => relative === held || relative.startsWith(`${held}/`));
  };
  const retain = ({ paths, message, repository = root, push = true }) => {
    const nested = path.resolve(root, repository);
    const files = [...new Set(paths.map((file) => posix(path.isAbsolute(file) ? path.relative(nested, file) : file)))];
    const outside = files.filter((file) => !holds(path.join(nested, file)));
    if (outside.length > 0) return Object.freeze({ repository: nested, committed: false, pushed: false, obstructions: Object.freeze(outside.map((file) => `outside-custody:${file}`)) });
    if (files.length === 0) return Object.freeze({ repository: nested, committed: false, pushed: false });
    const result = commitGitPaths({ packageRoot: nested }, { paths: files, message, push });
    return Object.freeze({
      repository: nested,
      committed: result.created ? result.head : false,
      pushed: result.ok,
      ...(result.obstructions?.length ? { obstructions: result.obstructions } : {}),
    });
  };
  return Object.freeze({ root, here, custody, holds, retain });
}

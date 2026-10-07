/**
 * The code-development engine's one Git worktree lifecycle. Every worker that changes the house
 * repository away from the shared checkout works in a linked worktree of its own: a Codex task's
 * slot, a delegated duty's worktree, a transaction's ephemeral one. The worktree is prepared from
 * origin/main, the worker's change is committed on its branch, and the branch either joins
 * origin/main itself (integrate) or is published for a receiver to join (publish). Git arguments
 * come from git-services-section's command codec; the house command executor runs them, never
 * blocking the node.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, chmodSync, lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { executeJavascriptNodeCommandAsynchronously } from "@red-cup-engineering/execute-javascript-node-command-service/asynchronously";
import { gitCommitPathsPlan, gitWorktreePlan, readNameStatus, readOid } from "@red-cup-engineering/git-services-section/git-command-codec";
import { composed, parseGitmodules } from "@red-cup-engineering/git-services-section/gitmodules";
import { nodeFirstEnvironment } from "@red-cup-engineering/node-process-services-section/environment";
import { candidateNameOk, nameCandidateSync } from "../git/github-candidate.mjs";

const ORIGIN_MAIN = "refs/remotes/origin/main";
const STEP_POLICY = Object.freeze({ timeoutMilliseconds: 600_000, outputLimit: 8 * 1024 * 1024 });

/** The pnpm a worktree installs with: the user-local Linux pnpm, never one found first on PATH. */
export const WORKTREE_PNPM = path.join(homedir(), ".local", "bin", "pnpm");

const plan = (command, arguments_) => Object.freeze({ command, arguments: Object.freeze(arguments_), environment: Object.freeze({}), input: null, ok: Object.freeze([0]) });

/** One planned step, a codec's { command, arguments, environment, input }, as the exact command
 *  request that runs it in `directory` on the node's environment, its own Node.js first on PATH. */
export function stepRequest(step, directory) {
  return Object.freeze({ type: "JavascriptNodeCommandExecutionRequest", version: 1, command: step.command, arguments: [...step.arguments], directory: path.resolve(directory), environment: { ...nodeFirstEnvironment(), ...step.environment }, input: step.input });
}

/** Run one planned step in `directory` through `runner`, a command executor (request, policy) ->
 *  receipt: resolves its result, or throws when its exit status is not one the step accepts. */
export async function runStep(runner, step, directory, policy = STEP_POLICY) {
  const { result } = await runner(stepRequest(step, directory), policy);
  if (!step.ok.includes(result.status)) throw new Error(`${step.command} ${step.arguments.join(" ")} failed: ${(result.stderr || result.stdout || result.error).trim()}`);
  return result;
}

const lanes = new Map();
/** Run `effect` after every effect already queued under `key` has settled, whatever its outcome:
 *  one at a time per key on this node, different keys concurrently. */
export function serially(key, effect) {
  const result = (lanes.get(key) ?? Promise.resolve()).then(effect, effect);
  const settled = result.then(() => undefined, () => undefined);
  lanes.set(key, settled);
  settled.then(() => { if (lanes.get(key) === settled) lanes.delete(key); });
  return result;
}

/** The repositories the worktree's checked-out commit composes: the paths of its submodules that
 *  are part of its composition. */
export function composedSubmodules({ workspace }) {
  const file = path.join(workspace, ".gitmodules");
  return existsSync(file) ? parseGitmodules(readFileSync(file, "utf8")).filter(composed).map((entry) => entry.path) : [];
}

/** The submodules the worker's change moved: checked out at a commit that is neither the one
 *  `commit` records nor behind it. One left behind when main moved its gitlink on is not moved, and
 *  recording it would take main back. */
async function movedSubmodules({ workspace, submodules, commit = "HEAD", runner }) {
  const moved = [];
  for (const submodule of submodules) {
    const directory = path.join(workspace, submodule);
    const recorded = await runStep(runner, gitWorktreePlan.gitlink(commit, submodule), workspace);
    if (recorded.status !== 0) { moved.push(submodule); continue; }
    const gitlink = readOid(recorded.stdout);
    const head = await worktreeHead({ workspace: directory, runner });
    if (gitlink === head) continue;
    let behind = await runStep(runner, gitWorktreePlan.isAncestor(head, gitlink), directory);
    if (behind.status !== 0 && behind.status !== 1) {
      await runStep(runner, gitWorktreePlan.fetchMain(), directory);
      behind = await runStep(runner, gitWorktreePlan.isAncestor(head, gitlink), directory);
    }
    if (behind.status !== 0) moved.push(submodule);
  }
  return moved;
}

// The superproject's last commit of a change records the submodules it moved, and only that one,
// so a rebase never meets a gitlink: integration takes it off, joins each submodule to its own
// main, and records them again on top.
const COMPOSE_MESSAGE = "Compose the submodules this change moved at their new commits";

async function compose({ workspace, submodules, runner }) {
  const moved = await movedSubmodules({ workspace, submodules, runner });
  if (moved.length === 0) return;
  await runStep(runner, gitWorktreePlan.addSubmodules(moved), workspace);
  await runStep(runner, gitWorktreePlan.commit([COMPOSE_MESSAGE, moved.join("\n")]), workspace);
}

async function decompose({ workspace, runner }) {
  const head = await worktreeHead({ workspace, runner });
  const message = (await runStep(runner, gitCommitPathsPlan.commitMessage(head), workspace)).stdout;
  if (message.startsWith(`${COMPOSE_MESSAGE}\n`)) await runStep(runner, gitWorktreePlan.resetKeep(`${head}~1`), workspace);
}

/** Join each submodule the change moved to its own origin/main: rebase its commits onto it and
 *  push. Resolves the submodule that would not join, or undefined when all of them did. */
async function integrateSubmodules({ workspace, submodules, runner }) {
  for (const submodule of submodules) {
    const directory = path.join(workspace, submodule);
    await runStep(runner, gitWorktreePlan.fetchMain(), directory);
    const head = await worktreeHead({ workspace: directory, runner });
    if ((await runStep(runner, gitWorktreePlan.isAncestor(head, ORIGIN_MAIN), directory)).status === 0) continue;
    if ((await runStep(runner, gitWorktreePlan.rebase(ORIGIN_MAIN), directory)).status !== 0) {
      await runStep(runner, gitWorktreePlan.rebaseAbort(), directory);
      return submodule;
    }
    nameCandidateSync({ repository: directory, name: `node/submodule-${head.slice(0,12)}`, commit: await worktreeHead({workspace:directory,runner}), sourceBase: readOid((await runStep(runner,gitCommitPathsPlan.remoteMain(),directory)).stdout) });
    return submodule; // Its owning PR must merge before the parent can pin it.
  }
  return undefined;
}

// Package linking may chmod tracked bin sources. Linking is not a source change:
// preserve their exact pre-link bytes/modes while pnpm's generated executable shims survive.
async function binSourceModes(workspace, runner) {
  const packages = await runStep(runner, plan("git", ["ls-files", "-z", "--", "package.json", "**/package.json"]), workspace);
  const candidates = [];
  for (const file of packages.stdout.split("\0").filter(Boolean)) {
    const declaration = JSON.parse(readFileSync(path.join(workspace, file), "utf8"));
    const bins = typeof declaration.bin === "string" ? [declaration.bin] : Object.values(declaration.bin ?? {});
    for (const bin of bins) {
      if (typeof bin !== "string") continue;
      const target = path.resolve(workspace, path.dirname(file), bin);
      if (!target.startsWith(path.resolve(workspace) + path.sep) || !existsSync(target)) continue;
      if (!lstatSync(target).isFile() || !realpathSync(target).startsWith(realpathSync(workspace) + path.sep)) continue;
      candidates.push(path.relative(workspace, target));
    }
  }
  if (candidates.length === 0) return [];
  const tracked = await runStep(runner, plan("git", ["ls-files", "-z", "--", ...new Set(candidates)]), workspace);
  return tracked.stdout.split("\0").filter(Boolean).map(file => {
    const target = path.join(workspace, file);
    return { target, bytes: readFileSync(target), mode: statSync(target).mode & 0o777 };
  });
}

function retainBinSources(sources) {
  for (const { target, bytes, mode } of sources) {
    if (!lstatSync(target).isFile()) throw new TypeError("package linking replaced tracked bin source type: " + target);
    if (!readFileSync(target).equals(bytes)) throw new TypeError("package linking changed tracked bin source bytes: " + target);
    if ((statSync(target).mode & 0o777) !== mode) chmodSync(target, mode);
  }
}

/** Fetch origin/main into `repository` and reset the worktree at `workspace` to `branch` at `from`
 *  (origin/main unless named), adding the worktree when it is missing, with every repository it
 *  composes checked out at the commit its gitlink records; then link its packages offline from the
 *  store. Preparation
 *  fetches into the repository and writes its worktree registry, so it runs one at a time per repository. */
export function prepareWorktree({ repository, workspace, branch, from = ORIGIN_MAIN, install = true, runner = executeJavascriptNodeCommandAsynchronously }) {
  return serially(`repository:${path.resolve(repository)}`, async () => {
    mkdirSync(path.dirname(workspace), { recursive: true, mode: 0o700 });
    await runStep(runner, gitWorktreePlan.fetchMain(), repository);
    if (!existsSync(workspace)) await runStep(runner, gitWorktreePlan.add(workspace, from), repository);
    await runStep(runner, gitWorktreePlan.resetBranch(branch, from), workspace);
    // Resuming the branch preserves its original before-source; a fresh preparation declares it.
    if (from !== branch) await runStep(runner, gitWorktreePlan.recordSourceBase(branch, await worktreeHead({ workspace, runner })), repository);
    await runStep(runner, gitWorktreePlan.clean(), workspace);
    const submodules = composedSubmodules({ workspace });
    if (submodules.length > 0) await runStep(runner, gitWorktreePlan.updateSubmodules(submodules), workspace);
    for (const submodule of submodules) await runStep(runner, gitWorktreePlan.clean(), path.join(workspace, submodule));
    // A worktree holds code nobody has reviewed yet, so linking it runs none of it: no lifecycle
    // scripts, no pnpmfile hooks.
    if (install) {
      const sources = (await Promise.all([workspace, ...submodules.map(file => path.join(workspace, file))].map(root => binSourceModes(root, runner)))).flat();
      try { await runStep(runner, plan(WORKTREE_PNPM, ["install", "--frozen-lockfile", "--offline", "--ignore-scripts", "--ignore-pnpmfile"]), workspace); }
      finally { retainBinSources(sources); }
    }
    return Object.freeze({ workspace, branch });
  });
}

/** The commit local `branch` of `repository` names, or undefined when there is no such branch. */
export async function branchHead({ repository, branch, runner = executeJavascriptNodeCommandAsynchronously }) {
  const result = await runStep(runner, gitWorktreePlan.branchHead(branch), repository);
  return result.status === 0 ? readOid(result.stdout) : undefined;
}

/** The commit the worktree has checked out. */
export async function worktreeHead({ workspace, runner = executeJavascriptNodeCommandAsynchronously }) {
  return readOid((await runStep(runner, gitWorktreePlan.head(), workspace)).stdout);
}

/** Whether the worktree holds anything uncommitted or untracked (the superproject only). */
export async function worktreeDirty({ workspace, runner = executeJavascriptNodeCommandAsynchronously }) {
  return (await runStep(runner, gitWorktreePlan.status(), workspace)).stdout !== "";
}

/** What `branch` changes against origin/main, as { status, path } rows. */
export async function worktreeChanges({ workspace, branch, runner = executeJavascriptNodeCommandAsynchronously }) {
  return readNameStatus((await runStep(runner, gitWorktreePlan.changes(ORIGIN_MAIN, branch), workspace)).stdout);
}

/** Commit everything the worker left in the worktree, one message paragraph per entry of `message`:
 *  in each repository it composes first, then in the superproject, whose last commit records the
 *  submodules it moved. Resolves the new commit, or undefined when the worktree is clean. */
export async function commitWorktree({ workspace, message, runner = executeJavascriptNodeCommandAsynchronously }) {
  if ((await runStep(runner, gitWorktreePlan.status(), workspace)).stdout === "") return undefined;
  const submodules = composedSubmodules({ workspace });
  for (const submodule of submodules) {
    const directory = path.join(workspace, submodule);
    if ((await runStep(runner, gitWorktreePlan.status(), directory)).stdout === "") continue;
    await runStep(runner, gitWorktreePlan.addAll(), directory);
    await runStep(runner, gitWorktreePlan.commit(message), directory);
  }
  await runStep(runner, gitWorktreePlan.addOwn(submodules), workspace);
  if ((await runStep(runner, gitWorktreePlan.staged(), workspace)).status !== 0) await runStep(runner, gitWorktreePlan.commit(message), workspace);
  await compose({ workspace, submodules, runner });
  return worktreeHead({ workspace, runner });
}

/** Publish the worktree's HEAD as `branch` on origin, replacing what that branch held; each
 *  submodule commit it records that its own origin/main lacks goes first to the same branch there. */
export async function publishWorktreeBranch({ workspace, branch, runner = executeJavascriptNodeCommandAsynchronously }) {
  for (const submodule of composedSubmodules({ workspace })) {
    const directory = path.join(workspace, submodule);
    const recorded = await runStep(runner, gitWorktreePlan.gitlink("HEAD", submodule), workspace);
    if (recorded.status !== 0) continue;
    const commit = readOid(recorded.stdout);
    await runStep(runner, gitWorktreePlan.fetchMain(), directory);
    if ((await runStep(runner, gitWorktreePlan.isAncestor(commit, ORIGIN_MAIN), directory)).status !== 0) await runStep(runner, gitWorktreePlan.pushCommit(commit, branch), directory);
  }
  await runStep(runner, gitWorktreePlan.pushBranch(branch), workspace);
  return Object.freeze({ branch, head: await worktreeHead({ workspace, runner }) });
}

const CONFLICT_MARKER = /^(?:<{7}|>{7})(?: |$)|^={7}$/mu;

/** Replay the worktree's change since origin/main as one uncommitted change on top of origin/main,
 *  for `branch`. Resolves the paths left conflicted, with their markers in the worktree. */
async function replayOntoMain({ workspace, branch, head, runner }) {
  await runStep(runner, gitWorktreePlan.resetBranch(branch, ORIGIN_MAIN), workspace);
  await runStep(runner, gitWorktreePlan.squashMerge(head), workspace);
  return (await runStep(runner, gitWorktreePlan.unmergedPaths(), workspace)).stdout.split("\0").filter(Boolean);
}

/** One replay of the worktree's change onto origin/main, handed to `resolve` when it conflicts and
 *  committed when it comes back free of markers. */
async function replayResolved({ workspace, branch, resolve, runner }) {
  const head = await worktreeHead({ workspace, runner });
  const base = readOid((await runStep(runner, gitCommitPathsPlan.mergeBase(head, ORIGIN_MAIN), workspace)).stdout);
  const message = (await runStep(runner, gitWorktreePlan.messages(base, head), workspace)).stdout.trim();
  const conflicts = await replayOntoMain({ workspace, branch, head, runner });
  // Replayed whole, a change can join cleanly where its commits one by one did not.
  let resolved = conflicts.length === 0;
  if (!resolved) try { resolved = await resolve({ workspace, conflicts, head }) === true; } catch { resolved = false; }
  const marked = conflicts.filter((file) => {
    try { return CONFLICT_MARKER.test(readFileSync(path.join(workspace, file), "utf8")); } catch { return false; }
  });
  const record = Object.freeze({ from: head, conflicts: Object.freeze(conflicts), resolved: resolved && marked.length === 0 });
  if (!record.resolved) return { record };
  await runStep(runner, gitWorktreePlan.addOwn(composedSubmodules({ workspace })), workspace);
  // Resolved to nothing: main already holds what the change meant.
  if ((await runStep(runner, gitWorktreePlan.staged(), workspace)).status === 0) return { record, absorbed: true };
  await runStep(runner, gitWorktreePlan.commit([message, `Replayed from ${head} onto origin/main; ${conflicts.length === 0 ? "without conflicts" : `conflicts resolved by the worker: ${conflicts.join(", ")}`}`]), workspace);
  return { record };
}

/** The candidate name a branch queues under: `<owner>/<slice>` as the branch already reads
 *  (`duty/foo`, `codex/abc`), `node/` prefixed when it has no owner segment, lowercased with every
 *  other character made '-'. A branch that cannot be a name is refused, never guessed at. */
export function candidateNameOfBranch(branch) {
  const cleaned = branch.toLowerCase().replace(/[^a-z0-9._/-]+/gu, "-").replace(/\/{2,}/gu, "/").replace(/^[/.-]+|\/+$/gu, "");
  const name = cleaned.includes("/") ? cleaned : `node/${cleaned}`;
  if (!candidateNameOk(name)) throw new TypeError(`branch ${JSON.stringify(branch)} cannot be named as a candidate`);
  return name;
}

/** Hand the worktree's commits to the owning repository's pull-request queue: rebase onto the latest origin/main, join
 *  each moved submodule to its own main, and name the resulting head a candidate (`candidate`, else
 *  the branch's name, else a name from the head) that the node integrates, admits and publishes.
 *  Main has one writer, so nothing here pushes the superrepo. On a conflict, a `resolve({ workspace, conflicts, head })` the caller
 *  supplies (the worker that wrote the change, who still holds its intent) is handed the change
 *  replayed onto current main with its conflicts marked in the worktree; what it leaves, free of
 *  markers, is committed with the change's own message and joined in turn. Only a conflict nobody
 *  resolved leaves main unchanged and publishes the original commits as `stranded` for review, so no
 *  work stays only in a worktree the next preparation resets. */
export async function integrateWorktree({ workspace, branch, candidate, stranded, attempts = 3, resolve, runner = executeJavascriptNodeCommandAsynchronously }) {
  // What strands if nothing joins: the commits as the worker left them, or their latest resolved replay.
  let kept = await worktreeHead({ workspace, runner });
  const replays = [];
  const outcome = (fields) => Object.freeze({ ...fields, ...(replays.length === 0 ? {} : { replays: Object.freeze(replays) }) });
  const submodules = composedSubmodules({ workspace });
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await runStep(runner, gitWorktreePlan.fetchMain(), workspace);
    const sourceBase = readOid((await runStep(runner, gitCommitPathsPlan.remoteMain(), workspace)).stdout);
    await decompose({ workspace, runner });
    if ((await runStep(runner, gitWorktreePlan.rebase(sourceBase), workspace)).status !== 0) {
      await runStep(runner, gitWorktreePlan.rebaseAbort(), workspace);
      if (resolve === undefined || branch === undefined) break;
      let replay;
      try { replay = await replayResolved({ workspace, branch, resolve, runner }); } catch { replay = undefined; }
      if (replay === undefined) break;
      replays.push(replay.record);
      if (!replay.record.resolved) break;
      if (replay.absorbed) return outcome({ head: await worktreeHead({ workspace, runner }), absorbed: true });
      await compose({ workspace, submodules, runner });
      kept = await worktreeHead({ workspace, runner });
      continue;
    }
    // A submodule that will not join its own main strands the change whole, as a conflict does.
    const unjoined = await integrateSubmodules({ workspace, submodules: await movedSubmodules({ workspace, submodules, runner }), runner });
    await compose({ workspace, submodules, runner });
    if (unjoined !== undefined) break;
    const head = await worktreeHead({ workspace, runner });
    const named = nameCandidateSync({ repository: workspace, name: candidate ?? (branch === undefined ? `node/worktree-${head.slice(0, 12)}` : candidateNameOfBranch(branch)), commit: head, sourceBase, message: (await runStep(runner, gitCommitPathsPlan.commitMessage(head), workspace)).stdout });
    return outcome({ head, queued: true, candidate: Object.freeze({ name: named.name, commit: named.commit, pullRequest: named.pullRequest }) });
  }
  if (branch !== undefined) await runStep(runner, gitWorktreePlan.resetBranch(branch, kept), workspace);
  await publishWorktreeBranch({ workspace, branch: stranded, runner });
  return outcome({ stranded });
}

/** Remove the worktree from `repository` and, when named, its local branch; in the repository's
 *  lane, as preparation is. */
export function removeWorktree({ repository, workspace, branch, runner = executeJavascriptNodeCommandAsynchronously }) {
  return serially(`repository:${path.resolve(repository)}`, async () => {
    await runStep(runner, gitWorktreePlan.remove(workspace), repository);
    await runStep(runner, gitWorktreePlan.prune(), repository);
    if (branch !== undefined) await runStep(runner, gitWorktreePlan.deleteBranch(branch), repository);
  });
}

/** Where transactions keep their ephemeral worktrees: METROPLAT_TRANSACTION_WORKTREES, default
 *  ~/.local/state/561-group/transaction-worktrees. Outside the repository, as Codex slots are. */
export function transactionWorktreeRoot(environment = process.env) {
  return environment.METROPLAT_TRANSACTION_WORKTREES || path.join(homedir(), ".local", "state", "561-group", "transaction-worktrees");
}

/** One bounded change made away from the shared checkout: `effect(workspace)` runs in an ephemeral
 *  worktree from origin/main, whatever it leaves is committed on a transaction/ branch, and
 *  `land({ repository, branch, message })` joins that branch to origin/main. The worktree and its
 *  branch are removed whether or not the change lands. */
export async function transactWorktree({ repository, message, effect, land, environment = process.env, runner = executeJavascriptNodeCommandAsynchronously }) {
  const id = randomUUID();
  const branch = `transaction/${id}`;
  const workspace = path.join(transactionWorktreeRoot(environment), id);
  await prepareWorktree({ repository, workspace, branch, install: false, runner });
  try {
    const sourceBase = await worktreeHead({ workspace, runner });
    const outcome = await effect(workspace);
    const commit = await commitWorktree({ workspace, message: [message], runner });
    if (commit === undefined) return Object.freeze({ committed: false, outcome });
    return Object.freeze({ committed: true, commit, landing: await land({ repository, branch, sourceBase, message }), outcome });
  } finally {
    await removeWorktree({ repository, workspace, branch, runner });
  }
}

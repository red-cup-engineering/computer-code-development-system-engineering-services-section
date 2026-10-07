/**
 * A ready duty's own worktree of the house repository: where a provider, connected to this node with
 * standing delegated for that duty, programs away from the shared checkout. It opens the duty's
 * worktree, reads and writes files there through the workspace operations named with the same
 * `duty`, checks the packages it changed by running their tests sandboxed and the corpus it changed
 * against the knowledge ledger's ratchet, and commits, which
 * publishes the duty's branch; it proposes the work citing the commit. Once a receiver independent
 * of it accepts that proposal, the holder joins the branch to main at exactly the cited commit.
 * The provider's operations name their duty in their input (`locus: "duty"`), so standing
 * attenuated to one duty reaches that duty's worktree and no other; the join names no locus, so no
 * attenuated standing reaches it.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { executeJavascriptNodeCommandAsynchronously } from "@red-cup-engineering/execute-javascript-node-command-service/asynchronously";
import { DUTY_LOCUS } from "@red-cup-engineering/feltos/work/provider-delegation-authority";
import { acceptedWorkReceipts } from "@red-cup-engineering/feltos/work/work-acceptance-readout";
import { gitWorktreePlan, readPorcelainStatus } from "@red-cup-engineering/git-services-section/git-command-codec";
import { isolateJavascriptNodeCommandExecutionRequest } from "@red-cup-engineering/javascript-node-services-section/isolate-javascript-node-command-execution-request";
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { nodeFirstEnvironment } from "@red-cup-engineering/node-process-services-section/environment";
import { integrateGitBranch } from "../git/operations.mjs";
import { branchHead, commitWorktree, prepareWorktree, publishWorktreeBranch, removeWorktree, runStep, serially, worktreeChanges, worktreeHead } from "./worktree.mjs";

const CHECK_POLICY = Object.freeze({ timeoutMilliseconds: 600_000, outputLimit: 1024 * 1024 });
const CHECK_REPORT_LIMIT = 4000;
/** What a check never sees: every home, the user runtime directories, mounted drives, and the
 *  host's temporary files (the sandbox gets empty ones of its own). */
const CHECK_HIDDEN = Object.freeze(["/home", "/root", "/run/user", "/mnt", "/media", "/tmp", "/var/tmp"]);
/** The house corpus within the repository: what the knowledge ledger censuses. */
const CORPUS_ROOT = "lib/emsenn/services/561-group";
/** The engine's own installed census, never the copy in the worktree it judges. */
const CENSUS_CORPUS = new URL("scripts/census-corpus.mjs", import.meta.resolve("@red-cup-engineering/corpus-census-service/package.json"));

/** Where the census keeps carrier facts between checks: METROPLAT_CORPUS_FACTS, default
 *  ~/.cache/561-group/corpus-census. Derived data keyed by blob and by the code that read it. */
function corpusFactsDirectory(environment) {
  return environment.METROPLAT_CORPUS_FACTS || path.join(homedir(), ".cache", "561-group", "corpus-census");
}

/** Where duties keep their worktrees: METROPLAT_DUTY_WORKTREES, default
 *  ~/.local/state/561-group/duty-worktrees. Outside the repository, as transaction worktrees are. */
export function dutyWorktreeRoot(environment = process.env) {
  return environment.METROPLAT_DUTY_WORKTREES || path.join(homedir(), ".local", "state", "561-group", "duty-worktrees");
}

/** How many duty worktrees may be open on this node at once: METROPLAT_DUTY_WORKTREE_LIMIT, default 8. */
function dutyWorktreeLimit(environment) {
  const limit = Number(environment.METROPLAT_DUTY_WORKTREE_LIMIT);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : 8;
}

/** A duty scope's worktree and branch name: its readable part, then a digest of the whole scope, so
 *  scopes that read alike never share a worktree. */
export function dutyWorktreeName(scope) {
  const readable = scope.replace(/[^A-Za-z0-9_-]+/gu, "-").replace(/^-+/u, "").slice(0, 48).replace(/-+$/u, "");
  const digest = createHash("sha256").update(scope).digest("hex").slice(0, 12);
  return readable === "" ? digest : `${readable}-${digest}`;
}

export const dutyBranch = (scope) => `duty/${dutyWorktreeName(scope)}`;

export const dutyWorktreePath = (scope, environment = process.env) => path.join(dutyWorktreeRoot(environment), dutyWorktreeName(scope));

/** An already opened duty Resource belongs to exactly its allocated source owner. */
export function assertDutyWorktreeOwner(repository, duty, environment = process.env) {
  const workspace = dutyWorktreePath(duty, environment);
  if (!existsSync(workspace)) return;
  const common = root => realpathSync(execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
  if (common(repository) !== common(workspace)) throw new TypeError("duty source resource: opened workspace belongs to another source repository");
  const top = realpathSync(execFileSync("git", ["-C", workspace, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
  if (top !== realpathSync(workspace)) throw new TypeError("duty source resource: workspace is not its own Git worktree");
}


/** The root a workspace operation's input addresses: the worktree of the duty it names, undefined
 *  while that worktree is not open; else the explicitly bound repository for scope "repository",
 *  the bound package root for scope "package", or the data root. Repository scope never
 *  falls back to journal data when the host has not supplied a code repository. */
export function workspaceRootOf(binding, record, environment = process.env) {
  const duty = record[DUTY_LOCUS];
  if (typeof duty === "string" && duty !== "") {
    const workspace = dutyWorktreePath(duty, environment);
    return existsSync(workspace) ? workspace : undefined;
  }
  if (record.scope === "repository") return binding.repositoryRoot;
  if (record.scope === "package" && binding.packageRoot !== undefined) return binding.packageRoot;
  return binding.dataRoot;
}

const witness = (fields) => Object.freeze({ kind: "metroplat.workspace.duty-worktree:witness", ...fields });
const obstruction = (duty, reason, message) => Object.freeze({ kind: "metroplat.workspace.duty-worktree:obstruction", duty, reason, message });
const messageOf = (error) => (error instanceof Error ? error.message : String(error));
/** What an operation naming a duty answers while the duty's worktree is not open. */
export const dutyWorktreeAbsence = (duty) => obstruction(duty, "worktree-absent", "the duty's worktree is not open; open it first");

/** Count Git registrations rather than directory entries, including registered interrupted
 * checkouts whose .git file is absent. Inspect the source owner, its superproject and actual
 * workspace owners. Unregistered directories retain their source without consuming a Resource. */
export function readDutyWorktreeCapacity(environment = process.env, repository) {
  const root = path.resolve(dutyWorktreeRoot(environment));
  const directories = existsSync(root) ? readdirSync(root).map(name => path.join(root, name)) : [];
  const resources = new Set(), owners = new Set();
  const git = (directory, args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const inspect = directory => {
    const common = realpathSync(git(directory, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim());
    if (owners.has(common)) return;
    owners.add(common);
    for (const field of git(directory, ["worktree", "list", "--porcelain", "-z"]).split("\0")) {
      if (!field.startsWith("worktree ")) continue;
      const registered = path.resolve(field.slice(9));
      if (path.dirname(registered) === root) resources.add(registered);
    }
  };
  if (repository !== undefined) {
    inspect(repository);
    const superproject = git(repository, ["rev-parse", "--show-superproject-working-tree"]).trim();
    if (superproject !== "") inspect(superproject);
  }
  for (const directory of directories) {
    if (!existsSync(path.join(directory, ".git"))) continue;
    inspect(directory);
    if (!resources.has(directory)) throw new TypeError("duty source resource: directory has Git metadata but no matching worktree registration");
  }
  return Object.freeze({ resources: Object.freeze([...resources]), retainedDirectories: Object.freeze(directories.filter(directory => !resources.has(directory))) });
}

/** Open the worktree of a ready duty, at the duty's branch when an earlier opening left one, else
 *  at origin/main. An open worktree is left as it is. */
async function openDutyWorktree({ repository, duty, isReadyDuty, environment, runner }) {
  if (!(await isReadyDuty(duty))) return obstruction(duty, "duty-not-ready", "a worktree is opened only for a ready duty");
  const workspace = dutyWorktreePath(duty, environment);
  const branch = dutyBranch(duty);
  if (existsSync(workspace)) return witness({ duty, branch, opened: false, head: await worktreeHead({ workspace, runner }) });
  const root = dutyWorktreeRoot(environment);
  const open = readDutyWorktreeCapacity(environment, repository).resources.length;
  if (open >= dutyWorktreeLimit(environment)) return obstruction(duty, "worktree-limit", `${open} duty worktrees are already open on this node`);
  const earlier = await branchHead({ repository, branch, runner });
  try {
    await prepareWorktree({ repository, workspace, branch, ...(earlier === undefined ? {} : { from: branch }), runner });
  } catch (error) {
    // A first opening that fails leaves no branch behind; a resumed one keeps the branch it resumed.
    await removeWorktree({ repository, workspace, ...(earlier === undefined ? { branch } : {}), runner }).catch(() => undefined);
    return obstruction(duty, "prepare-failed", messageOf(error));
  }
  const before = await runStep(runner, gitWorktreePlan.sourceBase(branch), repository);
  return witness({ duty, branch, opened: true, head: await worktreeHead({ workspace, runner }), ...(before.status === 0 ? { sourceBase: before.stdout.trim() } : {}) });
}

/** Each changed path's owning package: the nearest directory above it, below the workspace root,
 *  that holds a package.json. */
function owningPackages(workspace, paths) {
  const owners = new Set();
  for (const file of paths) {
    for (let directory = path.posix.dirname(file); directory !== "."; directory = path.posix.dirname(directory)) {
      if (existsSync(path.join(workspace, directory, "package.json"))) {
        owners.add(directory);
        break;
      }
    }
  }
  return [...owners].sort();
}

/** The `not ok` entries of a TAP stream, each with its diagnostic block. */
function tapFailures(output) {
  const kept = [];
  let inFailure = false;
  for (const line of output.split("\n")) {
    if (/^\s*not ok /u.test(line)) inFailure = true;
    else if (/^\s*(?:ok|not ok) /u.test(line) || /^# /u.test(line)) inFailure = false;
    if (inFailure) kept.push(line);
  }
  return kept.join("\n").slice(0, CHECK_REPORT_LIMIT);
}

const tapCount = (output, name) => Number(new RegExp(`^# ${name} (\\d+)$`, "mu").exec(output)?.[1] ?? 0);

/** Run one package's tests in a sandbox that sees the worktree, this node's Node.js and the
 *  repository's objects read-only, with no network, no home and a fresh /tmp. */
async function checkPackage({ workspace, directory, readable, runner }) {
  const absolute = path.join(workspace, directory);
  const testDirectory = path.join(absolute, "test");
  const tests = existsSync(testDirectory) ? readdirSync(testDirectory).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => `test/${name}`) : [];
  if (tests.length === 0) return Object.freeze({ package: directory, tests: 0 });
  const { result } = await runner(isolateJavascriptNodeCommandExecutionRequest({
    type: "JavascriptNodeCommandIsolationRequest",
    version: 1,
    request: {
      type: "JavascriptNodeCommandExecutionRequest",
      version: 1,
      command: process.execPath,
      arguments: ["--test", "--test-reporter=tap", ...tests],
      directory: absolute,
      environment: { HOME: "/tmp", PATH: [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter) },
      input: null,
    },
    hidden: CHECK_HIDDEN.filter((entry) => existsSync(entry)),
    readable,
    writable: [],
  }), CHECK_POLICY);
  return Object.freeze({
    package: directory,
    tests: tests.length,
    status: result.status,
    signal: result.signal,
    pass: tapCount(result.stdout, "pass"),
    fail: tapCount(result.stdout, "fail"),
    cancelled: tapCount(result.stdout, "cancelled"),
    skipped: tapCount(result.stdout, "skipped"),
    failures: tapFailures(result.stdout),
    stderr: result.stderr.slice(-CHECK_REPORT_LIMIT),
    error: result.error,
  });
}

/** The knowledge ledger's ratchet over the worktree as it would be committed, against where the
 *  duty's branch forked from origin/main: no section's live broken path links, unresolved
 *  wikilinks, unlawful citekeys or schema refusals may rise. Trusted code reading the worktree's
 *  bytes, so it runs outside the sandbox, which could not keep its facts between checks. */
async function checkCorpus({ workspace, corpusRoot, environment, runner }) {
  const root = path.join(workspace, corpusRoot);
  const { result } = await runner(Object.freeze({
    type: "JavascriptNodeCommandExecutionRequest",
    version: 1,
    command: process.execPath,
    arguments: [fileURLToPath(CENSUS_CORPUS), "--root", root, "--worktree", "--base", "refs/remotes/origin/main", "--cache-dir", corpusFactsDirectory(environment)],
    directory: root,
    environment: nodeFirstEnvironment(),
    input: null,
  }), CHECK_POLICY);
  let verdict;
  try { verdict = JSON.parse(result.stdout); } catch { verdict = undefined; }
  if ((result.status !== 0 && result.status !== 1) || verdict === undefined) {
    return Object.freeze({ root: corpusRoot, holds: false, status: result.status, stderr: (result.stderr || result.error || "").slice(-CHECK_REPORT_LIMIT) });
  }
  return Object.freeze({ root: corpusRoot, holds: verdict.holds, fork: verdict.base.fork, rises: verdict.ratchet.rises, falls: verdict.ratchet.falls.length, moves: verdict.ratchet.moves });
}

/** Test every package the duty's work changes, committed or not, against the worktree as it stands,
 *  and hold the corpus it changes to the ratchet. The check observes: the sandbox can write nothing
 *  of the worktree. */
async function checkDutyWorktree({ duty, corpusRoot, environment, runner }) {
  const workspace = dutyWorktreePath(duty, environment);
  if (!existsSync(workspace)) return dutyWorktreeAbsence(duty);
  const branch = dutyBranch(duty);
  const committed = await worktreeChanges({ workspace, branch, runner });
  const pending = readPorcelainStatus((await runStep(runner, gitWorktreePlan.status(), workspace)).stdout);
  const changed = [...committed, ...pending].flatMap((change) => (change.source === undefined ? [change.path] : [change.path, change.source]));
  const packages = owningPackages(workspace, changed);
  const common = (await runStep(runner, gitWorktreePlan.commonDirectory(), workspace)).stdout.trim();
  const readable = [path.dirname(path.dirname(process.execPath)), common, workspace];
  const checked = [];
  for (const directory of packages) checked.push(await checkPackage({ workspace, directory, readable, runner }));
  // Any change under the corpus can damage it: a deleted script breaks the links naming it.
  const inCorpus = corpusRoot === "" || changed.some((file) => file === corpusRoot || file.startsWith(`${corpusRoot}/`));
  const corpus = inCorpus && existsSync(path.join(workspace, corpusRoot)) ? await checkCorpus({ workspace, corpusRoot, environment, runner }) : undefined;
  return witness({
    duty, branch,
    ok: checked.every((entry) => entry.tests === 0 || entry.status === 0) && (corpus?.holds ?? true),
    packages: Object.freeze(checked),
    ...(corpus === undefined ? {} : { corpus }),
  });
}

/** Commit what the duty's work left in its worktree and publish the duty's branch, naming the duty
 *  and the provider in the commit. Resolves the published head. */
async function commitDutyWorktree({ duty, message, subject, environment, runner }) {
  const workspace = dutyWorktreePath(duty, environment);
  if (!existsSync(workspace)) return dutyWorktreeAbsence(duty);
  const branch = dutyBranch(duty);
  const trailers = [`Duty: ${duty}`, ...(typeof subject === "string" && subject !== "" ? [`Provided-by: ${subject}`] : [])].join("\n");
  const commit = await commitWorktree({ workspace, message: [message, trailers], runner });
  const changes = await worktreeChanges({ workspace, branch, runner });
  if (changes.length === 0) return obstruction(duty, "nothing-to-commit", "the duty's worktree changes nothing against origin/main");
  const published = await publishWorktreeBranch({ workspace, branch, runner });
  return witness({ duty, branch, committed: commit !== undefined, head: published.head, changes: changes.length });
}

/** Remove the duty's worktree. What was committed stays on the duty's branch; what was not is gone. */
async function closeDutyWorktree({ repository, duty, environment, runner }) {
  const workspace = dutyWorktreePath(duty, environment);
  const branch = dutyBranch(duty);
  if (!existsSync(workspace)) return witness({ duty, branch, closed: false });
  await removeWorktree({ repository, workspace, runner });
  return witness({ duty, branch, closed: true });
}

/** The commit a provider cites in its proposal's evidence as the work it proposes. */
const COMMIT_EVIDENCE = /^commit:([0-9a-f]{40}(?:[0-9a-f]{24})?)$/u;

/** Queue the duty's branch for main, only where a receiver independent of its provider accepted a
 *  proposal citing the commit the branch stands at, then remove the duty's worktree and branch. */
async function integrateDutyWorktree({ repository, dataRoot, duty, subject, message, sourceBase: declaredSourceBase, acceptedWork, date, environment, runner }) {
  const branch = dutyBranch(duty);
  const receipts = (await acceptedWork(duty, date, subject)).filter((receipt) => receipt.subject === subject);
  if (receipts.length === 0) return obstruction(duty, "not-accepted", "no receiver independent of the provider has accepted the duty's work");
  const head = await branchHead({ repository, branch, runner });
  if (head === undefined) return obstruction(duty, "branch-absent", "the duty has no branch on this node");
  const receipt = receipts.find((candidate) => candidate.providerEvidence.some((entry) => COMMIT_EVIDENCE.exec(entry)?.[1] === head));
  if (receipt === undefined) return obstruction(duty, "head-not-accepted", `the duty's branch stands at ${head}, which no accepted proposal cites as commit:<oid>`);
  const before = await runStep(runner, gitWorktreePlan.sourceBase(branch), repository);
  if (before.status !== 0 && declaredSourceBase === undefined) return obstruction(duty, "source-base-absent", "the original source of this duty's delivery was not recorded; the provider must declare its before-source before receiving");
  const sourceBase = before.status === 0 ? before.stdout.trim() : declaredSourceBase;
  if (declaredSourceBase !== undefined && declaredSourceBase !== sourceBase) return obstruction(duty, "source-base-mismatch", "the declared source base differs from the original source recorded when work began");
  const trailers = [`Duty: ${duty}`, `Provided-by: ${receipt.provider}`, `Accepted-by: ${receipt.receiver}`].join("\n");
  // The branch is named a candidate for the node's merge queue, which integrates, admits and publishes it.
  // Naming reads and writes refs in the repository, so it waits for any preparation fetching into it.
  const joined = await serially(`repository:${path.resolve(repository)}`, () => integrateGitBranch({ packageRoot: repository, dataRoot }, {
    branch, sourceBase, expectedBranchHead: head, message: [message ?? `Join the accepted work of ${duty}`, trailers].join("\n\n"),
  }));
  if (!joined.ok || joined.candidate === undefined) return obstruction(duty, "integration-refused", `${joined.phase}: ${joined.obstructions.join(", ")}`);
  // The candidate's tag object references the branch head, so the commit stays reachable once the
  // duty's branch and worktree are gone, whether the queue goes on to admit or refuse it.
  await removeWorktree({ repository, workspace: dutyWorktreePath(duty, environment), branch, runner });
  await runStep(runner, gitWorktreePlan.unpublishBranch(branch), repository);
  return witness({ duty, branch, integrated: true, queued: true, candidate: joined.candidate, branchHead: head, provider: receipt.provider, receiver: receipt.receiver });
}

const DUTY = Object.freeze({ type: "string", minLength: 1, maxLength: 512 });
const request = (verb, properties = {}, required = []) => schemaFrom({
  $id: `metroplat/workspace/${verb}/request`,
  type: "object",
  required: [DUTY_LOCUS, ...required],
  additionalProperties: false,
  properties: { [DUTY_LOCUS]: DUTY, ...properties },
});

/** What every duty worktree operation answers: a witness of the duty's worktree and branch, or an
 *  obstruction saying why nothing was done. */
const result = schemaFrom({
  $id: "metroplat/workspace/duty-worktree/result",
  oneOf: [
    {
      type: "object",
      required: ["kind", "duty", "branch"],
      properties: {
        kind: { const: "metroplat.workspace.duty-worktree:witness" },
        duty: DUTY,
        branch: { type: "string", pattern: "^duty/[A-Za-z0-9_-]+$" },
      },
    },
    {
      type: "object",
      required: ["kind", "duty", "reason", "message"],
      additionalProperties: false,
      properties: {
        kind: { const: "metroplat.workspace.duty-worktree:obstruction" },
        duty: DUTY,
        reason: { enum: ["duty-not-ready", "worktree-limit", "prepare-failed", "worktree-absent", "nothing-to-commit", "not-accepted", "branch-absent", "head-not-accepted", "source-base-absent", "source-base-mismatch", "integration-refused"] },
        message: { type: "string", minLength: 1 },
      },
    },
  ],
});

const effects = (replay) => Object.freeze({ class: "external", replay, coordination: "coordination-free", deterministic: "unmeasured", totality: "schema-bounded" });

/** The duty worktree operations over `repository`, whose work ledger is journaled under `dataRoot`.
 *  `isReadyDuty(scope)` answers whether a duty is ready on this node, `acceptedWork(scope, date)`
 *  the accepted receipts of its work through a date, and `corpusRoot` where in the repository the
 *  ratcheted corpus lies; each duty's operations run one at a time. */
export function dutyWorktreeOperations({
  repository,
  dataRoot,
  isReadyDuty,
  acceptedWork = (scope, date, subject) => acceptedWorkReceipts({ dataRoot }, date, new Set([scope]), subject),
  corpusRoot = CORPUS_ROOT,
  environment = process.env,
  runner = executeJavascriptNodeCommandAsynchronously,
}) {
  const inLane = (input, effect) => serially(`duty:${dutyWorktreePath(input[DUTY_LOCUS], environment)}`, () => {
    assertDutyWorktreeOwner(repository, input[DUTY_LOCUS], environment);
    return effect();
  });
  return Object.freeze([
    operation({
      verb: "duty-worktree-open",
      relation: "boundary",
      locus: DUTY_LOCUS,
      inputFormat: "json",
      outputFormat: "json",
      effects: effects("safe"),
      domain: request("duty-worktree-open"),
      codomain: result,
      summary: "Open a ready duty's own worktree of the house repository.",
      description: "Domain: { duty }. Opens the duty's worktree at its branch, or at origin/main the first time, with packages linked; an open worktree is left as it is. Workspace reads, searches and writes naming the same duty act there.",
      run: (input) => inLane(input, () => serially(`duty-worktree-capacity:${path.resolve(dutyWorktreeRoot(environment))}`, () => openDutyWorktree({ repository, duty: input[DUTY_LOCUS], isReadyDuty, environment, runner }))),
    }),
    operation({
      verb: "duty-worktree-check",
      relation: "boundary",
      locus: DUTY_LOCUS,
      inputFormat: "json",
      outputFormat: "json",
      effects: effects("safe"),
      domain: request("duty-worktree-check"),
      codomain: result,
      summary: "Run the tests of every package a duty's work changes, sandboxed, and the corpus ratchet.",
      description: "Domain: { duty }. Each owning package's test/*.test.mjs runs without network, home or write access; the result counts passes and failures per package and quotes each failure. When the work changes the house corpus, census-corpus compares the worktree with the commit it forked from on origin/main, and any section whose live broken path links, unresolved wikilinks, unlawful citekeys or schema refusals rise fails the check, named in corpus.rises.",
      run: (input) => inLane(input, () => checkDutyWorktree({ duty: input[DUTY_LOCUS], corpusRoot, environment, runner })),
    }),
    operation({
      verb: "duty-worktree-commit",
      relation: "boundary",
      locus: DUTY_LOCUS,
      inputFormat: "json",
      outputFormat: "json",
      effects: effects("idempotency-key"),
      domain: request("duty-worktree-commit", { message: { type: "string", minLength: 1, maxLength: 4000 } }, ["message"]),
      codomain: result,
      summary: "Commit a duty's work and publish its branch for the holder to receive.",
      description: "Domain: { duty, message }. Commits everything in the duty's worktree with the message, the duty and the provider, and publishes the duty's branch. Propose the work citing the resolved head as commit:<head> in its evidence; once a receiver accepts it, the holder joins exactly that commit to main.",
      run: (input, _arguments, context) => inLane(input, () => commitDutyWorktree({ duty: input[DUTY_LOCUS], message: input.message, subject: context?.invocation?.subject, environment, runner })),
    }),
    operation({
      verb: "duty-worktree-close",
      relation: "boundary",
      locus: DUTY_LOCUS,
      inputFormat: "json",
      outputFormat: "json",
      effects: effects("safe"),
      domain: request("duty-worktree-close"),
      codomain: result,
      summary: "Close a duty's worktree, keeping its branch.",
      description: "Domain: { duty }. Removes the worktree; committed work stays on the duty's branch and a later opening resumes from it, uncommitted work is discarded.",
      run: (input) => inLane(input, () => closeDutyWorktree({ repository, duty: input[DUTY_LOCUS], environment, runner })),
    }),
    // No locus: a holder joins accepted work, and no standing attenuated to a duty reaches this.
    operation({
      verb: "duty-worktree-integrate",
      relation: "boundary",
      inputFormat: "json",
      outputFormat: "json",
      effects: effects("idempotency-key"),
      domain: request("duty-worktree-integrate", { sourceBase: { type: "string", pattern: "^[0-9a-f]{40}([0-9a-f]{24})?$" }, subject: { type: "string", minLength: 1 }, message: { type: "string", minLength: 1, maxLength: 4000 } }, ["subject"]),
      codomain: result,
      summary: "Join a duty's accepted work to main and retire its worktree and branch.",
      description: "Domain: { duty, subject, message?, sourceBase? }. sourceBase is the original before-source for an older worktree that did not record one; it must match any already recorded base. subject is the original structured intent subject of the accepted proposal. Reads that subject's causal receiving evidence; only where an independent receiver accepted this duty's proposal citing commit:<oid>, and the branch stands at that commit, joins it to origin/main naming duty, provider and receiver, then retires its worktree and local/remote branch.",
      run: (input, _arguments, context) => inLane(input, () => integrateDutyWorktree({
        repository, dataRoot, duty: input[DUTY_LOCUS], subject: input.subject, message: input.message, sourceBase: input.sourceBase, acceptedWork,
        date: (context?.startedAt ?? new Date().toISOString()).slice(0, 10), environment, runner,
      })),
    }),
  ]);
}

/**
 * @packageDocumentation
 *
 * The code-development engine's Git effects as RPC operations: a workspace change readout,
 * exact-path commits, and publication of a cut a settled Task facilitated; and submodule
 * registration.
 *
 * Git command arguments and output decoding live in git-services-section's pure codec. This
 * engine owns command execution, the policy a plumbing commit must honour where porcelain
 * `git commit` would, temporary-index lifecycle, compare-and-set ref installation, merge
 * worktree reconciliation, and push. Task publication adds only its settlement trailers and
 * idempotent-replay detection. A new repository is established from the files its producers
 * wrote, ready to register as a submodule.
 */
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { cutPnpmLockfile, decodePnpmLockfileImporters } from "@red-cup-engineering/jsnode-package-services-section/workspace/pnpm-lockfile";
import { candidateNameOk, landPathsSync, nameCandidateSync } from "./github-candidate.mjs";

import { readWorkItemView } from "@red-cup-engineering/feltos/work/service";
import { DUTY_LOCUS } from "@red-cup-engineering/feltos/work/provider-delegation-authority";
import { dutyWorktreeAbsence, workspaceRootOf } from "../workspace/duty-worktree.mjs";
import { candidateNameOfBranch } from "../workspace/worktree.mjs";
import { executeGitPlan } from "./runner.mjs";
import { headReading, observeGitRepository } from "./observation.mjs";

import { gitCommitPathsPlan, gitEstablishmentPlan, gitHistoryPlan, gitRepositoryObservationPlan, gitSubmodulePlan, readGitBranchIntegrationRequest, readBatchBlobs, readGitCommitPathsRequest, readIndexedPaths, readNameStatus, readOid, readPorcelainStatus, splitNullOutput } from "@red-cup-engineering/git-services-section/git-command-codec";

function gitCommitPathsResult(root, phase, request, fields, commands) {
  return Object.freeze({
    kind: "metroplat.git.commit-paths",
    ok: phase === "planned" || phase === "committed" || phase === "published" || phase === "queued" || phase === "unchanged",
    phase,
    root,
    paths: request?.paths ?? Object.freeze([]),
    push: request?.push ?? false,
    ...fields,
    commands: Object.freeze(commands),
  });
}

function lstatOrUndefined(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function directoryShape(directory) {
  const entry = lstatOrUndefined(directory);
  if (entry === undefined) return "absent";
  if (entry.isSymbolicLink()) return "symlink-directory-endpoint";
  if (existsSync(path.join(directory, ".git"))) return "nested-repository-endpoint";
  return undefined;
}

/** Why a named endpoint is not one file this repository can commit: a directory, a path through a
 *  symlinked directory, or a path inside a nested repository. */
function endpointObstruction(root, file, directories) {
  let directory = "";
  for (const segment of file.split("/").slice(0, -1)) {
    directory = directory === "" ? segment : `${directory}/${segment}`;
    if (!directories.has(directory)) directories.set(directory, directoryShape(path.join(root, directory)));
    const shape = directories.get(directory);
    if (shape === "absent") return undefined;
    if (shape !== undefined) return `${shape}:${file}`;
  }
  return lstatOrUndefined(path.join(root, file))?.isDirectory() ? `file-endpoint-required:${file}` : undefined;
}

const OPERATIONS_IN_PROGRESS = Object.freeze(["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]);
const COMMIT_HOOKS = Object.freeze(["pre-commit", "prepare-commit-msg", "commit-msg"]);

function executableHook(hooks, name) {
  try {
    return (statSync(path.join(hooks, name)).mode & 0o111) !== 0;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

/** What a plumbing commit refuses where porcelain `git commit` would act otherwise: an operation in
 *  progress, unmerged entries, signing, commit hooks it would skip, and endpoints that are not one
 *  file. Whether a post-commit hook is to run once the commit is installed rides along. */
function commitPolicy(root, paths, commands) {
  const gitDirectory = executeGitPlan(root, gitCommitPathsPlan.gitDirectory(), commands).stdout.trim();
  const hooks = executeGitPlan(root, gitCommitPathsPlan.hooksDirectory(), commands).stdout.trim();
  const directories = new Map();
  const obstructions = [
    ...OPERATIONS_IN_PROGRESS.filter((name) => existsSync(path.join(gitDirectory, name))).map((name) => `operation-in-progress:${name}`),
    ...(splitNullOutput(executeGitPlan(root, gitCommitPathsPlan.unmergedPaths(), commands).stdout).length > 0 ? ["unmerged-index-entries"] : []),
    ...(executeGitPlan(root, gitCommitPathsPlan.commitSigning(), commands).stdout.trim() === "true" ? ["commit-signing-configured"] : []),
    ...COMMIT_HOOKS.filter((name) => executableHook(hooks, name)).map((name) => `commit-hook-configured:${name}`),
    ...paths.map((file) => endpointObstruction(root, file, directories)).filter((obstruction) => obstruction !== undefined),
  ];
  return Object.freeze({ obstructions: Object.freeze(obstructions), postCommit: executableHook(hooks, "post-commit") });
}

/** Run the post-commit hook porcelain would have run; its failure is reported, never undone. */
function runPostCommit(root, commands) {
  const hook = executeGitPlan(root, gitCommitPathsPlan.runHook("post-commit"), commands);
  return Object.freeze({ success: hook.status === 0, output: (hook.stdout || hook.stderr).trim() });
}

function restoreFiles(root, snapshots) {
  for (const [file, contents] of snapshots) writeFileSync(path.join(root, file), contents);
}

const LOCKFILE_DEPENDENCY_SECTIONS = Object.freeze([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);

const unquoted = (value) => (/^(['"]).*\1$/u.test(value) ? value.slice(1, -1) : value);

/** Each importer's dependency specifiers by section, as the workspace lockfile codec reads them. */
function readLockfileImporters(source) {
  return new Map(decodePnpmLockfileImporters(source).importers.map(({ path: importer, dependencies }) => {
    const sections = new Map(LOCKFILE_DEPENDENCY_SECTIONS.map((name) => [name, new Map()]));
    for (const { name, field, specifier } of dependencies) sections.get(field).set(name, unquoted(specifier));
    return [importer, sections];
  }));
}

const LOCKFILE = "pnpm-lock.yaml";
/** The manifests a request names only for the workspace lockfile: a package.json inside a nested
 *  repository, named beside pnpm-lock.yaml. The workspace lockfile owns that importer, so naming it
 *  takes the importer into the cut; the nested repository commits the manifest itself. */
function lockfileOnlyManifests(root, request) {
  if (!request.paths.includes(LOCKFILE)) return new Set();
  const directories = new Map();
  return new Set(request.paths.filter((file) => path.posix.basename(file) === "package.json"
    && endpointObstruction(root, file, directories)?.startsWith("nested-repository-endpoint:")));
}

const namedImporters = (request) => request.paths.filter((file) => path.posix.basename(file) === "package.json").map((file) => path.posix.dirname(file));

/**
 * The lockfile a commit naming pnpm-lock.yaml carries. The workspace lockfile is shared by every
 * writer of the checkout, so with manifests named it is the parent's lockfile with only their
 * importers (and the packages they add) taken from the worktree; other writers' lockfile edits
 * wait for their own manifests. Named alone, the lockfile is committed whole.
 */
function lockfileCut(root, parent, request, commands) {
  const worktree = readFileSync(path.join(root, LOCKFILE), "utf8");
  const importers = namedImporters(request);
  return importers.length > 0 ? cutPnpmLockfile(committedFile(root, parent, LOCKFILE, commands), worktree, importers) : worktree;
}

function normalizedDependencySpec(value) {
  if (typeof value !== "string") return String(value);
  if (!value.startsWith("link:")) return value;
  return `link:${path.posix.normalize(value.slice("link:".length))}`;
}

function manifestDependencies(manifest) {
  const expected = new Map();
  for (const section of ["devDependencies", "optionalDependencies", "dependencies"]) {
    for (const [name, specifier] of Object.entries(manifest?.[section] ?? {})) {
      expected.set(name, normalizedDependencySpec(specifier));
    }
  }
  return expected;
}

function dependencyObstructions(importer, manifest, locked) {
  const expected = manifestDependencies(manifest);
  const actual = locked ?? new Map(LOCKFILE_DEPENDENCY_SECTIONS.map((section) => [section, new Map()]));
  const lockedNames = new Map();
  for (const section of LOCKFILE_DEPENDENCY_SECTIONS) {
    for (const [name, specifier] of (actual.get(section) ?? new Map())) {
      if (!lockedNames.has(name)) lockedNames.set(name, []);
      lockedNames.get(name).push({ section, specifier });
    }
  }
  const obstructions = [];
  for (const name of [...expected.keys()].sort()) {
    const entries = lockedNames.get(name);
    if (entries === undefined) {
      obstructions.push(`lockfile-importer-mismatch:${importer}:missing:${name}`);
      continue;
    }
    for (const { section, specifier } of entries) {
      if (normalizedDependencySpec(specifier) !== expected.get(name)) {
        obstructions.push(`lockfile-importer-mismatch:${importer}:mismatched:${section}:${name}:manifest=${expected.get(name)}:lockfile=${specifier}`);
      }
    }
  }
  for (const name of [...lockedNames.keys()].sort()) {
    if (expected.has(name) || Object.hasOwn(manifest?.peerDependencies ?? {}, name)) continue;
    for (const { section } of lockedNames.get(name)) {
      obstructions.push(`lockfile-importer-mismatch:${importer}:extra:${section}:${name}`);
    }
  }
  return obstructions;
}

function committedFile(root, commit, file, commands) {
  return executeGitPlan(root, gitCommitPathsPlan.showFile(commit, file), commands).stdout;
}

function committedFiles(root, commit, files, commands) {
  if (files.length === 0) return new Map();
  const objects = files.map((file) => `${commit}:${file}`);
  const bodies = readBatchBlobs(objects, executeGitPlan(root, gitHistoryPlan.blobs(objects), commands).stdout);
  return new Map(files.map((file, index) => [file, bodies[index]]));
}

export function lockfileDependencyObstructions(root, parent, request, commands = [], cut = undefined) {
  const lockfileIsNamed = request.paths.includes(LOCKFILE);
  if (!lockfileIsNamed && !request.paths.some((file) => path.basename(file) === "package.json")) return [];
  let lockfile;
  try {
    lockfile = lockfileIsNamed
      ? cut ?? lockfileCut(root, parent, request, commands)
      : committedFile(root, parent, LOCKFILE, commands);
  } catch (error) {
    return [`lockfile-validation-failed:${boundedErrorMessage(error)}`];
  }
  const importers = readLockfileImporters(lockfile);
  const namedManifests = request.paths.filter((file) => path.basename(file) === "package.json");
  let packagePaths = namedManifests;
  if (lockfileIsNamed) {
    // A source cut owns its changed dependency contracts, not every unrelated
    // importer already present in the workspace (including nested repositories).
    const previous = readLockfileImporters(committedFile(root, parent, LOCKFILE, commands));
    const signature = (sections) => sections === undefined ? undefined : JSON.stringify(
      [...sections].map(([section, dependencies]) => [section, [...dependencies].sort(([a], [b]) => a.localeCompare(b))]),
    );
    const changed = [...new Set([...previous.keys(), ...importers.keys()])]
      .filter((importer) => signature(previous.get(importer)) !== signature(importers.get(importer)))
      .map((importer) => importer === "." ? "package.json" : `${importer}/package.json`);
    packagePaths = [...new Set([...namedManifests, ...changed])];
  }
  const committedPackagePaths = lockfileIsNamed
    ? packagePaths.filter((packagePath) => !request.paths.includes(packagePath))
    : [];
  let committedManifests;
  try {
    committedManifests = committedFiles(root, parent, committedPackagePaths, commands);
  } catch (error) {
    return [`lockfile-validation-failed:${boundedErrorMessage(error)}`];
  }
  const obstructions = [];
  for (const packagePath of packagePaths) {
    const importer = path.posix.dirname(packagePath) === "." ? "." : path.posix.dirname(packagePath);
    if (lockfileIsNamed && !existsSync(path.join(root, packagePath))) {
      // A removed package leaves neither its manifest nor its importer.
      if (!importers.has(importer)) continue;
      obstructions.push(`lockfile-importer-mismatch:${importer}:missing:package-json`);
      continue;
    }
    let manifest;
    try {
      const contents = request.paths.includes(packagePath)
        ? readFileSync(path.join(root, packagePath), "utf8")
        : lockfileIsNamed
          ? committedManifests.get(packagePath)
          : committedFile(root, parent, packagePath, commands);
      if (contents === undefined) throw Object.assign(new Error("committed manifest is missing"), { code: "ENOENT" });
      manifest = JSON.parse(contents);
    } catch (error) {
      if (lockfileIsNamed && error?.code === "ENOENT") {
        obstructions.push(`lockfile-importer-mismatch:${importer}:missing:package-json`);
        continue;
      }
      obstructions.push(`lockfile-validation-failed:${packagePath}:${boundedErrorMessage(error)}`);
      continue;
    }
    obstructions.push(...dependencyObstructions(importer, manifest, importers.get(importer)));
  }
  return obstructions;
}

/**
 * Whether a local edit already carries origin's whole change to a file, so a merge-file conflict is
 * only the local edit extending origin's hunk. Merging with every conflict resolved to the local side
 * must reproduce the local file exactly (origin's non-conflicting changes are all present), and by
 * line counts the local file must hold each line origin added as often as origin does and each line
 * origin removed no more often than origin does.
 */
function carriesRemoteChange(base, local, remote, favoringLocal) {
  if (favoringLocal !== local) return false;
  const count = (text) => {
    const counts = new Map();
    for (const line of text.split("\n")) counts.set(line, (counts.get(line) ?? 0) + 1);
    return counts;
  };
  const [before, here, there] = [count(base), count(local), count(remote)];
  for (const [line, times] of there) if (times > (before.get(line) ?? 0) && (here.get(line) ?? 0) < times) return false;
  for (const [line, times] of before) if ((there.get(line) ?? 0) < times && (here.get(line) ?? 0) > (there.get(line) ?? 0)) return false;
  return true;
}

/** A path the tree holds as a submodule (a gitlink): its checkout is a directory, never file bytes to merge. */
const isGitlinkCheckout = (root, file) => lstatSync(path.join(root, file), { throwIfNoEntry: false })?.isDirectory() === true;

function mergeUnnamedRemoteEdits(root, head, remote, files, commands) {
  // A submodule's pointer moved on origin while its checkout moved here is not a file edit: the superproject takes
  // origin's pointer, and the submodule's own checkout stays with the writer working in it.
  const gitlinks = files.filter((file) => isGitlinkCheckout(root, file));
  if (gitlinks.length > 0) {
    const rest = mergeUnnamedRemoteEdits(root, head, remote, files.filter((file) => !gitlinks.includes(file)), commands);
    return Object.freeze({ conflict: rest.conflict, merged: Object.freeze([...gitlinks, ...rest.merged]) });
  }
  if (files.length === 0) return Object.freeze({ conflict: undefined, merged: Object.freeze([]) });
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "git-commit-paths-merge-"));
  // A file deleted both here and on origin is the same change on both sides: nothing to merge.
  const deletedByOrigin = new Set(splitNullOutput(executeGitPlan(root, gitCommitPathsPlan.deletedPaths(head, remote), commands).stdout));
  const bothDeleted = files.filter((file) => deletedByOrigin.has(file) && !existsSync(path.join(root, file)));
  files = files.filter((file) => !bothDeleted.includes(file));
  if (files.length === 0) return Object.freeze({ conflict: undefined, merged: Object.freeze(bothDeleted) });
  const snapshots = new Map(files.map((file) => [file, readFileSync(path.join(root, file))]));
  // An incoming addition may already exist as another writer's staged or
  // untracked file. Absence in the old tree is its empty merge base.
  const bases = committedFiles(root, head, files, commands);
  const incoming = committedFiles(root, remote, files, commands);
  try {
    for (const [index, file] of files.entries()) {
      // A locally edited file origin deleted has no remote side to merge: another writer must decide.
      if (deletedByOrigin.has(file)) {
        restoreFiles(root, snapshots);
        return Object.freeze({ conflict: file, merged: Object.freeze([]) });
      }
      const baseFile = path.join(temporaryDirectory, `${index}.base`);
      const remoteFile = path.join(temporaryDirectory, `${index}.remote`);
      writeFileSync(baseFile, bases.get(file) ?? "");
      writeFileSync(remoteFile, incoming.get(file) ?? "");
      const local = snapshots.get(file);
      const favoringLocal = executeGitPlan(root, gitCommitPathsPlan.mergeFileFavoringCurrent(path.join(root, file), baseFile, remoteFile), commands).stdout;
      const merge = executeGitPlan(root, gitCommitPathsPlan.mergeFile(path.join(root, file), baseFile, remoteFile), commands);
      if (merge.status !== 0 && carriesRemoteChange(readFileSync(baseFile, "utf8"), local.toString("utf8"), readFileSync(remoteFile, "utf8"), favoringLocal)) {
        // The local edit already holds origin's change and extends it; merge-file only saw overlapping hunks.
        writeFileSync(path.join(root, file), local);
        continue;
      }
      if (merge.status !== 0) {
        restoreFiles(root, snapshots);
        return Object.freeze({ conflict: file, merged: Object.freeze([]) });
      }
      // Only a clean merge reaches the worktree, so an interrupted or concurrent run never leaves conflict markers there.
      writeFileSync(path.join(root, file), merge.stdout);
    }
    return Object.freeze({ conflict: undefined, merged: Object.freeze([...files, ...bothDeleted]) });
  } catch (error) {
    restoreFiles(root, snapshots);
    throw error;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

/** A stable candidate name for a producer that names none: its message's words and its paths, so the
 *  same producer landing the same paths again replaces its pending candidate. */
function candidateNameOf(request) {
  const words = request.message.toLowerCase().split("\n")[0].replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 48).replace(/-+$/u, "");
  const paths = createHash("sha256").update(request.paths.join("\0")).digest("hex").slice(0, 8);
  return `node/${words || "paths"}-${paths}`;
}

/**
 * Commit exactly the named worktree endpoints through a temporary index. With `push`, nothing is
 * committed in the checkout: the named paths land through the owning repository's pull-request queue as a candidate
 * built on origin/main from what the checkout holds at each path (`candidate` names it; a stable
 * name is derived otherwise), and the node integrates, admits and publishes it. A writer never moves
 * main, so the checkout's branch, HEAD, index and other writers' edits are neither read nor moved,
 * and the workspace lockfile is the queue's to derive.
 */
export function commitGitPaths(binding, input) {
  const commands = [];
  let request;
  try {
    request = readGitCommitPathsRequest(input);
    if (input?.candidate !== undefined && !candidateNameOk(input.candidate)) throw new TypeError("git-commit-paths candidate must be <owner>/<slice> in lowercase letters, digits, '.', '_' and '-'");
  } catch (error) {
    return gitCommitPathsResult(binding.packageRoot ?? binding.dataRoot, "precondition", undefined, { obstructions: Object.freeze([boundedErrorMessage(error)]) }, commands);
  }
  let root = path.resolve(binding.packageRoot ?? binding.dataRoot);
  // A cut lockfile is built on the parent, so origin's lockfile edits merge like any other writer's.
  const lockfileIsCut = request.paths.includes(LOCKFILE) && namedImporters(request).length > 0;
  let contested;
  let committable;
  try {
    root = executeGitPlan(root, gitCommitPathsPlan.root(), commands).stdout.trim();
    if (request.push) {
      const name = input?.candidate ?? candidateNameOf(request);
      if (request.dryRun) return gitCommitPathsResult(root, "planned", request, { candidate: { name }, obstructions: Object.freeze([]) }, commands);
      const landed = landPathsSync({ repository: root, name, paths: request.paths, message: request.message });
      return gitCommitPathsResult(root, landed ? "queued" : "unchanged", request, {
        created: landed !== null,
        ...(landed ? { head: landed.commit, candidate: Object.freeze({ name: landed.name, commit: landed.commit }) } : {}),
        obstructions: Object.freeze([]),
      }, commands);
    }
    const lockfileOnly = lockfileOnlyManifests(root, request);
    committable = request.paths.filter((file) => !lockfileOnly.has(file));
    contested = committable.filter((file) => !(lockfileIsCut && file === LOCKFILE));
    const branch = executeGitPlan(root, gitCommitPathsPlan.branch(), commands).stdout.trim();
    if (branch !== "main") return gitCommitPathsResult(root, "precondition", request, { obstructions: Object.freeze([`main-branch-required:${branch}`]) }, commands);
    const policy = commitPolicy(root, committable, commands);
    if (policy.obstructions.length > 0) return gitCommitPathsResult(root, "precondition", request, { obstructions: policy.obstructions }, commands);
    if (request.dryRun) return gitCommitPathsResult(root, "planned", request, { head: readOid(executeGitPlan(root, gitCommitPathsPlan.head(), commands).stdout), obstructions: Object.freeze([]) }, commands);

    const named = new Set(request.paths);
    // An ignored path the shared index already tracks is added by force; no other path is.
    const added = contested;
    const indexed = readIndexedPaths(added, executeGitPlan(root, gitCommitPathsPlan.indexedPaths(added), commands).stdout);
    const unindexed = added.filter((file) => !indexed.includes(file));
    let committed;
    let createdCommit = false;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const parent = readOid(executeGitPlan(root, gitCommitPathsPlan.head(), commands).stdout);
      const cut = lockfileIsCut ? lockfileCut(root, parent, request, commands) : undefined;
      const dependencyObstruction = lockfileDependencyObstructions(root, parent, request, commands, cut);
      if (dependencyObstruction.length > 0) {
        return gitCommitPathsResult(root, "precondition", request, {
          head: parent,
          obstructions: Object.freeze(dependencyObstruction),
        }, commands);
      }
      const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "git-commit-paths-"));
      const temporaryIndex = path.join(temporaryDirectory, "index");
      try {
        executeGitPlan(root, gitCommitPathsPlan.readTree(parent, temporaryIndex), commands);
        if (unindexed.length > 0) executeGitPlan(root, gitCommitPathsPlan.addPaths(unindexed, temporaryIndex), commands);
        if (indexed.length > 0) executeGitPlan(root, gitCommitPathsPlan.addPaths(indexed, temporaryIndex, { force: true }), commands);
        if (cut !== undefined) {
          const blob = readOid(executeGitPlan(root, gitCommitPathsPlan.hashBlob(LOCKFILE, cut), commands).stdout);
          executeGitPlan(root, gitCommitPathsPlan.stageBlob(LOCKFILE, blob, temporaryIndex), commands);
        }
        const tree = readOid(executeGitPlan(root, gitCommitPathsPlan.writeTree(temporaryIndex), commands).stdout);
        const changed = splitNullOutput(executeGitPlan(root, gitCommitPathsPlan.treeChangedPaths(parent, tree), commands).stdout);
        const outside = changed.filter((file) => !named.has(file));
        if (outside.length > 0) throw new Error(`temporary index admitted unnamed paths: ${outside.join(", ")}`);
        if (changed.length === 0) return gitCommitPathsResult(root, "stage", request, { head: parent, obstructions: Object.freeze(["nothing-to-commit"]) }, commands);
        const candidate = readOid(executeGitPlan(root, gitCommitPathsPlan.commitTree(tree, [parent], request.message), commands).stdout);
        const installed = executeGitPlan(root, gitCommitPathsPlan.updateHead(candidate, parent), commands);
        if (installed.status !== 0) continue;
        executeGitPlan(root, gitCommitPathsPlan.resetPaths(candidate, committable), commands);
        committed = candidate;
        createdCommit = true;
        break;
      } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
      }
    }
    if (committed === undefined) return gitCommitPathsResult(root, "commit", request, { obstructions: Object.freeze(["head-kept-moving"]) }, commands);
    const postCommit = createdCommit && policy.postCommit ? { postCommit: runPostCommit(root, commands) } : {};
    return gitCommitPathsResult(root, "committed", request, { created: createdCommit, head: committed, obstructions: Object.freeze([]), ...postCommit }, commands);
  } catch (error) {
    return gitCommitPathsResult(root, "effect", request, { obstructions: Object.freeze([boundedErrorMessage(error)]) }, commands);
  }
}

function branchIntegrationResult(root, phase, request, fields, commands) {
  return Object.freeze({
    kind: "metroplat.git.branch-integration",
    ok: phase === "queued",
    phase,
    root,
    ...(request === undefined ? {} : request),
    ...fields,
    commands: Object.freeze(commands),
  });
}

/**
 * Name one contribution branch's exact head as a candidate for the owning repository's pull-request queue. Main has one
 * writer, the queue, which composes this candidate with origin/main, admits it and publishes; this
 * operation never joins, pushes or moves the checkout, so the checkout's branch, HEAD, index and
 * other writers' edits do not matter. A request naming `expectedBranchHead` queues only while the
 * branch stands at that commit. The branch commit remains the durable task trace, and the candidate
 * tag keeps it reachable whether the queue admits or refuses it. `changes` reads the branch against
 * origin/main as last fetched, for the caller's report only.
 */
export function integrateGitBranch(binding, input) {
  const commands = [];
  let request;
  let root = path.resolve(binding.packageRoot ?? binding.dataRoot);
  try {
    request = readGitBranchIntegrationRequest(input);
  } catch (error) {
    return branchIntegrationResult(root, "precondition", undefined, { obstructions: Object.freeze([boundedErrorMessage(error)]) }, commands);
  }
  try {
    root = executeGitPlan(root, gitCommitPathsPlan.root(), commands).stdout.trim();
    if (executeGitPlan(root, gitCommitPathsPlan.checkBranchRef(request.branch), commands).status !== 0) return branchIntegrationResult(root, "precondition", request, {
      obstructions: Object.freeze(["invalid-contribution-branch-ref"]),
    }, commands);
    let name;
    try {
      name = input?.candidate !== undefined ? String(input.candidate) : candidateNameOfBranch(request.branch);
      if (!candidateNameOk(name)) throw new TypeError(`candidate ${JSON.stringify(name)} must be <owner>/<slice> in lowercase letters, digits, '.', '_' and '-'`);
    } catch (error) {
      return branchIntegrationResult(root, "precondition", request, { obstructions: Object.freeze([boundedErrorMessage(error)]) }, commands);
    }
    const branchReading = executeGitPlan(root, request.source === "origin"
      ? gitCommitPathsPlan.originBranchHead(request.branch)
      : gitCommitPathsPlan.branchHead(request.branch), commands);
    if (branchReading.status !== 0) return branchIntegrationResult(root, "precondition", request, {
      obstructions: Object.freeze(["contribution-branch-absent"]),
    }, commands);
    const branchHead = readOid(branchReading.stdout);
    if (request.expectedBranchHead !== undefined && branchHead !== request.expectedBranchHead) return branchIntegrationResult(root, "precondition", request, {
      branchHead,
      obstructions: Object.freeze(["branch-moved-from-expected-head"]),
    }, commands);
    // Fetch only the reviewed object. No local branch or mutable FETCH_HEAD is needed, and a
    // later remote branch movement cannot replace the contribution selected above.
    if (request.source === "origin") executeGitPlan(root, gitCommitPathsPlan.fetchCommit(branchHead), commands);
    let changes;
    try {
      executeGitPlan(root, gitCommitPathsPlan.fetchMain(), commands);
      changes = readNameStatus(executeGitPlan(root, gitCommitPathsPlan.branchChangedPaths(request.sourceBase, branchHead), commands).stdout);
    } catch {
      changes = undefined;
    }
    const candidate = nameCandidateSync({ repository: root, name, commit: branchHead, sourceBase: request.sourceBase, message: request.message });
    return branchIntegrationResult(root, "queued", request, {
      branchHead, candidate: Object.freeze({ name: candidate.name, commit: candidate.commit, pullRequest: candidate.pullRequest }), head: branchHead,
      ...(changes === undefined ? {} : { changes }),
      obstructions: Object.freeze([]),
    }, commands);
  } catch (error) {
    return branchIntegrationResult(root, "effect", request, { obstructions: Object.freeze([boundedErrorMessage(error)]) }, commands);
  }
}

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function stringRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function taskPublicationResult(
  root,
  phase,
  fields,
) {
  return Object.freeze({
    kind: "metroplat.git.task-cut-publication",
    ok: phase === "queued",
    phase,
    root,
    ...fields,
  });
}

function boundedDiagnostic(result) {
  return (result.stderr.trim() || result.stdout.trim() || "git command failed").slice(0, 1_000);
}

function boundedErrorMessage(error) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
}

function exactRelativePaths(value) {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string")) return undefined;
  const paths = [...new Set(value)].sort();
  if (paths.some((item) => item.length === 0
    || item.startsWith("/")
    || item.includes("\0")
    || item.split(/[\\/]/u).includes(".."))) return undefined;
  return Object.freeze(paths);
}

function taskSettlement(
  binding,
  task,
) {
  const cell = typeof task["cell"] === "string" ? task["cell"] : undefined;
  const feed = typeof task["feed"] === "string" ? task["feed"] : undefined;
  const date = typeof task["date"] === "string" ? task["date"] : undefined;
  if (cell === undefined || feed === undefined || date === undefined) return undefined;
  const view = stringRecord(readWorkItemView(binding, date, feed));
  const scope = stringRecord(stringRecord(view?.["scopes"])?.[cell]);
  const accounting = stringRecord(scope?.["accounting"]);
  const settlement = stringRecord(scope?.["settlement"]);
  if (scope?.["status"] !== "discharged"
    || scope["causalDischarge"] !== true
    || accounting?.["kind"] !== "metroplat.workItem.accounting:witness"
    || settlement?.["kind"] !== "lorentzian.causalSettle:witness"
    || typeof scope["latest"] !== "string"
    || typeof accounting["id"] !== "string"
    || typeof view?.["id"] !== "string") return undefined;
  return Object.freeze({ cell, latest: scope["latest"], accounting: accounting["id"], view: view["id"] });
}

/**
 * Publish one exact Git cut after MetroPlat's existing work owner proves its
 * facilitating Task causally discharged. RPC standing supplies authorization;
 * Task settlement supplies readiness only. Main has one writer, so the cut is not
 * committed or pushed here: it is named as a candidate for the owning repository's pull-request queue
 * whose message carries the settlement trailers, and the node integrates, admits
 * and publishes it. A replay is recognised by those trailers on a HEAD the node's
 * integration has since carried into the checkout, or by the cut already matching
 * origin/main; naming the same cut again replaces its own candidate.
 */
export function publishSettledTaskCut(binding, input) {
  const root = binding.packageRoot ?? binding.dataRoot;
  const record = stringRecord(input);
  const task = stringRecord(record?.["task"]);
  const expectedHead = typeof record?.["expectedHead"] === "string" ? record["expectedHead"] : undefined;
  const message = typeof record?.["message"] === "string" ? record["message"].trim() : "";
  const paths = exactRelativePaths(record?.["paths"]);
  const base = { paths: paths ?? Object.freeze([]), evidence: Object.freeze(["boundary:git-services-section/git-command-codec", "remote:origin", "queue:candidate"]) };
  if (task === undefined || expectedHead === undefined || !/^[0-9a-f]{40}([0-9a-f]{24})?$/u.test(expectedHead)
    || message.length === 0 || paths === undefined) {
    return taskPublicationResult(root, "precondition", { ...base, obstructions: Object.freeze(["invalid-publication-request"]) });
  }
  const settled = taskSettlement(binding, task);
  if (settled === undefined) {
    return taskPublicationResult(root, "precondition", { ...base, expectedHead, ...(typeof task["cell"] === "string" ? { task: task["cell"] } : {}), obstructions: Object.freeze(["task-not-causally-discharged-and-accounted"]) });
  }
  const evidence = Object.freeze([...base.evidence, `work-view:${settled.view}`, `task-accounting:${settled.accounting}`]);
  const common = { task: settled.cell, settlement: settled.latest, expectedHead, paths, evidence };

  const commands = [];
  let observed;
  try {
    observed = headReading(root, commands);
  } catch (error) {
    return taskPublicationResult(root, "precondition", { ...common, obstructions: Object.freeze([`repository-unreadable:${boundedErrorMessage(error)}`]) });
  }
  if (observed.head === null) {
    return taskPublicationResult(root, "precondition", { ...common, obstructions: Object.freeze(["head-unreadable"]) });
  }

  const currentHead = observed.head;
  const pathSet = artifactId(paths);
  const trailers = Object.freeze([
    `MetroPlat-Task: ${settled.cell}`,
    `MetroPlat-Settlement: ${settled.latest}`,
    `MetroPlat-Expected-Head: ${expectedHead}`,
    `MetroPlat-Path-Set: ${pathSet}`,
  ]);
  const name = `node/settled-${settled.cell.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 48).replace(/-+$/u, "") || "task"}-${pathSet.replace(/[^a-z0-9]+/gu, "").slice(0, 8)}`;
  if (!candidateNameOk(name)) {
    return taskPublicationResult(root, "precondition", { ...common, obstructions: Object.freeze([`candidate-name-invalid:${name}`]) });
  }
  const carriesTrailers = (reference) => {
    try {
      const body = executeGitPlan(root, gitCommitPathsPlan.commitMessage(reference), commands).stdout;
      return trailers.every((trailer) => body.includes(trailer));
    } catch {
      return false;
    }
  };
  if (currentHead !== expectedHead && !carriesTrailers("HEAD")) {
    return taskPublicationResult(root, "precondition", { ...common, head: currentHead, obstructions: Object.freeze([`stale-head:${currentHead}`]) });
  }
  if (currentHead !== expectedHead) {
    return taskPublicationResult(root, "queued", { ...common, head: currentHead, replayed: true, obstructions: Object.freeze([]) });
  }

  const landed = commitGitPaths(binding, { paths: [...paths], message: `${message}\n\n${trailers.join("\n")}`, push: true, candidate: name });
  if (landed.phase !== "queued" && landed.phase !== "unchanged") {
    return taskPublicationResult(root, "stage", { ...common, head: currentHead, obstructions: Object.freeze(landed.obstructions.map((obstruction) => `commit-${landed.phase}:${obstruction}`)) });
  }
  // Nothing differs from origin/main: an earlier candidate of this cut was already integrated.
  if (landed.candidate === undefined) return taskPublicationResult(root, "queued", { ...common, head: currentHead, replayed: true, obstructions: Object.freeze([]) });
  return taskPublicationResult(root, "queued", { ...common, head: landed.head, candidate: landed.candidate, obstructions: Object.freeze([]) });
}

/**
 * Establish a new repository at `directory`, absent or empty: write `files` (`{ path, content,
 * executable? }`, repository-relative), initialize it on `main`, read its hooks from `hooksPath`
 * when named, and make the files its first commit when a `message` is named. The contents come
 * from the engines that own them; this operation only writes and records them. Without `apply` it
 * returns the establishment it would make and changes nothing.
 */
export function establishGitRepository({ directory, files = [], hooksPath, message, apply = false } = {}) {
  if (typeof directory !== "string" || directory.length === 0) throw new TypeError("repository establishment: name a directory");
  const root = path.resolve(directory);
  if (existsSync(root) && (!statSync(root).isDirectory() || readdirSync(root).length > 0)) throw new Error(`repository establishment: not an absent or empty directory: ${root}`);
  const plan = [gitEstablishmentPlan.init(), ...(hooksPath === undefined ? [] : [gitEstablishmentPlan.hooksPath(hooksPath)]),
    ...(message === undefined ? [] : [gitEstablishmentPlan.stageAll(), gitEstablishmentPlan.commit(message)])];
  const written = files.map(({ path: file, content, executable = false }) => {
    const target = path.resolve(root, file);
    if (typeof file !== "string" || !target.startsWith(`${root}${path.sep}`) || file.split(/[\\/]/u).some((segment) => segment === ".." || segment === ".git")) {
      throw new TypeError(`repository establishment: a file names one path inside the repository: ${file}`);
    }
    if (typeof content !== "string" && !(content instanceof Uint8Array)) throw new TypeError(`repository establishment: ${file} needs string or byte content`);
    return { file: path.relative(root, target).split(path.sep).join("/"), target, content, executable: executable === true };
  });
  const establishment = { type: "GitRepositoryEstablishment", repository: root, files: written.map(({ file }) => file), hooksPath, commands: plan.map((step) => `git ${step.arguments.join(" ")}`) };
  if (!apply) return Object.freeze({ ...establishment, applied: false });
  for (const { target, content, executable } of written) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, { mode: executable ? 0o755 : 0o644 });
  }
  const commands = [];
  for (const step of plan) executeGitPlan(root, step, commands);
  const commit = message === undefined ? undefined : readOid(executeGitPlan(root, gitRepositoryObservationPlan.head(), commands).stdout);
  return Object.freeze({ ...establishment, commit, applied: true });
}

/**
 * Register the clean repository at `path` inside the worktree `repository` as its submodule,
 * fetched from `url` (the child's origin when none is named) and pinned at the child's HEAD.
 * Refuses a `path` that is not its own repository's root, a child with changes, and a child with
 * no commit. Without `apply` it returns the registration it would make and changes nothing.
 */
export function registerGitSubmodule({ repository = process.cwd(), path: directory, url, apply = false } = {}) {
  const commands = [];
  const parent = executeGitPlan(repository, gitRepositoryObservationPlan.root(), commands).stdout.trim();
  const child = path.resolve(parent, directory ?? "");
  const relative = path.relative(parent, child).split(path.sep).join("/");
  if (relative === "" || relative.startsWith("../")) throw new TypeError("submodule registration: path names a directory inside the repository");
  const read = (step) => executeGitPlan(child, step, commands);
  if (read(gitRepositoryObservationPlan.root()).stdout.trim() !== child) throw new Error(`submodule registration: not a repository root: ${child}`);
  if (readPorcelainStatus(read(gitRepositoryObservationPlan.status({ untracked: "all" })).stdout).length > 0) throw new Error(`submodule registration: the child has changes: ${child}`);
  const head = read(gitRepositoryObservationPlan.head());
  if (head.status !== 0) throw new Error(`submodule registration: the child has no commit: ${child}`);
  const origin = read(gitRepositoryObservationPlan.remotes()).stdout.split("\n").includes("origin") ? read(gitRepositoryObservationPlan.remoteUrl("origin")).stdout.trim() : undefined;
  if ((url ?? origin) === undefined) throw new Error(`submodule registration: the child has no origin; name a url: ${child}`);
  const add = gitSubmodulePlan.add(url ?? origin, relative);
  const commit = readOid(head.stdout);
  const registration = { type: "GitSubmoduleRegistration", repository: parent, path: relative, url: url ?? origin, commit };
  if (!apply) return Object.freeze({ ...registration, applied: false });
  executeGitPlan(parent, add, commands);
  read(gitSubmodulePlan.detach(commit));
  return Object.freeze({ ...registration, applied: true });
}

/** Read worktree changes as status rows plus bounded diff summaries, via the house repository-observation operator. */
export function readGitWorkspaceChange(root) {
  const evidence = Object.freeze([
    "boundary:git-services-section/git-command-codec",
    "command:git status --porcelain=v1 -z",
    "command:git diff --stat",
    "command:git diff --name-status -z --no-renames",
  ]);
  let observed;
  try {
    observed = observeGitRepository({ repository: root, diff: true });
  } catch (error) {
    return Object.freeze({
      kind: "metroplat.git.workspace-change-readout",
      root,
      ok: false,
      dirty: false,
      files: Object.freeze([]),
      diffStat: Object.freeze([]),
      nameStatus: Object.freeze([]),
      stderr: boundedErrorMessage(error),
      evidence,
    });
  }
  const { status: files, diffStat, nameStatus } = observed;
  return Object.freeze({
    kind: "metroplat.git.workspace-change-readout",
    root,
    ok: true,
    dirty: files.length > 0 || diffStat.length > 0 || nameStatus.length > 0,
    files,
    diffStat,
    nameStatus,
    evidence,
  });
}

export function gitWorkspaceOperations(binding) {
  return Object.freeze([
    operation({
      verb: "workspace-change-readout",
      locus: DUTY_LOCUS,
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read git worktree changes for a workspace root.",
      description: "Domain: { duty?, scope?, id? }. duty reads that duty's open worktree; else scope/id package selects packageRoot when available; otherwise dataRoot.",
      run: (input) => {
        const record = inputRecord(input);
        const scope = typeof record["scope"] === "string"
          ? record["scope"]
          : typeof record["id"] === "string" ? record["id"] : undefined;
        const root = workspaceRootOf(binding, { ...record, scope });
        return root === undefined ? dutyWorktreeAbsence(record[DUTY_LOCUS]) : readGitWorkspaceChange(root);
      },
    }),
    operation({
      verb: "git-commit-paths",
      relation: "boundary",
      inputFormat: "json",
      outputFormat: "json",
      effects: {
        class: "external",
        replay: "non-idempotent",
        coordination: "compare-and-set",
        deterministic: "unmeasured",
        totality: "partial",
      },
      summary: "Commit exactly named Git paths and optionally integrate and publish origin/main.",
      description: "Domain: { paths, message, push?, dryRun? }. Paths are literal repository files, never .git metadata; a message claiming to decommission something must name it in a path. Refuses what porcelain commit would honour and a plumbing commit would skip (an operation in progress, unmerged entries, signing, commit hooks) and endpoints that are directories, behind symlinked directories, or inside nested repositories; dryRun stops there and reads the head. Uses a temporary index, resets only the named shared-index entries after commit, runs post-commit and reports it, refuses named local/remote overlap before committing, merge-trees an advanced origin/main, updates only merge-changed clean files, and never stages unnamed paths.",
      run: (input) => commitGitPaths(binding, input),
    }),
    operation({
      verb: "task-cut-publish",
      relation: "boundary",
      inputFormat: "json",
      outputFormat: "json",
      effects: {
        class: "external",
        replay: "idempotency-key",
        coordination: "coordination-free",
        deterministic: "unmeasured",
        totality: "partial",
      },
      summary: "Publish an exact main-branch Git cut facilitated by a causally discharged Task.",
      description: "Domain: { task: { cell, feed, date }, expectedHead, paths, message }. RPC standing authorizes the effect; the Task only proves readiness. The operation stages only the exact path set, commits with settlement trailers, pushes origin/main, and returns explicit partial-failure obstructions.",
      run: (input) => publishSettledTaskCut(binding, input),
    }),
  ]);
}

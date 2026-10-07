/**
 * @packageDocumentation
 *
 * The code-development engine's read-only Git observations of one repository: where HEAD is and
 * what its worktree changes, a bounded revision's commits, refs and tree, one path's commits, how
 * a revision's history relates to the annotated tags the repository holds, where its large-file
 * objects go, and its submodules; and, read from those, its commits as a causal light observation
 * and its worktree's dirtiness as evidence. Nothing here mutates a worktree, keeps a derived database, or
 * decides what a file means. Arguments and output decoding are git-services-section's codecs; every
 * command runs through the engine's one runner.
 */
import path from "node:path";

import { causalLightObservation } from "@red-cup-engineering/computing/holographic-compute";
import { evidence } from "@red-cup-engineering/signcell/cell";
import { walkPosixPathsSync } from "@red-cup-engineering/computer-filepath-engineering-services-section/walk-posix-paths";
import { gitRepositoryObservationPlan as plan, readCommits, readCount, readLfsCustomTransferAgents, readLfsEndpoint, readNameStatus, readPathCommits, readPorcelainStatus, readReferences, readTreeEntries } from "@red-cup-engineering/git-services-section/git-command-codec";
import { compareSubmodules, parseGitlinks, parseGitmodules } from "@red-cup-engineering/git-services-section/gitmodules";
import { coverOf } from "@red-cup-engineering/organizing/host-neutral-carriers";

import { executeGitPlan } from "./runner.mjs";

/** Where HEAD is: its branch and commit, each null when detached or unborn. */
export function headReading(repository, commands) {
  const branch = executeGitPlan(repository, plan.branch(), commands);
  const head = executeGitPlan(repository, plan.head(), commands);
  return Object.freeze({
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    head: head.status === 0 ? head.stdout.trim() : null,
  });
}

/**
 * Commits, as `readCommits` gives them, read as a causal light observation: each commit follows its
 * parents, the boundary is the commits and outside parents nothing in the window precedes, and a
 * commit graph, being acyclic, is always in causal order.
 */
export function commitLightObservation(commits) {
  return causalLightObservation(commits.map(({ id, parents }) => ({ id, parents })));
}

/** A worktree's dirtiness as evidence: told for, with the count of its porcelain status entries,
 *  when it has changes, and told against, with a count of zero, when it is clean. */
export function worktreeDirtiness(status) {
  const witness = Object.freeze({ reading: "git.working-tree-dirty", count: status.length });
  return status.length > 0 ? evidence({ for: [witness] }) : evidence({ against: [witness] });
}

/**
 * Observe one repository without changing it: its root, branch, HEAD (null when detached or
 * unborn), porcelain status entries, and, when `diff` is asked for, the unstaged
 * `diff --stat` lines and `diff --name-status` rows.
 */
export function observeGitRepository({ repository = process.cwd(), diff = false } = {}) {
  const commands = [];
  const run = (step) => executeGitPlan(repository, step, commands);
  const root = run(plan.root()).stdout.trim();
  const { branch, head } = headReading(repository, commands);
  const status = readPorcelainStatus(run(plan.status()).stdout);
  const base = { root, branch, head, clean: status.length === 0, status };
  if (!diff) return Object.freeze(base);
  const diffStat = run(plan.diffStat()).stdout.replace(/\n$/u, "");
  return Object.freeze({
    ...base,
    diffStat: Object.freeze(diffStat.length === 0 ? [] : diffStat.split("\n")),
    nameStatus: readNameStatus(run(plan.nameStatus()).stdout),
  });
}

/**
 * Observe a bounded revision as portable data: the commit `ref` names, HEAD's branch, up to
 * `maximumCommits` commits in topological order, every ref, and the revision's tree, refused past
 * `maximumPaths` entries. Blob ids witness file integrity; commit and ref ids keep history and
 * branch relations.
 */
export function observeGitHistory({ repository = process.cwd(), ref = "HEAD", maximumCommits = 1_000, maximumPaths = 100_000 } = {}) {
  const root = path.resolve(repository);
  const commands = [];
  const read = (step) => executeGitPlan(root, step, commands).stdout;
  return Object.freeze({
    type: "GitHistoryObservation",
    repository: root,
    ref,
    head: read(plan.commit(ref)).trim(),
    branch: headReading(root, commands).branch,
    commits: readCommits(read(plan.commits(ref, maximumCommits))),
    references: readReferences(read(plan.references())),
    tree: readTreeEntries(read(plan.tree(ref)), maximumPaths),
  });
}

/** Observe one path's history: its bounded commits, newest first, and the dates of the oldest and
 *  newest, each null when the path has none. */
export function observeGitPathHistory({ repository = process.cwd(), path: file, ref = "HEAD", maximumCommits = 10_000 } = {}) {
  const root = path.resolve(repository);
  const commits = readPathCommits(executeGitPlan(root, plan.pathCommits(ref, file, maximumCommits), []).stdout);
  return Object.freeze({
    type: "GitPathHistoryObservation",
    repository: root,
    ref,
    path: file,
    commits,
    createdAt: commits.at(-1)?.committedAt ?? null,
    modifiedAt: commits[0]?.committedAt ?? null,
  });
}

/**
 * Observe how a revision's history relates to the annotated tags the repository holds now: each
 * tag's object and commit and whether the revision reaches it, how many commits the revision and
 * the tags each reach, how many of the revision's commits no annotated tag reaches, and each local
 * branch's commit count. A tag ref is mutable, so this is an observation, never a release-policy
 * or permanence judgment.
 */
export function observeGitTagReachability({ repository = process.cwd(), ref = "HEAD" } = {}) {
  const commands = [];
  const root = path.resolve(executeGitPlan(repository, plan.root(), commands).stdout.trim());
  const read = (step) => executeGitPlan(root, step, commands).stdout;
  const head = read(plan.commit(ref)).trim();
  const tags = readReferences(read(plan.references("refs/tags"))).filter(({ type }) => type === "tag");
  const tagRefs = tags.map((tag) => tag.ref);
  const tagCommits = tags.length === 0 ? [] : read(plan.peeledCommits(tagRefs)).trim().split("\n");
  const reached = new Set(readReferences(read(plan.reachedTags(head))).map((tag) => tag.ref));
  const reachableCommitCount = readCount(read(plan.commitCount([ref])));
  return Object.freeze({
    type: "GitTagReachabilityObservation",
    repository: root,
    ref,
    head,
    branch: headReading(root, commands).branch,
    annotatedTags: Object.freeze(tags.map((tag, index) => Object.freeze({ name: tag.name, object: tag.object, commit: tagCommits[index], reachableFromRef: reached.has(tag.ref) }))),
    annotatedTagCommitCount: tags.length === 0 ? 0 : readCount(read(plan.commitCount(tagRefs))),
    reachableCommitCount,
    commitsOutsideAnnotatedTags: tags.length === 0 ? reachableCommitCount : readCount(read(plan.commitCount([ref], tagRefs))),
    localBranches: Object.freeze(readReferences(read(plan.references("refs/heads"))).map((branch) => Object.freeze({
      name: branch.name,
      reachableCommitCount: readCount(read(plan.commitCount([branch.ref]))),
    }))),
  });
}

/**
 * Observe where a repository's large-file objects go, keeping what this machine holds apart from
 * what a server was told: the endpoint git-lfs resolves and which setting chose it, the transfer
 * agents configured, the remotes, and the objects under the local LFS store. A local count was once
 * presented as an upload result; the shape and its warnings keep the two apart.
 */
export function observeGitLfsState({ repository = process.cwd() } = {}) {
  const commands = [];
  const run = (step) => executeGitPlan(repository, step, commands);
  const value = (key) => run(plan.configValue(key)).stdout.trim() || null;
  const directory = run(plan.gitDirectory());
  if (directory.status !== 0) throw new Error(`not a git repository: ${repository}`);
  const gitDir = directory.stdout.trim();
  const configuredUrl = value("lfs.url");
  const standaloneTransferAgent = value("lfs.standalonetransferagent");
  const remotes = run(plan.remotes()).stdout.split("\n").filter(Boolean);
  const originUrl = remotes.includes("origin") ? run(plan.remoteUrl("origin")).stdout.trim() || null : null;
  const endpointSource = configuredUrl ? "lfs.url" : originUrl ? "remote origin" : "none";
  const objects = path.join(gitDir, "lfs", "objects");
  const walk = walkPosixPathsSync({ root: objects, missing: "empty", unreadable: "skip", symlinks: "skip" });
  const warnings = [];
  if (standaloneTransferAgent) {
    warnings.push(`lfs.standalonetransferagent is set to "${standaloneTransferAgent}": git-lfs will bypass the server's transfer negotiation and upload nothing to it.`);
    if (/github\.com/u.test(originUrl ?? "")) warnings.push("origin is GitHub, which rejects a push whose pointers name objects its own LFS store does not hold (GH008). With a standalone agent set, that store never receives them.");
  }
  if (endpointSource === "remote origin" && /github\.com/u.test(originUrl)) {
    warnings.push("objects go to GitHub's LFS store, which is quota-bound; large binary corpora need a different destination before they are pushed.");
  }
  warnings.push(`localObjectStore counts files under ${objects} on this machine. It is not evidence that any object reached a server.`);
  return Object.freeze({
    type: "GitLfsStateObservation",
    repository,
    gitDir,
    endpoint: readLfsEndpoint(run(plan.lfsEnvironment()).stdout),
    endpointSource,
    configuredUrl,
    standaloneTransferAgent,
    customTransferAgents: readLfsCustomTransferAgents(run(plan.configValues("^lfs\\.customtransfer\\.")).stdout),
    remotes,
    originUrl,
    localObjectStore: Object.freeze({ count: walk.files.length, bytes: walk.files.reduce((total, file) => total + file.bytes, 0) }),
    warnings: Object.freeze(warnings),
  });
}

/**
 * Observe a worktree's submodules as its index records them: the `.gitmodules` declarations, the
 * gitlinks pinning each submodule's commit, the declarations with no gitlink and the gitlinks with
 * no declaration, the superprojects holding this worktree, nearest first, each one's index
 * holding the one before as a gitlink, and the submodules' cover: each declaration an open of its
 * path, URL and pinned commit, and every declaration without a gitlink or gitlink without a
 * declaration an obstruction counted in its H1.
 */
export function observeGitSubmodules({ repository = process.cwd() } = {}) {
  const commands = [];
  const root = executeGitPlan(repository, plan.root(), commands).stdout.trim();
  const file = executeGitPlan(root, plan.gitmodules(), commands);
  const declarations = file.status === 0 ? parseGitmodules(file.stdout) : Object.freeze([]);
  const gitlinks = parseGitlinks(executeGitPlan(root, plan.stage(), commands).stdout);
  const superprojects = [];
  for (let at = executeGitPlan(root, plan.superproject(), commands).stdout.trim(); at !== ""; at = executeGitPlan(at, plan.superproject(), commands).stdout.trim()) superprojects.push(at);
  const unmatched = compareSubmodules(declarations, gitlinks);
  const pins = new Map(gitlinks.map((entry) => [entry.path, entry.commit]));
  const opens = declarations.map((entry) => ({ id: entry.path, members: [entry.path, entry.url, ...(pins.has(entry.path) ? [pins.get(entry.path)] : [])], source: entry.url }));
  return Object.freeze({
    type: "GitSubmoduleObservation",
    repository: root,
    superprojects: Object.freeze(superprojects),
    declarations,
    gitlinks,
    ...unmatched,
    cover: coverOf(opens, { obstructions: unmatched.declarationsWithoutGitlink.length + unmatched.gitlinksWithoutDeclaration.length }),
  });
}

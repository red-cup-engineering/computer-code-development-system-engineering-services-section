import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { commitLightObservation, observeGitHistory, observeGitLfsState, observeGitPathHistory, observeGitRepository, observeGitSubmodules, observeGitTagReachability, worktreeDirtiness } from "../src/git/observation.mjs";
import { establishGitRepository, registerGitSubmodule } from "../src/git/operations.mjs";

const gitBin = "/usr/bin/git";

test("observeGitRepository reports branch, HEAD, and parsed porcelain status", async () => {
  const repository = await mkdtemp(join(tmpdir(), "observe-git-repository-"));
  try {
    git(repository, ["init", "-q", "-b", "main"]);
    await writeFile(join(repository, "tracked.txt"), "one\n");
    git(repository, ["add", "tracked.txt"]);
    git(repository, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"]);
    const clean = observeGitRepository({ repository });
    assert.equal(clean.branch, "main");
    assert.equal(clean.clean, true);
    assert.match(clean.head, /^[0-9a-f]{40}$/u);

    await writeFile(join(repository, "tracked.txt"), "two\n");
    const dirty = observeGitRepository({ repository });
    assert.equal(dirty.clean, false);
    assert.deepEqual(dirty.status, [{ status: " M", path: "tracked.txt" }]);
    assert.equal(dirty.diffStat, undefined);
    assert.equal(dirty.nameStatus, undefined);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitRepository reports diff --stat and diff --name-status when diff is requested", async () => {
  const repository = await mkdtemp(join(tmpdir(), "observe-git-repository-diff-"));
  try {
    git(repository, ["init", "-q", "-b", "main"]);
    await writeFile(join(repository, "tracked.txt"), "one\n");
    git(repository, ["add", "tracked.txt"]);
    git(repository, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"]);

    await writeFile(join(repository, "tracked.txt"), "one\ntwo\n");
    const observed = observeGitRepository({ repository, diff: true });
    assert.equal(observed.clean, false);
    assert.ok(observed.diffStat.some((line) => line.includes("tracked.txt")));
    assert.deepEqual(observed.nameStatus, [{ status: "M", path: "tracked.txt" }]);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

function git(cwd, args) {
  execFileSync(gitBin, args, { cwd, stdio: "ignore" });
}

test("observeGitRepository names a staged rename's source and reads a detached HEAD as no branch", async () => {
  const repository = await mkdtemp(join(tmpdir(), "observe-git-repository-rename-"));
  try {
    git(repository, ["init", "-q", "-b", "main"]);
    await writeFile(join(repository, "before name.txt"), "one\n");
    git(repository, ["add", "before name.txt"]);
    git(repository, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"]);
    git(repository, ["mv", "before name.txt", "after name.txt"]);
    assert.deepEqual(observeGitRepository({ repository }).status, [{ status: "R ", path: "after name.txt", source: "before name.txt" }]);

    git(repository, ["checkout", "-q", "--detach"]);
    const detached = observeGitRepository({ repository });
    assert.equal(detached.branch, null);
    assert.match(detached.head, /^[0-9a-f]{40}$/u);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitHistory reads a bounded revision's commits, refs and tree; observeGitPathHistory one path's dates", async () => {
  const repository = await mkdtemp(join(tmpdir(), "git-history-observation-"));
  try {
    const commit = (message) => git(repository, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qam", message]);
    git(repository, ["init", "-q", "-b", "main"]);
    await writeFile(join(repository, "a b.txt"), "one\n");
    await writeFile(join(repository, "other.txt"), "x\n");
    git(repository, ["add", "."]);
    commit("first");
    await writeFile(join(repository, "a b.txt"), "second\n");
    commit("second");
    const later = observeGitHistory({ repository, maximumCommits: 5 });
    assert.equal(later.type, "GitHistoryObservation");
    assert.equal(later.branch, "main");
    assert.deepEqual(later.commits.map(({ subject }) => subject), ["second", "first"]);
    assert.deepEqual(observeGitHistory({ repository, maximumCommits: 1 }).commits.map(({ subject }) => subject), ["second"]);
    assert.deepEqual(later.commits[0].parents, [later.commits[1].id]);
    assert.equal(later.head, later.commits[0].id);
    assert.deepEqual(later.references, [{ ref: "refs/heads/main", name: "main", type: "commit", object: later.head }]);
    assert.deepEqual(later.tree.map(({ path, bytes }) => ({ path, bytes })), [{ path: "a b.txt", bytes: 7 }, { path: "other.txt", bytes: 2 }]);
    assert.throws(() => observeGitHistory({ repository, maximumPaths: 1 }), RangeError);
    assert.throws(() => observeGitHistory({ repository, ref: "--all" }), /revision/u);

    const file = observeGitPathHistory({ repository, path: "a b.txt" });
    assert.equal(file.type, "GitPathHistoryObservation");
    assert.deepEqual(file.commits.map(({ id }) => id), later.commits.map(({ id }) => id));
    assert.equal(file.modifiedAt, file.commits[0].committedAt);
    assert.equal(file.createdAt, file.commits[1].committedAt);
    assert.deepEqual(observeGitPathHistory({ repository, path: "never.txt" }).commits, []);
    assert.equal(observeGitPathHistory({ repository, path: "never.txt" }).createdAt, null);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitTagReachability separates annotated-tag reachability from untagged commits", async () => {
  const repository = await mkdtemp(join(tmpdir(), "git-tag-reachability-"));
  try {
    const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"];
    git(repository, ["init", "-q", "-b", "main"]);
    await writeFile(join(repository, "record.txt"), "one\n");
    git(repository, ["add", "record.txt"]);
    git(repository, [...identity, "commit", "-qm", "first"]);
    git(repository, [...identity, "tag", "-a", "v1", "-m", "first release"]);
    git(repository, ["tag", "scratch"]);
    git(repository, ["checkout", "-q", "-b", "side"]);
    await writeFile(join(repository, "record.txt"), "side\n");
    git(repository, [...identity, "commit", "-qam", "side"]);
    git(repository, [...identity, "tag", "-a", "v2", "-m", "side release"]);
    git(repository, ["checkout", "-q", "main"]);
    await writeFile(join(repository, "record.txt"), "two\n");
    git(repository, [...identity, "commit", "-qam", "second"]);

    const observed = observeGitTagReachability({ repository });
    assert.equal(observed.type, "GitTagReachabilityObservation");
    assert.equal(observed.branch, "main");
    assert.equal(observed.reachableCommitCount, 2);
    assert.equal(observed.annotatedTagCommitCount, 2);
    assert.equal(observed.commitsOutsideAnnotatedTags, 1);
    assert.deepEqual(observed.annotatedTags.map(({ name, reachableFromRef }) => ({ name, reachableFromRef })), [{ name: "v1", reachableFromRef: true }, { name: "v2", reachableFromRef: false }]);
    assert.ok(observed.annotatedTags.every(({ object, commit }) => /^[0-9a-f]{40}$/u.test(object) && /^[0-9a-f]{40}$/u.test(commit) && object !== commit));
    assert.deepEqual(observed.localBranches, [{ name: "main", reachableCommitCount: 2 }, { name: "side", reachableCommitCount: 2 }]);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitLfsState names the endpoint's source, preferring lfs.url over origin", async () => {
  const repository = await mkdtemp(join(tmpdir(), "git-lfs-state-"));
  try {
    git(repository, ["init", "-q"]);
    const bare = observeGitLfsState({ repository });
    assert.equal(bare.type, "GitLfsStateObservation");
    assert.equal(bare.endpointSource, "none");
    assert.equal(bare.configuredUrl, null);
    assert.equal(bare.standaloneTransferAgent, null);
    assert.deepEqual(bare.remotes, []);
    git(repository, ["remote", "add", "origin", "git@github.com:example/example.git"]);
    assert.equal(observeGitLfsState({ repository }).endpointSource, "remote origin");
    assert.ok(observeGitLfsState({ repository }).warnings.some((warning) => warning.includes("quota-bound")));
    git(repository, ["config", "lfs.url", "https://lfs.example.invalid/objects"]);
    const configured = observeGitLfsState({ repository });
    assert.equal(configured.endpointSource, "lfs.url");
    assert.equal(configured.configuredUrl, "https://lfs.example.invalid/objects");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitLfsState reports a standalone agent against GitHub as the push-blocking condition", async () => {
  const repository = await mkdtemp(join(tmpdir(), "git-lfs-state-"));
  try {
    git(repository, ["init", "-q"]);
    git(repository, ["remote", "add", "origin", "git@github.com:example/example.git"]);
    git(repository, ["config", "lfs.standalonetransferagent", "r2-example"]);
    git(repository, ["config", "lfs.customtransfer.r2-example.path", "/nonexistent/agent.mjs"]);
    git(repository, ["config", "lfs.customtransfer.r2-example.concurrent", "false"]);
    git(repository, ["config", "lfs.customtransfer.dotted.agent.path", "/nonexistent/other.mjs"]);
    const state = observeGitLfsState({ repository });
    assert.equal(state.standaloneTransferAgent, "r2-example");
    assert.deepEqual(state.customTransferAgents, ["r2-example", "dotted.agent"]);
    assert.ok(state.warnings.some((warning) => warning.includes("bypass")));
    assert.ok(state.warnings.some((warning) => warning.includes("GH008")));
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitLfsState counts the local object store from disk and labels it local only", async () => {
  const repository = await mkdtemp(join(tmpdir(), "git-lfs-state-"));
  try {
    git(repository, ["init", "-q"]);
    assert.deepEqual(observeGitLfsState({ repository }).localObjectStore, { count: 0, bytes: 0 });
    const objects = join(repository, ".git", "lfs", "objects", "ab", "cd");
    await mkdir(objects, { recursive: true });
    await writeFile(join(objects, "abcd0001"), "x".repeat(1000));
    await writeFile(join(objects, "abcd0002"), "y".repeat(2000));
    const state = observeGitLfsState({ repository });
    assert.deepEqual(state.localObjectStore, { count: 2, bytes: 3000 });
    // A local count must never read as an upload result.
    assert.ok(state.warnings.some((warning) => warning.includes("not evidence that any object reached a server")));
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("observeGitLfsState refuses a directory that is not a repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "git-lfs-state-plain-"));
  try {
    assert.throws(() => observeGitLfsState({ repository: directory }), /not a git repository/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a clean nested repository registers as a submodule in place, and both sides observe it", async () => {
  const parent = await mkdtemp(join(tmpdir(), "git-submodules-"));
  const child = join(parent, "vendor", "child");
  const commit = (cwd) => git(cwd, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"]);
  try {
    git(parent, ["init", "-q", "-b", "main"]);
    await writeFile(join(parent, "README"), "parent\n");
    git(parent, ["add", "README"]);
    commit(parent);
    await mkdir(child, { recursive: true });
    git(child, ["init", "-q", "-b", "main"]);
    await writeFile(join(child, "README"), "child\n");
    git(child, ["add", "README"]);
    commit(child);

    assert.throws(() => registerGitSubmodule({ repository: parent, path: "vendor/child" }), /no origin/u);
    assert.throws(() => registerGitSubmodule({ repository: parent, path: "vendor" }), /not a repository root/u);
    git(child, ["remote", "add", "origin", "https://example.invalid/child.git"]);
    await writeFile(join(child, "scratch"), "x\n");
    assert.throws(() => registerGitSubmodule({ repository: parent, path: "vendor/child" }), /has changes/u);
    await rm(join(child, "scratch"));

    const planned = registerGitSubmodule({ repository: parent, path: "vendor/child" });
    assert.equal(planned.applied, false);
    assert.equal(planned.url, "https://example.invalid/child.git");
    assert.match(planned.commit, /^[0-9a-f]{40}$/u);
    assert.deepEqual(observeGitSubmodules({ repository: parent }).gitlinks, []);

    assert.equal(registerGitSubmodule({ repository: parent, path: "vendor/child", apply: true }).applied, true);
    const observed = observeGitSubmodules({ repository: parent });
    assert.deepEqual(observed.declarations.map(({ path, url }) => ({ path, url })), [{ path: "vendor/child", url: "https://example.invalid/child.git" }]);
    assert.deepEqual(observed.gitlinks.map(({ path, commit: pin }) => ({ path, pin })), [{ path: "vendor/child", pin: planned.commit }]);
    assert.deepEqual([observed.declarationsWithoutGitlink, observed.gitlinksWithoutDeclaration, observed.superprojects], [[], [], []]);
    assert.deepEqual(observed.cover.opens, [{ id: "vendor/child", members: ["vendor/child", "https://example.invalid/child.git", planned.commit], source: "https://example.invalid/child.git" }]);
    assert.deepEqual([observed.cover.h1, observed.cover.coordinationFree], [0, true]);
    assert.deepEqual(observeGitSubmodules({ repository: child }).superprojects, [observed.repository]);

    git(parent, ["update-index", "--add", "--cacheinfo", `160000,${planned.commit},orphan`]);
    const orphaned = observeGitSubmodules({ repository: parent });
    assert.deepEqual(orphaned.gitlinksWithoutDeclaration.map((entry) => entry.path), ["orphan"]);
    assert.deepEqual([orphaned.cover.h1, orphaned.cover.coordinationFree], [1, false]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("commits read as a causal light observation: parents are arrows in, roots the boundary, and a cycle breaks the order", () => {
  const observed = commitLightObservation([
    { id: "c3", parents: ["c1", "c2"] },
    { id: "c2", parents: ["c1"] },
    { id: "c1", parents: [] },
  ]);
  assert.deepEqual(observed.nodes, ["c1", "c2", "c3"]);
  assert.deepEqual(observed.boundaryHashes, ["c1"]);
  assert.equal(observed.causalOrder, true);
  assert.equal(observed.h1, 0);
  assert.equal(commitLightObservation([{ id: "a", parents: ["b"] }, { id: "b", parents: ["a"] }]).h1, 1);
});

test("a worktree's dirtiness is evidence for while it has changes and against while it is clean", () => {
  assert.deepEqual(worktreeDirtiness([{ status: " M", path: "a" }, { status: "??", path: "b" }]), { for: [{ reading: "git.working-tree-dirty", count: 2 }], against: [] });
  assert.deepEqual(worktreeDirtiness([]), { for: [], against: [{ reading: "git.working-tree-dirty", count: 0 }] });
});

test("a repository is established from written files on main, with versioned hooks and a first commit", async () => {
  const parent = await mkdtemp(join(tmpdir(), "git-establishment-"));
  const directory = join(parent, "child");
  const files = [
    { path: "README.md", content: "child\n" },
    { path: ".githooks/pre-commit", content: "#!/bin/sh\nexit 0\n", executable: true },
  ];
  try {
    const planned = establishGitRepository({ directory, files, hooksPath: ".githooks", message: "Start the child" });
    assert.equal(planned.applied, false);
    assert.deepEqual(planned.files, ["README.md", ".githooks/pre-commit"]);
    assert.deepEqual(planned.commands, ["git init --quiet --initial-branch=main", "git config core.hooksPath .githooks", "git add --all", "git commit --quiet --file=-"]);
    assert.throws(() => establishGitRepository({ directory, files: [{ path: "../escape", content: "" }] }), /inside the repository/u);

    const established = establishGitRepository({ directory, files, hooksPath: ".githooks", message: "Start the child", apply: true });
    assert.equal(established.applied, true);
    assert.equal(established.commit, gitRead(directory, ["rev-parse", "HEAD"]).trim());
    assert.equal(gitRead(directory, ["symbolic-ref", "--short", "HEAD"]).trim(), "main");
    assert.equal(gitRead(directory, ["config", "core.hooksPath"]).trim(), ".githooks");
    assert.equal(gitRead(directory, ["ls-files", "-s", ".githooks/pre-commit"]).split(" ")[0], "100755");
    assert.equal(gitRead(directory, ["show", "-s", "--format=%s"]).trim(), "Start the child");
    assert.throws(() => establishGitRepository({ directory, files, apply: true }), /absent or empty/u);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

function gitRead(cwd, args) {
  return execFileSync(gitBin, args, { cwd, encoding: "utf8" });
}

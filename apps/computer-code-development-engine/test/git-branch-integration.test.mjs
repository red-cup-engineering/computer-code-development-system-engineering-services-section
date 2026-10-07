import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { integrateGitBranch } from "../src/git/operations.mjs";

function git(root, ...arguments_) {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, name, text) {
  writeFileSync(path.join(root, name), text);
}

function fixture() {
  const parent = mkdtempSync(path.join(tmpdir(), "git-branch-integration-"));
  const origin = path.join(parent, "origin.git");
  const seed = path.join(parent, "seed");
  const shared = path.join(parent, "shared");
  git(parent, "init", "--bare", "--initial-branch=main", origin);
  git(parent, "init", "--initial-branch=main", seed);
  git(seed, "config", "user.email", "house@example.invalid");
  git(seed, "config", "user.name", "House");
  for (const name of ["clean.txt", "local.txt", "conflict.txt"]) write(seed, name, "base\n");
  git(seed, "add", ".");
  git(seed, "commit", "-m", "base");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-u", "origin", "main");
  git(parent, "clone", origin, shared);
  for (const repository of [shared, seed]) {
    git(repository, "config", "user.email", "house@example.invalid");
    git(repository, "config", "user.name", "House");
  }
  return { parent, origin, seed, shared };
}

test("integrates a reviewed origin contribution without a local branch and preserves another writer's edit", () => {
  const setup = fixture();
  try {
    write(setup.seed, "local.txt", "first\nmiddle\nlast\n");
    git(setup.seed, "commit", "-am", "three lines");
    git(setup.seed, "push", "origin", "main");
    git(setup.shared, "pull", "-q", "origin", "main");
    const slot = setup.seed;
    git(slot, "checkout", "-b", "team-lead/task-one");
    write(slot, "clean.txt", "from task\n");
    write(slot, "local.txt", "first\nmiddle\nlast from task\n");
    git(slot, "add", ".");
    git(slot, "commit", "-m", "task trace");
    const acceptedHead = git(slot, "rev-parse", "HEAD");
    git(slot, "push", "origin", "team-lead/task-one");
    write(setup.shared, "local.txt", "first from another writer\nmiddle\nlast\n");

    const result = integrateGitBranch({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      branch: "team-lead/task-one", source: "origin", expectedBranchHead: acceptedHead, message: "Integrate task one",
    });

    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.branchHead, acceptedHead);
    assert.equal(git(setup.shared, "for-each-ref", "--format=%(refname)", "refs/heads/team-lead/task-one"), "");
    assert.equal(readFileSync(path.join(setup.shared, "clean.txt"), "utf8"), "from task\n");
    assert.equal(readFileSync(path.join(setup.shared, "local.txt"), "utf8"), "first from another writer\nmiddle\nlast from task\n");
    assert.deepEqual(result.refreshedPaths, ["clean.txt"]);
    assert.deepEqual(result.mergedPaths, ["local.txt"]);
    // the other writer's edit, and only it, remains as the working tree's difference from HEAD
    assert.equal(git(setup.shared, "diff", "--cached", "--name-only"), "");
    assert.match(git(setup.shared, "diff", "--", "local.txt"), /^\+first from another writer$/mu);
    assert.doesNotMatch(git(setup.shared, "diff", "--", "local.txt"), /^[-+]last/mu);
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0]);
    assert.equal(git(setup.shared, "rev-list", "--parents", "-n", "1", "HEAD").split(/\s+/u).length, 3);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("a local edit that conflicts with the branch leaves the shared tree and HEAD alone", () => {
  const setup = fixture();
  try {
    const slot = path.join(setup.parent, "slot");
    git(setup.shared, "worktree", "add", "-b", "codex/task-two", slot, "main");
    write(slot, "local.txt", "from task\n");
    git(slot, "add", ".");
    git(slot, "commit", "-m", "task trace");
    write(setup.shared, "local.txt", "another writer\n");
    const headBefore = git(setup.shared, "rev-parse", "HEAD");

    const result = integrateGitBranch({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      branch: "codex/task-two", message: "Integrate task two",
    });

    assert.equal(result.ok, false);
    assert.equal(result.phase, "refresh");
    assert.deepEqual(result.obstructions, ["origin-change-has-local-edit:local.txt"]);
    assert.equal(readFileSync(path.join(setup.shared, "local.txt"), "utf8"), "another writer\n");
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), headBefore);
    assert.equal(git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0], result.mergeCommit);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("refuses a conflicting Codex branch without changing main or its worktree", () => {
  const setup = fixture();
  try {
    const slot = path.join(setup.parent, "slot");
    git(setup.shared, "worktree", "add", "-b", "codex/conflict", slot, "main");
    write(slot, "conflict.txt", "task version\n");
    git(slot, "add", "conflict.txt");
    git(slot, "commit", "-m", "conflicting task trace");
    write(setup.seed, "conflict.txt", "origin version\n");
    git(setup.seed, "add", "conflict.txt");
    git(setup.seed, "commit", "-m", "origin changes conflict");
    git(setup.seed, "push", "origin", "main");
    const headBefore = git(setup.shared, "rev-parse", "HEAD");
    const bytesBefore = readFileSync(path.join(setup.shared, "conflict.txt"));
    const originBefore = git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0];

    const result = integrateGitBranch({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      branch: "codex/conflict", message: "Must conflict",
    });

    assert.equal(result.ok, false);
    assert.equal(result.phase, "integrate");
    assert.deepEqual(result.conflicts, ["conflict.txt"]);
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), headBefore);
    assert.deepEqual(readFileSync(path.join(setup.shared, "conflict.txt")), bytesBefore);
    assert.equal(git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0], originBefore);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("refuses an origin branch that moved from the reviewed head, leaving origin/main alone", () => {
  const setup = fixture();
  try {
    const slot = setup.seed;
    git(slot, "checkout", "-b", "fix/pinned");
    write(slot, "clean.txt", "accepted\n");
    git(slot, "commit", "-am", "accepted trace");
    const acceptedHead = git(slot, "rev-parse", "HEAD");
    write(slot, "clean.txt", "after acceptance\n");
    git(slot, "commit", "-am", "later trace");
    git(slot, "push", "origin", "fix/pinned");
    const originBefore = git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0];

    const result = integrateGitBranch({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      branch: "fix/pinned", source: "origin", message: "Join the accepted trace", expectedBranchHead: acceptedHead,
    });

    assert.equal(result.ok, false);
    assert.equal(result.phase, "precondition");
    assert.deepEqual(result.obstructions, ["branch-moved-from-expected-head"]);
    assert.equal(result.expectedBranchHead, acceptedHead);
    assert.equal(result.branchHead, git(slot, "rev-parse", "HEAD"));
    assert.equal(git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0], originBefore);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

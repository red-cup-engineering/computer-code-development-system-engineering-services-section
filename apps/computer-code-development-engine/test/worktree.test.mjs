import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync, chmodSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { commitWorktree, integrateWorktree, prepareWorktree, publishWorktreeBranch, removeWorktree, worktreeChanges, WORKTREE_PNPM, worktreeDirty } from "../src/workspace/worktree.mjs";

function git(root, ...arguments_) {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function fixture() {
  const parent = mkdtempSync(path.join(tmpdir(), "worktree-lifecycle-"));
  const origin = path.join(parent, "origin.git");
  const shared = path.join(parent, "shared");
  git(parent, "init", "--bare", "--initial-branch=main", origin);
  git(parent, "clone", origin, shared);
  git(shared, "config", "user.email", "house@example.invalid");
  git(shared, "config", "user.name", "House");
  writeFileSync(path.join(shared, "base.txt"), "base\n");
  git(shared, "add", ".");
  git(shared, "commit", "-m", "base");
  git(shared, "push", "-u", "origin", "HEAD:main");
  return { parent, origin, shared };
}

test("a worktree is prepared from origin/main, committed on its branch, published, joined and removed", async (context) => {
  const setup = fixture();
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const workspace = path.join(setup.parent, "worktrees", "duty-a");
  const prepared = await prepareWorktree({ repository: setup.shared, workspace, branch: "duty/a", install: false });
  assert.deepEqual(prepared, { workspace, branch: "duty/a" });
  assert.equal(await commitWorktree({ workspace, message: ["nothing yet"] }), undefined);

  writeFileSync(path.join(workspace, "change.txt"), "the worker's change\n");
  git(workspace, "config", "user.email", "worker@example.invalid");
  git(workspace, "config", "user.name", "Worker");
  const commit = await commitWorktree({ workspace, message: ["Write the change", "Duty a"] });
  assert.match(commit, /^[0-9a-f]{40}$/u);
  assert.equal(git(workspace, "show", "-s", "--format=%B", commit), "Write the change\n\nDuty a");
  assert.deepEqual(await worktreeChanges({ workspace, branch: "duty/a" }), [{ status: "A", path: "change.txt" }]);

  // Publishing leaves main alone; the branch waits on origin for its receiver.
  assert.deepEqual(await publishWorktreeBranch({ workspace, branch: "duty/a" }), { branch: "duty/a", head: commit });
  assert.match(git(setup.shared, "ls-remote", "origin", "refs/heads/duty/a"), new RegExp(commit, "u"));
  assert.doesNotMatch(git(setup.shared, "ls-remote", "origin", "refs/heads/main"), new RegExp(commit, "u"));

  // Origin moves meanwhile; joining rebases and names a candidate, leaving main to the queue.
  writeFileSync(path.join(setup.shared, "other.txt"), "another writer\n");
  git(setup.shared, "add", "other.txt");
  git(setup.shared, "commit", "-m", "other");
  git(setup.shared, "push", "origin", "HEAD:main");
  const joined = await integrateWorktree({ workspace, stranded: "duty/stranded/a" });
  assert.equal(joined.stranded, undefined);
  assert.equal(joined.queued, true);
  assert.equal(joined.candidate.commit, joined.head);
  assert.equal(git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s/u)[0], git(setup.shared, "rev-parse", "HEAD"));
  assert.equal(git(workspace, "rev-parse", `refs/queue/${joined.candidate.name}^{}`), joined.head);

  await removeWorktree({ repository: setup.shared, workspace, branch: "duty/a" });
  assert.equal(existsSync(workspace), false);
  assert.equal(spawnSync("git", ["rev-parse", "--verify", "refs/heads/duty/a"], { cwd: setup.shared }).status, 128);
});

test("a conflicting join leaves main unchanged and strands the work on origin", async (context) => {
  const setup = fixture();
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const workspace = path.join(setup.parent, "worktrees", "duty-b");
  await prepareWorktree({ repository: setup.shared, workspace, branch: "duty/b", install: false });
  git(workspace, "config", "user.email", "worker@example.invalid");
  git(workspace, "config", "user.name", "Worker");
  writeFileSync(path.join(workspace, "base.txt"), "the worker's base\n");
  await commitWorktree({ workspace, message: ["Rewrite base"] });
  writeFileSync(path.join(setup.shared, "base.txt"), "another writer's base\n");
  git(setup.shared, "commit", "-am", "other base");
  git(setup.shared, "push", "origin", "HEAD:main");
  const main = git(setup.shared, "rev-parse", "HEAD");

  assert.deepEqual(await integrateWorktree({ workspace, stranded: "duty/stranded/b" }), { stranded: "duty/stranded/b" });
  assert.equal(git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s/u)[0], main);
  assert.match(git(setup.shared, "ls-remote", "origin", "refs/heads/duty/stranded/b"), /duty\/stranded\/b/u);
});


test("package linking preserves tracked bin modes and bytes even when linking fails", async context => {
  const { executeJavascriptNodeCommandAsynchronously } = await import("@red-cup-engineering/execute-javascript-node-command-service/asynchronously");
  for (const status of [0, 1]) {
    const setup = fixture();
    context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
    writeFileSync(path.join(setup.shared, "package.json"), JSON.stringify({ name: "fixture-bin", bin: "cli.mjs" }));
    const source = "#!/usr/bin/env node\nconsole.log('source');\n";
    writeFileSync(path.join(setup.shared, "cli.mjs"), source, { mode: 0o644 });
    git(setup.shared, "add", "."); git(setup.shared, "commit", "-m", "tracked bin"); git(setup.shared, "push", "origin", "HEAD:main");
    const workspace = path.join(setup.parent, "duty-bin");
    const runner = (request, policy) => {
      if (request.command !== WORKTREE_PNPM) return executeJavascriptNodeCommandAsynchronously(request, policy);
      chmodSync(path.join(workspace, "cli.mjs"), 0o755);
      return Promise.resolve({ result: { status, signal: null, stdout: "", stderr: "fixture linking", error: "" } });
    };
    const preparing = prepareWorktree({ repository: setup.shared, workspace, branch: "duty/bin", runner });
    if (status === 0) await preparing; else await assert.rejects(preparing);
    assert.equal(statSync(path.join(workspace, "cli.mjs")).mode & 0o777, 0o644);
    assert.equal(readFileSync(path.join(workspace, "cli.mjs"), "utf8"), source);
    assert.equal(await worktreeDirty({ workspace }), false);
  }
});

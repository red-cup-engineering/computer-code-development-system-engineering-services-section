import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { integrateGitBranch } from "../src/git/operations.mjs";
import { relocateTrackedDirectory, transactDirectoryRelocations } from "../src/workspace/relocation.mjs";

function git(root, ...arguments_) {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, file, text) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
}

function clone(parent, origin, name) {
  const root = path.join(parent, name);
  git(parent, "clone", "-q", origin, root);
  git(root, "config", "user.email", "house@example.invalid");
  git(root, "config", "user.name", "House");
  return root;
}

function fixture(files, context) {
  const parent = mkdtempSync(path.join(tmpdir(), "directory-relocation-"));
  context.after(() => rmSync(parent, { recursive: true, force: true }));
  const origin = path.join(parent, "origin.git");
  git(parent, "init", "-q", "--bare", "--initial-branch=main", origin);
  const shared = clone(parent, origin, "shared");
  for (const [file, text] of Object.entries(files)) write(shared, file, text);
  git(shared, "add", ".");
  git(shared, "commit", "-qm", "base");
  git(shared, "push", "-q", "origin", "HEAD:main");
  return { parent, origin, shared, environment: { ...process.env, METROPLAT_TRANSACTION_WORKTREES: path.join(parent, "transactions") } };
}

const originMain = (setup) => git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s/u)[0];

test("a batch of relocations lands on origin/main as one transaction and refreshes the shared checkout", async (context) => {
  const setup = fixture({ "one/a.md": "a\n", "two/b.md": "b\n" }, context);
  const before = originMain(setup);
  const result = await transactDirectoryRelocations({ repository: setup.shared, moves: [{ from: "one", to: "moved-one" }, { from: "two", to: "moved-two" }], message: "Relocate one and two", environment: setup.environment });

  assert.equal(result.committed, true);
  assert.equal(result.landing.ok, true, JSON.stringify(result.landing.obstructions));
  assert.deepEqual(result.accepted.map((move) => move.from), ["one", "two"]);
  assert.deepEqual(result.refused, []);
  assert.notEqual(originMain(setup), before);
  assert.equal(existsSync(path.join(setup.shared, "one")), false);
  assert.equal(readFileSync(path.join(setup.shared, "moved-one", "a.md"), "utf8"), "a\n");
  assert.equal(readFileSync(path.join(setup.shared, "moved-two", "b.md"), "utf8"), "b\n");
  assert.equal(git(setup.shared, "worktree", "list").split("\n").length, 1);
  assert.equal(git(setup.shared, "branch", "--list", "transaction/*"), "");
});

test("a colliding move is refused while the rest of the batch lands", async (context) => {
  const setup = fixture({ "one/a.md": "a\n", "two/a.md": "different a\n", "three/c.md": "c\n" }, context);
  const result = await transactDirectoryRelocations({ repository: setup.shared, moves: [{ from: "one", to: "two" }, { from: "three", to: "moved-three" }], message: "Relocate three; one collides with two", environment: setup.environment });

  assert.equal(result.committed, true);
  assert.deepEqual(result.accepted.map((move) => move.from), ["three"]);
  assert.deepEqual(result.refused.map((move) => move.from), ["one"]);
  assert.match(result.refused[0].reason, /destination-path-collision/u);
  assert.equal(readFileSync(path.join(setup.shared, "one", "a.md"), "utf8"), "a\n");
  assert.equal(readFileSync(path.join(setup.shared, "two", "a.md"), "utf8"), "different a\n");
  assert.equal(readFileSync(path.join(setup.shared, "moved-three", "c.md"), "utf8"), "c\n");
});

test("the transaction lands on origin/main after another writer advanced it", async (context) => {
  const setup = fixture({ "one/a.md": "a\n", "unrelated.md": "u\n" }, context);
  const other = clone(setup.parent, setup.origin, "other");
  const land = (request) => {
    write(other, "unrelated.md", "u2\n");
    git(other, "commit", "-qam", "concurrent unrelated change");
    git(other, "push", "-q", "origin", "HEAD:main");
    return integrateGitBranch({ packageRoot: request.repository }, { branch: request.branch, message: request.message });
  };
  const result = await transactDirectoryRelocations({ repository: setup.shared, moves: [{ from: "one", to: "moved-one" }], message: "Relocate one", land, environment: setup.environment });

  assert.equal(result.landing.ok, true, JSON.stringify(result.landing.obstructions));
  assert.equal(readFileSync(path.join(setup.shared, "moved-one", "a.md"), "utf8"), "a\n");
  assert.equal(readFileSync(path.join(setup.shared, "unrelated.md"), "utf8"), "u2\n");
});

test("relocation refuses the shared checkout, and a dry run changes nothing", async (context) => {
  const setup = fixture({ "one/a.md": "a\n" }, context);
  await assert.rejects(relocateTrackedDirectory({ workspace: setup.shared, from: "one", to: "moved-one" }), /linked Git worktree/u);
  assert.equal(existsSync(path.join(setup.shared, "one", "a.md")), true);

  const before = originMain(setup);
  const result = await transactDirectoryRelocations({ repository: setup.shared, moves: [{ from: "one", to: "moved-one" }], message: "Plan one", dryRun: true, environment: setup.environment });
  assert.equal(result.committed, false);
  assert.equal(result.reason, "dry-run");
  assert.deepEqual(result.accepted.map((move) => move.from), ["one"]);
  assert.equal(originMain(setup), before);
  assert.equal(existsSync(path.join(setup.shared, "moved-one")), false);
});

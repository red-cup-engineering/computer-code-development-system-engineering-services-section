import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

import { commitGitPaths } from "../src/git/operations.mjs";

function git(root, ...arguments_) {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, name, text) {
  writeFileSync(path.join(root, name), text);
}

function fixture() {
  const parent = mkdtempSync(path.join(tmpdir(), "git-commit-paths-receiving-"));
  const origin = path.join(parent, "origin.git");
  const seed = path.join(parent, "seed");
  const shared = path.join(parent, "shared");
  const writer = path.join(parent, "writer");
  git(parent, "init", "--bare", "--initial-branch=main", origin);
  git(parent, "init", "--initial-branch=main", seed);
  git(seed, "config", "user.email", "house@example.invalid");
  git(seed, "config", "user.name", "House");
  for (const name of ["named.txt", "staged.txt", "tree.txt", "remote.txt"]) write(seed, name, "base\n");
  write(seed, "overlap.txt", "first\nmiddle\nlast\n");
  write(seed, "package.json", JSON.stringify({ name: "fixture", dependencies: { "fixture-dependency": "1.0.0" } }, null, 2) + "\n");
  write(seed, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n\nimporters:\n  .:\n    dependencies:\n      fixture-dependency:\n        specifier: 1.0.0\n        version: 1.0.0\n\npackages:\n  fixture-dependency@1.0.0: {}\n");
  git(seed, "add", ".");
  git(seed, "commit", "-m", "base");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-u", "origin", "main");
  git(parent, "clone", origin, shared);
  git(parent, "clone", origin, writer);
  for (const repository of [shared, writer]) {
    git(repository, "config", "user.email", "house@example.invalid");
    git(repository, "config", "user.name", "House");
  }
  return { parent, origin, shared, writer };
}

test("receiving: pnpm duplicate dependency names compare once with dependency precedence", () => {
  const setup = fixture();
  try {
    write(setup.shared, "package.json", JSON.stringify({
      name: "fixture",
      dependencies: { "fixture-dependency": "1.0.0" },
      devDependencies: { "fixture-dependency": "9.0.0" },
    }, null, 2) + "\n");
    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["package.json"], message: "Check duplicate dependency semantics", push: false,
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: an auto-installed peer recorded under dependencies passes", () => {
  const setup = fixture();
  try {
    write(setup.shared, "package.json", JSON.stringify({
      name: "fixture",
      dependencies: { "fixture-dependency": "1.0.0" },
      peerDependencies: { "auto-peer": "1.0.0" },
    }, null, 2) + "\n");
    write(setup.shared, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n\nimporters:\n  .:\n    dependencies:\n      auto-peer:\n        specifier: 1.0.0\n        version: 1.0.0\n      fixture-dependency:\n        specifier: 1.0.0\n        version: 1.0.0\n\npackages:\n  auto-peer@1.0.0: {}\n  fixture-dependency@1.0.0: {}\n");
    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["package.json", "pnpm-lock.yaml"], message: "Check auto-installed peer semantics", push: false,
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a peer that is not installed is allowed", () => {
  const setup = fixture();
  try {
    write(setup.shared, "package.json", JSON.stringify({
      name: "fixture",
      dependencies: { "fixture-dependency": "1.0.0" },
      peerDependencies: { "optional-peer": "1.0.0" },
    }, null, 2) + "\n");
    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["package.json"], message: "Check uninstalled peer semantics", push: false,
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a lockfile named alone is read against the manifests HEAD commits", () => {
  const setup = fixture();
  try {
    write(setup.shared, "package.json", JSON.stringify({
      name: "fixture",
      description: "Ünïcødé so bodies are counted in bytes",
      dependencies: { "fixture-dependency": "1.0.0" },
    }, null, 2) + "\n");
    git(setup.shared, "commit", "-q", "-m", "describe", "--", "package.json");
    mkdirSync(path.join(setup.shared, "uncommitted"));
    write(setup.shared, "uncommitted/package.json", JSON.stringify({ name: "uncommitted" }) + "\n");
    write(setup.shared, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n\nimporters:\n  .: {}\n  uncommitted: {}\n\npackages: {}\n");
    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["pnpm-lock.yaml"], message: "Refuse a lockfile the committed manifests disagree with", push: false,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.obstructions, [
      "lockfile-importer-mismatch:.:missing:fixture-dependency",
      "lockfile-importer-mismatch:uncommitted:missing:package-json",
    ]);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: unchanged foreign importers do not own a publication cut", () => {
  const setup = fixture();
  try {
    const lock = readFileSync(path.join(setup.shared, "pnpm-lock.yaml"), "utf8")
      .replace("\npackages:", "\n  foreign-repository: {}\n\npackages:");
    write(setup.shared, "pnpm-lock.yaml", lock);
    git(setup.shared, "add", "pnpm-lock.yaml");
    git(setup.shared, "commit", "-q", "-m", "retain existing foreign importer");
    write(setup.shared, "package.json", JSON.stringify({ name: "fixture", dependencies: {
      "fixture-dependency": "1.0.0", "new-dependency": "1.0.0",
    } }) + "\n");
    write(setup.shared, "pnpm-lock.yaml", lock.replace("\n  foreign-repository:",
      "\n      new-dependency:\n        specifier: 1.0.0\n        version: 1.0.0\n  foreign-repository:"));
    const result = commitGitPaths({ packageRoot: setup.shared }, {
      paths: ["package.json", "pnpm-lock.yaml"], message: "Publish the changed importer", push: false,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(git(setup.shared, "show", "HEAD:pnpm-lock.yaml").includes("foreign-repository: {}"), true);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a new manifest dependency not in the lockfile is refused", () => {
  const setup = fixture();
  try {
    write(setup.shared, "package.json", JSON.stringify({
      name: "fixture",
      dependencies: { "fixture-dependency": "1.0.0", "new-dependency": "1.0.0" },
    }, null, 2) + "\n");
    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["package.json"], message: "Refuse lockfile drift", push: false,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.obstructions, ["lockfile-importer-mismatch:.:missing:new-dependency"]);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: exact paths preserve other writers and merge an advanced origin", () => {
  const setup = fixture();
  try {
    write(setup.shared, "staged.txt", "staged by another writer\n");
    git(setup.shared, "add", "staged.txt");
    write(setup.shared, "tree.txt", "tree edit by another writer\n");
    write(setup.shared, "named.txt", "named by this operation\n");

    write(setup.writer, "remote.txt", "origin advanced\n");
    git(setup.writer, "add", "remote.txt");
    git(setup.writer, "commit", "-m", "origin advances");
    git(setup.writer, "push", "origin", "main");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Commit the named path", push: true,
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.phase, "published");
    assert.equal(git(setup.shared, "diff", "--cached", "--name-only"), "staged.txt");
    assert.equal(readFileSync(path.join(setup.shared, "tree.txt"), "utf8"), "tree edit by another writer\n");
    assert.equal(git(setup.shared, "show", "--format=", "--name-only", "HEAD^1").trim(), "named.txt");
    assert.equal(git(setup.shared, "rev-list", "--parents", "-n", "1", "HEAD").split(/\s+/u).length, 3);
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0]);
    if (process.env.SHOW_GIT_COMMIT_PATHS_RECEIPT === "1") console.log(JSON.stringify({
      case: "advanced-origin",
      result,
      stagedAfter: git(setup.shared, "diff", "--cached", "--name-only"),
      worktreeEditAfter: readFileSync(path.join(setup.shared, "tree.txt"), "utf8").trim(),
      parents: git(setup.shared, "rev-list", "--parents", "-n", "1", "HEAD"),
    }, null, 2));
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a file origin deleted leaves the shared index and the worktree", () => {
  const setup = fixture();
  try {
    git(setup.writer, "rm", "-q", "remote.txt");
    git(setup.writer, "commit", "-m", "origin deletes a file");
    git(setup.writer, "push", "origin", "main");
    write(setup.shared, "named.txt", "named by this operation\n");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Commit the named path", push: true,
    });
    assert.equal(result.phase, "published", JSON.stringify(result, null, 2));
    assert.equal(git(setup.shared, "status", "--porcelain"), "");
    assert.equal(git(setup.shared, "ls-files", "remote.txt"), "");
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: an unnamed file origin deleted but another writer edited refuses before commit", () => {
  const setup = fixture();
  try {
    git(setup.writer, "rm", "-q", "remote.txt");
    git(setup.writer, "commit", "-m", "origin deletes a file");
    git(setup.writer, "push", "origin", "main");
    write(setup.shared, "remote.txt", "another writer still edits this\n");
    write(setup.shared, "named.txt", "named by this operation\n");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Commit the named path", push: true,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.obstructions, ["origin-change-has-local-edit:remote.txt"]);
    assert.equal(readFileSync(path.join(setup.shared, "remote.txt"), "utf8"), "another writer still edits this\n");
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a file deleted both locally and on origin merges cleanly", () => {
  const setup = fixture();
  try {
    git(setup.writer, "rm", "-q", "remote.txt");
    git(setup.writer, "commit", "-m", "origin deletes a file");
    git(setup.writer, "push", "origin", "main");
    rmSync(path.join(setup.shared, "remote.txt"));
    write(setup.shared, "named.txt", "named by this operation\n");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Commit the named path", push: true,
    });
    assert.equal(result.phase, "published", JSON.stringify(result, null, 2));
    assert.equal(git(setup.shared, "status", "--porcelain"), "");
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a named local/origin overlap refuses before commit", () => {
  const setup = fixture();
  try {
    write(setup.writer, "named.txt", "origin version\n");
    git(setup.writer, "add", "named.txt");
    git(setup.writer, "commit", "-m", "origin changes named");
    git(setup.writer, "push", "origin", "main");
    write(setup.shared, "named.txt", "local version\n");
    const before = git(setup.shared, "rev-parse", "HEAD");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Must refuse", push: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.phase, "precondition");
    assert.deepEqual(result.obstructions, ["named-path-changed-by-origin-and-locally:named.txt"]);
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), before);
    assert.equal(readFileSync(path.join(setup.shared, "named.txt"), "utf8"), "local version\n");
    if (process.env.SHOW_GIT_COMMIT_PATHS_RECEIPT === "1") console.log(JSON.stringify({
      case: "named-overlap",
      result,
      headBefore: before,
      headAfter: git(setup.shared, "rev-parse", "HEAD"),
      localAfter: readFileSync(path.join(setup.shared, "named.txt"), "utf8").trim(),
    }, null, 2));
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: an unnamed non-conflicting local/origin overlap is preserved and unstaged", () => {
  const setup = fixture();
  try {
    write(setup.shared, "named.txt", "named by this operation\n");
    write(setup.shared, "overlap.txt", "local first\nmiddle\nlast\n");
    write(setup.writer, "overlap.txt", "first\nmiddle\norigin last\n");
    git(setup.writer, "add", "overlap.txt");
    git(setup.writer, "commit", "-m", "origin changes unnamed path");
    git(setup.writer, "push", "origin", "main");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Commit beside an unnamed edit", push: true,
    });

    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.phase, "published");
    assert.equal(readFileSync(path.join(setup.shared, "overlap.txt"), "utf8"), "local first\nmiddle\norigin last\n");
    assert.equal(git(setup.shared, "diff", "--cached", "--name-only", "--", "overlap.txt"), "");
    assert.equal(git(setup.shared, "diff", "--name-only", "--", "overlap.txt"), "overlap.txt");
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0]);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: an unnamed local edit that already holds origin's change and extends it is kept", () => {
  const setup = fixture();
  try {
    write(setup.shared, "named.txt", "named by this operation\n");
    // Both sides add the same line after "first"; the local edit adds one more right after it,
    // which merge-file reports as a conflict although nothing of origin's change is missing.
    write(setup.shared, "overlap.txt", "first\nshared addition\nlocal extension\nmiddle\nlast\n");
    write(setup.writer, "overlap.txt", "first\nshared addition\nmiddle\nlast\n");
    git(setup.writer, "add", "overlap.txt");
    git(setup.writer, "commit", "-m", "origin lands part of the local edit");
    git(setup.writer, "push", "origin", "main");

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Commit beside a local edit that extends origin", push: true,
    });

    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(readFileSync(path.join(setup.shared, "overlap.txt"), "utf8"), "first\nshared addition\nlocal extension\nmiddle\nlast\n");
    assert.equal(git(setup.shared, "diff", "--name-only", "--", "overlap.txt"), "overlap.txt");
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0]);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: an unnamed conflicting local/origin overlap refuses before commit and restores bytes", () => {
  const setup = fixture();
  try {
    write(setup.shared, "named.txt", "named by this operation\n");
    write(setup.shared, "overlap.txt", "local version\n");
    write(setup.writer, "overlap.txt", "origin version\n");
    git(setup.writer, "add", "overlap.txt");
    git(setup.writer, "commit", "-m", "origin conflicts on unnamed path");
    git(setup.writer, "push", "origin", "main");
    const headBefore = git(setup.shared, "rev-parse", "HEAD");
    const bytesBefore = readFileSync(path.join(setup.shared, "overlap.txt"));

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Must refuse before commit", push: true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.phase, "precondition");
    assert.deepEqual(result.obstructions, ["origin-change-has-local-edit:overlap.txt"]);
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), headBefore);
    assert.deepEqual(readFileSync(path.join(setup.shared, "overlap.txt")), bytesBefore);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

test("receiving: a transient shared index lock is retried", () => {
  const setup = fixture();
  try {
    write(setup.shared, "named.txt", "named while another writer holds the index\n");
    const lock = path.join(setup.shared, ".git", "index.lock");
    writeFileSync(lock, "");
    spawn(process.execPath, [
      "-e",
      "const fs = require('node:fs'); setTimeout(() => fs.unlinkSync(process.argv[1]), 1000);",
      lock,
    ], { stdio: "ignore" });

    const result = commitGitPaths({ packageRoot: setup.shared, dataRoot: setup.shared }, {
      paths: ["named.txt"], message: "Wait for the shared index", push: true,
    });

    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.phase, "published");
    assert.equal(result.commands.some(({ status, stderr }) => status !== 0 && /index\.lock/u.test(stderr)), true);
    assert.equal(git(setup.shared, "diff", "--cached", "--name-only", "--", "named.txt"), "");
    assert.equal(git(setup.shared, "rev-parse", "HEAD"), git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s+/u)[0]);
  } finally {
    rmSync(setup.parent, { recursive: true, force: true });
  }
});

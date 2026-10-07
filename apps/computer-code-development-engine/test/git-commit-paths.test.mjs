import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { commitGitPaths } from "../src/git/operations.mjs";

function git(root, ...arguments_) {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function gitStatus(root, ...arguments_) {
  return spawnSync("git", arguments_, { cwd: root, encoding: "utf8" }).status;
}

/** One repository on main with a committed file to select, one to delete, one to leave alone, and
 *  a directory. */
function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "git-commit-paths-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q", "--initial-branch=main");
  git(root, "config", "user.email", "house@example.invalid");
  git(root, "config", "user.name", "House");
  for (const name of ["selected.txt", "deleted.txt", "unrelated.txt"]) writeFileSync(path.join(root, name), "one\n");
  mkdirSync(path.join(root, "directory"));
  writeFileSync(path.join(root, "directory", "placeholder.txt"), "one\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "initial");
  return root;
}

function commit(root, paths, message, fields = {}) {
  return commitGitPaths({ packageRoot: root, dataRoot: root }, { paths, message, ...fields });
}

function committedPaths(root) {
  return git(root, "diff-tree", "--no-commit-id", "-r", "--name-only", "-z", "HEAD").split("\0").filter(Boolean).sort();
}

function indexTuple(index, file) {
  return index.split("\0").find((entry) => entry.endsWith(`\t${file}`));
}

test("an exact-path commit carries additions, edits and deletions while outside staged work keeps its index tuple", (context) => {
  const root = fixture(context);
  writeFileSync(path.join(root, "selected.txt"), "two\n");
  writeFileSync(path.join(root, "added.txt"), "new\n");
  rmSync(path.join(root, "deleted.txt"));
  writeFileSync(path.join(root, "unrelated.txt"), "staged\n");
  git(root, "add", "unrelated.txt");
  writeFileSync(path.join(root, "unrelated.txt"), "unstaged\n");
  const before = git(root, "ls-files", "--stage", "-z");
  const parent = git(root, "rev-parse", "HEAD").trim();

  const result = commit(root, ["selected.txt", "added.txt", "deleted.txt"], "Exact update");

  assert.equal(result.phase, "committed", JSON.stringify(result.obstructions));
  assert.equal(result.head, git(root, "rev-parse", "HEAD").trim());
  assert.equal(git(root, "rev-parse", "HEAD^").trim(), parent);
  assert.deepEqual(committedPaths(root), ["added.txt", "deleted.txt", "selected.txt"]);
  assert.equal(git(root, "show", "HEAD:selected.txt"), "two\n");
  assert.notEqual(gitStatus(root, "cat-file", "-e", "HEAD:deleted.txt"), 0);
  assert.equal(indexTuple(git(root, "ls-files", "--stage", "-z"), "unrelated.txt"), indexTuple(before, "unrelated.txt"));
  assert.equal(readFileSync(path.join(root, "unrelated.txt"), "utf8"), "unstaged\n");
  assert.equal(git(root, "diff", "--cached", "--name-only"), "unrelated.txt\n");
});

test("a pathspec-looking name is committed as the literal file it names", (context) => {
  const root = fixture(context);
  const literal = ":(literal)notice.txt";
  writeFileSync(path.join(root, literal), "literal\n");
  assert.equal(commit(root, [literal], "Literal endpoint").phase, "committed");
  assert.equal(git(root, "show", `HEAD:${literal}`), "literal\n");
});

test("a selected symlink is committed as its link bytes", (context) => {
  const root = fixture(context);
  symlinkSync("selected.txt", path.join(root, "linked-file"));
  assert.equal(commit(root, ["linked-file"], "Link endpoint").phase, "committed");
  assert.equal(git(root, "show", "HEAD:linked-file"), "selected.txt");
});

test("a commit follows the repository's clean filters and core.filemode", (context) => {
  const root = fixture(context);
  git(root, "config", "filter.fixture.clean", "sed 's/worktree/canonical/'");
  git(root, "config", "core.filemode", "false");
  writeFileSync(path.join(root, ".gitattributes"), "selected.txt filter=fixture\n");
  writeFileSync(path.join(root, "selected.txt"), "worktree\n");
  chmodSync(path.join(root, "selected.txt"), 0o755);
  assert.equal(commit(root, ["selected.txt"], "Git semantics").phase, "committed");
  assert.equal(git(root, "show", "HEAD:selected.txt"), "canonical\n");
  assert.match(git(root, "ls-tree", "HEAD", "selected.txt"), /^100644 /u);
});

test("both endpoints of a rename commit together", (context) => {
  const root = fixture(context);
  rmSync(path.join(root, "selected.txt"));
  writeFileSync(path.join(root, "renamed.txt"), "one\n");
  assert.equal(commit(root, ["selected.txt", "renamed.txt"], "Rename endpoint").phase, "committed");
  assert.deepEqual(committedPaths(root), ["renamed.txt", "selected.txt"]);
});

test("an ignored rename endpoint the index already tracks commits, and an untracked ignored file stays out", (context) => {
  const root = fixture(context);
  writeFileSync(path.join(root, ".gitignore"), "*.jsonl\n");
  writeFileSync(path.join(root, "legacy.jsonl"), "old\n");
  git(root, "add", "-f", ".gitignore", "legacy.jsonl");
  git(root, "commit", "-qm", "tracked legacy");
  rmSync(path.join(root, "legacy.jsonl"));
  writeFileSync(path.join(root, "relocated.jsonl"), "old\n");
  writeFileSync(path.join(root, "private.jsonl"), "private\n");
  git(root, "add", "-f", "relocated.jsonl");

  const result = commit(root, ["legacy.jsonl", "relocated.jsonl"], "Relocate tracked ignored record");

  assert.equal(result.phase, "committed", JSON.stringify(result.obstructions));
  assert.equal(git(root, "show", "HEAD:relocated.jsonl"), "old\n");
  assert.notEqual(gitStatus(root, "cat-file", "-e", "HEAD:legacy.jsonl"), 0);
  assert.equal(indexTuple(git(root, "ls-files", "--stage", "-z"), "private.jsonl"), undefined);
  assert.match(git(root, "status", "--short", "--ignored"), /!! private\.jsonl/u);

  writeFileSync(path.join(root, "private.jsonl"), "changed\n");
  assert.equal(commit(root, ["private.jsonl"], "Admit an untracked ignored file").phase, "effect");
  assert.notEqual(gitStatus(root, "cat-file", "-e", "HEAD:private.jsonl"), 0);
});

test("an endpoint that is not one file of this repository is refused before any write", (context) => {
  const root = fixture(context);
  symlinkSync("directory", path.join(root, "linked-directory"));
  mkdirSync(path.join(root, "nested"));
  git(path.join(root, "nested"), "init", "-q");
  writeFileSync(path.join(root, "nested", "inner.txt"), "inner\n");
  const head = git(root, "rev-parse", "HEAD").trim();
  const obstructions = (paths) => commit(root, paths, "Endpoint").obstructions;

  assert.deepEqual(obstructions(["directory"]), ["file-endpoint-required:directory"]);
  assert.deepEqual(obstructions(["linked-directory/placeholder.txt"]), ["symlink-directory-endpoint:linked-directory/placeholder.txt"]);
  assert.deepEqual(obstructions(["nested/inner.txt"]), ["nested-repository-endpoint:nested/inner.txt"]);
  assert.match(obstructions([".git/config"])[0], /literal repository-relative/u);
  assert.equal(commit(root, [".git/config"], "Metadata").phase, "precondition");
  assert.equal(git(root, "rev-parse", "HEAD").trim(), head);
});

test("what porcelain commit would honour and a plumbing commit would skip is refused", (context) => {
  const root = fixture(context);
  writeFileSync(path.join(root, "selected.txt"), "two\n");
  const refusal = () => commit(root, ["selected.txt"], "Policy");

  writeFileSync(path.join(root, ".git", "MERGE_HEAD"), `${git(root, "rev-parse", "HEAD")}`);
  assert.deepEqual(refusal().obstructions, ["operation-in-progress:MERGE_HEAD"]);
  rmSync(path.join(root, ".git", "MERGE_HEAD"));

  git(root, "config", "commit.gpgSign", "true");
  assert.deepEqual(refusal().obstructions, ["commit-signing-configured"]);
  git(root, "config", "--unset", "commit.gpgSign");

  writeFileSync(path.join(root, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
  chmodSync(path.join(root, ".git", "hooks", "pre-commit"), 0o755);
  assert.deepEqual(refusal().obstructions, ["commit-hook-configured:pre-commit"]);
  chmodSync(path.join(root, ".git", "hooks", "pre-commit"), 0o644);

  const blob = git(root, "rev-parse", "HEAD:unrelated.txt").trim();
  const conflict = spawnSync("git", ["update-index", "--index-info"], { cwd: root, input: `0 ${"0".repeat(40)}\tunrelated.txt\n100644 ${blob} 1\tunrelated.txt\n100644 ${blob} 2\tunrelated.txt\n`, encoding: "utf8" });
  assert.equal(conflict.status, 0, conflict.stderr);
  assert.deepEqual(refusal().obstructions, ["unmerged-index-entries"]);
  git(root, "reset", "-q", "HEAD", "--", "unrelated.txt");

  assert.equal(refusal().phase, "committed");
});

test("a dry run reads the head it would commit on and changes nothing", (context) => {
  const root = fixture(context);
  writeFileSync(path.join(root, "selected.txt"), "two\n");
  const head = git(root, "rev-parse", "HEAD").trim();
  const index = git(root, "ls-files", "--stage", "-z");
  const result = commit(root, ["selected.txt"], "Dry run", { dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.phase, "planned");
  assert.equal(result.head, head);
  assert.equal(git(root, "rev-parse", "HEAD").trim(), head);
  assert.equal(git(root, "ls-files", "--stage", "-z"), index);
  assert.equal(readFileSync(path.join(root, "selected.txt"), "utf8"), "two\n");
});

test("unchanged endpoints are an honest no-op", (context) => {
  const root = fixture(context);
  const result = commit(root, ["selected.txt"], "No-op");
  assert.equal(result.ok, false);
  assert.equal(result.phase, "stage");
  assert.deepEqual(result.obstructions, ["nothing-to-commit"]);
});

test("post-commit runs once the ref and the shared index agree, and its failure is reported, not undone", (context) => {
  const root = fixture(context);
  const receipt = path.join(root, "post-commit-receipt.txt");
  const hook = path.join(root, ".git", "hooks", "post-commit");
  writeFileSync(path.join(root, "selected.txt"), "two\n");
  writeFileSync(hook, `#!/bin/sh\ngit rev-parse HEAD > ${receipt}\ngit diff --cached --name-only >> ${receipt}\n`);
  chmodSync(hook, 0o755);
  const result = commit(root, ["selected.txt"], "Hook");
  assert.equal(result.phase, "committed");
  assert.deepEqual(result.postCommit, { success: true, output: "" });
  assert.equal(readFileSync(receipt, "utf8"), `${result.head}\n`);

  writeFileSync(path.join(root, "selected.txt"), "three\n");
  writeFileSync(hook, "#!/bin/sh\necho hook failed >&2\nexit 1\n");
  const failed = commit(root, ["selected.txt"], "Hook failure");
  assert.equal(failed.phase, "committed");
  assert.deepEqual(failed.postCommit, { success: false, output: "hook failed" });
  assert.equal(git(root, "rev-parse", "HEAD").trim(), failed.head);
});

test("a path list larger than one argument vector commits (regression: OS ARG_MAX)", (context) => {
  const root = fixture(context);
  const names = Array.from({ length: 14_000 }, (_, index) => `${"x".repeat(170)}-${index}.txt`);
  const totalPathBytes = names.reduce((sum, name) => sum + Buffer.byteLength(name) + 1, 0);
  assert.ok(totalPathBytes > 2 * 1024 * 1024, `fixture must exceed a 2MiB argv budget to prove the regression, got ${totalPathBytes}`);
  for (const name of names) writeFileSync(path.join(root, name), "x\n");

  const result = commit(root, names, "Bulk add past the OS argv-size limit");

  assert.equal(result.phase, "committed", JSON.stringify(result.obstructions));
  assert.equal(gitStatus(root, "cat-file", "-e", `HEAD:${names[0]}`), 0);
  assert.equal(gitStatus(root, "cat-file", "-e", `HEAD:${names.at(-1)}`), 0);
  assert.equal(git(root, "ls-files").trim().split("\n").length, names.length + 4);
});

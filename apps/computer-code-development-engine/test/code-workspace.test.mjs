import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { defaultFilesystemBinding } from "@red-cup-engineering/computer-system-engine/rpc/binding";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { codeWorkspaceOperations } from "../src/monitoring/operations.mjs";
import { workspaceFileReplaceRequestContract } from "../src/workspace/readout.mjs";

test("native code family edits its assessed shared source, preserves a stale worker's rival change, and stays confined", async (t) => {
  const parent = mkdtempSync(path.join(tmpdir(), "code-workspace-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const repository = path.join(parent, "repository");
  const data = path.join(parent, "data");
  mkdirSync(repository);
  mkdirSync(data);
  const source = 'export const value = 1;\n';
  writeFileSync(path.join(repository, "value.mjs"), source);
  writeFileSync(path.join(data, "value.mjs"), "protected data\n");
  const operations = Object.fromEntries(codeWorkspaceOperations(defaultFilesystemBinding(data, {
    repositoryRoot: repository,
  })).map((op) => [op.verb, op]));
  const read = await operations["workspace-file-slice"].execute({ scope: "repository", path: "value.mjs" });
  assert.equal(read.root, repository);
  assert.equal(read.contentAddress, artifactId(source));
  assert.ok(JSON.stringify(read).includes("export const value = 1;"));
  const request = { scope: "repository", path: "value.mjs", expected: read.contentAddress, content: 'export const value = 2;\n' };
  workspaceFileReplaceRequestContract.assert(request);
  const replaced = await operations["workspace-file-replace"].execute(request);
  assert.equal(replaced.kind, "metroplat.filesystem.workspace-file-replace:witness");
  assert.equal(replaced.before, request.expected);
  assert.equal((await import(pathToFileURL(path.join(repository, "value.mjs")).href)).value, 2);
  assert.equal((await operations["workspace-file-replace"].execute(request)).reason, "stale-source");
  assert.equal(readFileSync(path.join(repository, "value.mjs"), "utf8"), request.content);
  assert.equal(readFileSync(path.join(data, "value.mjs"), "utf8"), "protected data\n");
  symlinkSync(data, path.join(repository, "escape"));
  assert.equal((await operations["workspace-file-replace"].execute({ ...request, path: "escape/value.mjs" })).reason, "outside-package");
  assert.equal((await operations["workspace-file-replace"].execute({ ...request, path: "escape/new.mjs", expected: undefined })).reason, "outside-package");
  assert.equal((await operations["workspace-file-replace"].execute({ ...request, scope: "package" })).reason, "package-root-unavailable");
  assert.throws(() => workspaceFileReplaceRequestContract.assert({ ...request, scope: "data" }));
  const unbound = codeWorkspaceOperations(defaultFilesystemBinding(data)).find((op) => op.verb === "workspace-file-replace");
  assert.equal((await unbound.execute(request)).reason, "repository-root-unavailable");
});

test("an edit during a source read keeps the displayed snapshot and address together", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "code-workspace-snapshot-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "source.mjs");
  const before = "export const value = 1;\n";
  const rival = "export const value = 3;\n";
  writeFileSync(target, before);
  const binding = defaultFilesystemBinding(root, { repositoryRoot: root });
  let changed = false;
  const operations = Object.fromEntries(codeWorkspaceOperations({ ...binding,
    readFileHeadUtf8: (file, bytes) => {
      const snapshot = binding.readFileHeadUtf8(file, bytes);
      if (!changed) { changed = true; writeFileSync(target, rival); }
      return snapshot;
    },
  }).map((op) => [op.verb, op]));
  const read = await operations["workspace-file-slice"].execute({ scope: "repository", path: "source.mjs" });
  assert.equal(read.lines[0].text, before.trimEnd());
  assert.equal(read.contentAddress, artifactId(before));
  const write = await operations["workspace-file-replace"].execute({ scope: "repository", path: "source.mjs", expected: read.contentAddress, content: "export const value = 2;\n" });
  assert.equal(write.reason, "stale-source");
  assert.equal(readFileSync(target, "utf8"), rival);
});

test("bounded exact edits execute through the existing native writer without resending untouched source", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "code-workspace-edits-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "source.mjs");
  const untouched = "// retained source and data\n".repeat(2000);
  const original = untouched + "export const value = 1;\n";
  writeFileSync(target, original);
  const op = codeWorkspaceOperations(defaultFilesystemBinding(root, { repositoryRoot: root })).find((op) => op.verb === "workspace-file-replace");
  const request = { scope: "repository", path: "source.mjs", expected: artifactId(original), edits: [
    { before: "export const value = 1;", after: "export const value = 2;" },
    { before: "value = 2", after: "value = 3" },
  ] };
  workspaceFileReplaceRequestContract.assert(request);
  assert.ok(JSON.stringify(request).length < original.length / 100);
  const result = await op.execute(request);
  assert.equal(result.changed, true);
  assert.equal(result.before, request.expected);
  const expected = untouched + "export const value = 3;\n";
  assert.equal(readFileSync(target, "utf8"), expected);
  assert.equal(result.after, artifactId(expected));
  assert.equal((await import(pathToFileURL(target).href)).value, 3);
  assert.equal((await op.execute(request)).reason, "stale-source");
  for (const edits of [
    [{ before: "value = 3", after: "value = 9" }, { before: "missing", after: "bad" }],
    [{ before: "// retained", after: "bad" }],
    [{ before: "value = 3", after: "a".repeat(262144) }],
  ]) {
    const result = await op.execute({ ...request, expected: artifactId(expected), edits });
    assert.ok(["edit-not-unique", "replacement-too-large"].includes(result.reason));
    assert.equal(readFileSync(target, "utf8"), expected);
  }
  const noop = await op.execute({ ...request, expected: artifactId(expected), edits: [{ before: "value = 3", after: "value = 3" }] });
  assert.equal(noop.changed, false);
  for (const invalid of [
    { ...request, content: "competing" },
    { ...request, expected: undefined },
    { ...request, edits: [] },
    { ...request, edits: [{ before: "", after: "bad" }] },
    { ...request, edits: [{ before: "x", after: "y", regex: true }] },
  ]) assert.throws(() => workspaceFileReplaceRequestContract.assert(invalid));
});

test("overlapping exact edit matches are refused with no partial write", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "code-workspace-overlap-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, "source.mjs"), "aaa");
  const op = codeWorkspaceOperations(defaultFilesystemBinding(root, { repositoryRoot: root })).find((op) => op.verb === "workspace-file-replace");
  const result = await op.execute({ scope: "repository", path: "source.mjs", expected: artifactId("aaa"), edits: [{ before: "aa", after: "z" }] });
  assert.equal(result.reason, "edit-not-unique");
  assert.equal(readFileSync(path.join(root, "source.mjs"), "utf8"), "aaa");
});

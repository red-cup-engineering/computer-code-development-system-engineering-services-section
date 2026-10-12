import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createAgentTools, induceVerifiedSoftwareMissionProposal } from "../../src/mission/agent-tools.mjs";

test("structured provider edit arrays compile into deterministic SEARCH/REPLACE operations", () => {
  const root = mkdtempSync(join(tmpdir(), "union-edit-dialect-"));
  writeFileSync(join(root, "value.mjs"), "export const value = 1;\n");
  const tools = createAgentTools({ root, verifyCommand: "node --check value.mjs" });
  const result = JSON.parse(tools.execute({ action: "edit", args: { path: "value.mjs", blocks: [{ search: "export const value = 1;", replace: "export const value = 2;" }] } }));
  assert.equal(result.ok, true);
  assert.equal(result.verification.passed, true);
  assert.match(readFileSync(join(root, "value.mjs"), "utf8"), /value = 2/);
});

test("the shared edit operation applies ordered blocks including a deletion", () => {
  const root = mkdtempSync(join(tmpdir(), "union-multiblock-edit-"));
  writeFileSync(join(root, "value.mjs"), "export const first = 1;\nexport const remove = true;\n");
  const tools = createAgentTools({ root, verifyCommand: "node --check value.mjs", writablePaths: ["value.mjs"] });
  const result = JSON.parse(tools.execute({ action: "edit", args: { path: "value.mjs", blocks: [
    { search: "first = 1", replace: "first = 2" },
    { search: "export const remove = true;\n", replace: "" },
  ] } }));
  assert.equal(result.ok, true);
  assert.equal(readFileSync(join(root, "value.mjs"), "utf8"), "export const first = 2;\n");
});

test("declared writable paths mechanically refuse an out-of-scope model edit", () => {
  const root = mkdtempSync(join(tmpdir(), "union-write-scope-"));
  writeFileSync(join(root, "admitted.mjs"), "export const admitted = 1;\n");
  writeFileSync(join(root, "protected.mjs"), "export const protectedValue = 1;\n");
  const tools = createAgentTools({ root, verifyCommand: "true", writablePaths: ["admitted.mjs"] });
  const result = JSON.parse(tools.execute({ action: "edit", args: { path: "protected.mjs", blocks: [{ search: "1", replace: "2" }] } }));
  assert.equal(result.ok, false);
  assert.match(result.error, /outside declared writable paths/);
  assert.match(readFileSync(join(root, "protected.mjs"), "utf8"), / = 1/);
});

test("an edit that carries no differential information is refused without recording a change", () => {
  const root = mkdtempSync(join(tmpdir(), "union-no-op-edit-"));
  const source = "export const value = 1;\n";
  writeFileSync(join(root, "value.mjs"), source);
  const tools = createAgentTools({ root, verifyCommand: "node --check value.mjs" });
  const result = JSON.parse(tools.execute({ action: "edit", args: { path: "value.mjs", blocks: [{ search: source, replace: source }] } }));
  assert.equal(result.ok, false);
  assert.match(result.error, /no differential information/);
  assert.equal(tools.changed.size, 0);
  assert.equal(readFileSync(join(root, "value.mjs"), "utf8"), source);
});

test("create delegates the absent exact writable target to the edit-language provider", () => {
  const root = mkdtempSync(join(tmpdir(), "union-create-dialect-"));
  const tools = createAgentTools({ root, verifyCommand: "node --check test/new.mjs", writablePaths: ["test/new.mjs"] });
  const created = JSON.parse(tools.execute({ action: "create", args: { path: "test/new.mjs", content: "export const created = true;\n" } }));
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  assert.equal(readFileSync(join(root, "test/new.mjs"), "utf8"), "export const created = true;\n");
  assert.equal(tools.changes()[0].before.existed, false);
  const duplicate = JSON.parse(tools.execute({ action: "create", args: { path: "test/new.mjs", content: "export const duplicate = true;\n" } }));
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /target absent/);
  const escaped = JSON.parse(tools.execute({ action: "create", args: { path: "../escape.mjs", content: "x" } }));
  assert.equal(escaped.ok, false);
});

const proposal = (changes) => ({ type: "SoftwareMissionChangeProposal", changes });
const change = (path, before, after, existed = true) => ({
  path,
  beforeExisted: existed,
  beforeDigest: `sha256:${createHash("sha256").update(before).digest("hex")}`,
  afterDigest: `sha256:${createHash("sha256").update(after).digest("hex")}`,
  afterBytesBase64: Buffer.from(after).toString("base64"),
});

test("receiver induction writes a verified proposal only within its explicit lane", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-induction-"));
  const before = "export const value = 1;\n", after = "export const value = 2;\n";
  writeFileSync(join(root, "value.mjs"), before);
  const result = induceVerifiedSoftwareMissionProposal({ root, writablePaths: ["value.mjs"], verifyCommand: "node --check value.mjs", proposal: proposal([change("value.mjs", before, after)]) });
  assert.deepEqual(result.changedPaths, ["value.mjs"]);
  assert.equal(readFileSync(join(root, "value.mjs"), "utf8"), after);
});

test("receiver induction preflights every change and leaves bytes intact on a later stale entry", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-induction-preflight-"));
  const one = "export const one = 1;\n", two = "export const two = 1;\n";
  writeFileSync(join(root, "one.mjs"), one); writeFileSync(join(root, "two.mjs"), two);
  const stale = change("two.mjs", "wrong", "export const two = 2;\n");
  assert.throws(() => induceVerifiedSoftwareMissionProposal({ root, writablePaths: ["one.mjs", "two.mjs"], verifyCommand: "true", proposal: proposal([change("one.mjs", one, "export const one = 2;\n"), stale]) }), /does not descend/u);
  assert.equal(readFileSync(join(root, "one.mjs"), "utf8"), one);
  assert.equal(readFileSync(join(root, "two.mjs"), "utf8"), two);
});

test("receiver induction rejects duplicate and out-of-scope entries before any write", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-induction-scope-"));
  const one = "export const one = 1;\n", protectedSource = "export const protectedValue = 1;\n";
  writeFileSync(join(root, "one.mjs"), one); writeFileSync(join(root, "protected.mjs"), protectedSource);
  const first = change("one.mjs", one, "export const one = 2;\n");
  assert.throws(() => induceVerifiedSoftwareMissionProposal({ root, writablePaths: ["one.mjs"], verifyCommand: "true", proposal: proposal([first, change("protected.mjs", protectedSource, "export const protectedValue = 2;\n")]) }), /outside declared writable paths/u);
  assert.equal(readFileSync(join(root, "one.mjs"), "utf8"), one);
  assert.throws(() => induceVerifiedSoftwareMissionProposal({ root, writablePaths: ["one.mjs"], verifyCommand: "true", proposal: proposal([first, first]) }), /repeats path/u);
  assert.equal(readFileSync(join(root, "one.mjs"), "utf8"), one);
});

test("receiver induction rolls every write back when a receiver gate fails", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-induction-rollback-"));
  const before = "export const value = 1;\n", after = "export const value = ;\n";
  writeFileSync(join(root, "value.mjs"), before);
  assert.throws(() => induceVerifiedSoftwareMissionProposal({ root, writablePaths: ["value.mjs"], verifyCommand: "node --check value.mjs", proposal: proposal([change("value.mjs", before, after)]) }), /rolled back/u);
  assert.equal(readFileSync(join(root, "value.mjs"), "utf8"), before);
});

test("receiver induction rolls applied entries back when a later filesystem write fails", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-induction-write-failure-"));
  const before = "export const value = 1;\n";
  writeFileSync(join(root, "value.mjs"), before);
  let writes = 0;
  const tools = createAgentTools({
    root,
    writablePaths: ["value.mjs", "second.mjs"],
    verifyCommand: "true",
    restoreWriteFile(path, bytes) {
      writes += 1;
      if (writes === 2) throw new Error("injected second write failure");
      writeFileSync(path, bytes);
    },
  });
  assert.throws(() => tools.restoreChanges([
    change("value.mjs", before, "export const value = 2;\n"),
    change("second.mjs", "", "export const second = true;\n", false),
  ]), /injected second write failure/u);
  assert.equal(writes, 2);
  assert.equal(readFileSync(join(root, "value.mjs"), "utf8"), before);
  assert.equal(existsSync(join(root, "second.mjs")), false);
});

test("checkpoint restoration retains an incomplete admitted workspace", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-checkpoint-restore-"));
  const before = "export const value = 1;\n", after = "export const value = ;\n";
  writeFileSync(join(root, "value.mjs"), before);
  const tools = createAgentTools({ root, writablePaths: ["value.mjs"], verifyCommand: "node --check value.mjs" });
  const result = tools.restoreChanges([change("value.mjs", before, after)]);
  assert.equal(result.verification.passed, false);
  assert.equal(readFileSync(join(root, "value.mjs"), "utf8"), after);
});

test("checkpoint restoration admits an empty refused checkpoint as a no-op", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-empty-checkpoint-"));
  writeFileSync(join(root, "value.mjs"), "export const value = 1;\n");
  const tools = createAgentTools({ root, writablePaths: ["value.mjs"], verifyCommand: "node --check value.mjs" });
  const result = tools.restoreChanges([]);
  assert.deepEqual(result.changedPaths, []);
  assert.equal(result.verification.passed, true);
});

test("receiver induction refuses symlink and unrestricted write lanes before mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "mission-induction-symlink-"));
  const outside = mkdtempSync(join(tmpdir(), "mission-induction-outside-"));
  writeFileSync(join(outside, "outside.mjs"), "export const value = 1;\n");
  symlinkSync(join(outside, "outside.mjs"), join(root, "linked.mjs"));
  const before = "export const value = 1;\n";
  assert.throws(() => induceVerifiedSoftwareMissionProposal({ root, writablePaths: ["linked.mjs"], verifyCommand: "true", proposal: proposal([change("linked.mjs", before, "export const value = 2;\n")]) }), /symlink/u);
  assert.throws(() => induceVerifiedSoftwareMissionProposal({ root, writablePaths: [], verifyCommand: "true", proposal: proposal([change("linked.mjs", before, "export const value = 2;\n")]) }), /nonempty writablePaths/u);
  assert.equal(readFileSync(join(outside, "outside.mjs"), "utf8"), before);
});

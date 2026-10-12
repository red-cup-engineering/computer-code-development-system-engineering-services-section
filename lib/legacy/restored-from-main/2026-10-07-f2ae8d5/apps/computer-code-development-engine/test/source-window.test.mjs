import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, openSync, writeSync, closeSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSourceWindow, MAX_SOURCE_WINDOW_BYTES } from "../src/workspace/source-window.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "source-window-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("an actual large sparse file is directly sought without reading its prefix", t => {
  const root = fixture(t), file = join(root, "large.txt"), offset = 4 * 1024 * 1024;
  const fd = openSync(file, "w");
  try { writeSync(fd, Buffer.from("selected evidence\n"), 0, 18, offset); } finally { closeSync(fd); }
  const r = readSourceWindow(root, { path: "large.txt", byteOffset: offset });
  assert.equal(r.kind, "metroplat.filesystem.workspace-file-window-readout");
  assert.equal(r.source, "selected evidence\n");
  assert.equal(r.readBytes, 18);
  assert.equal(r.byteOffset, offset);
  assert.equal(r.eof, true);
  assert.match(r.contentAddress, /^sha256:/);
});

test("UTF-8 boundary cursors preserve characters and actual byte positions", t => {
  const root = fixture(t);
  writeFileSync(join(root, "utf8.txt"), "a".repeat(31) + "💠" + "b".repeat(30));
  const first = readSourceWindow(root, { path: "utf8.txt", byteCount: 32 });
  assert.equal(first.source, "a".repeat(31));
  assert.equal(first.readBytes, 32);
  assert.equal(first.nextByteOffset, 31);
  const next = readSourceWindow(root, { path: "utf8.txt", byteOffset: first.nextByteOffset,
    byteCount: 32, expected: first.revision });
  assert.equal(first.revision, next.revision);
  assert.ok(next.source.startsWith("💠"));
  const inside = readSourceWindow(root, { path: "utf8.txt", byteOffset: 33, byteCount: 8 });
  assert.equal(inside.byteOffset, 35);
  assert.equal(inside.source, "bbbbbb");
});

test("a continuation refuses a changed file revision rather than joining different evidence", t => {
  const root = fixture(t), file = join(root, "source.txt");
  writeFileSync(file, "original source");
  const first = readSourceWindow(root, { path: "source.txt", byteCount: 4 });
  writeFileSync(file, "changed source with a different length");
  assert.equal(readSourceWindow(root, { path: "source.txt", byteOffset: first.nextByteOffset,
    expected: first.revision }).reason, "source-revision-changed");
});

test("limits and paths are rejected before a source read", t => {
  const root = fixture(t);
  writeFileSync(join(root, "inside.txt"), "inside");
  for (const input of [{ byteOffset: -1 }, { byteOffset: Infinity }, { byteCount: MAX_SOURCE_WINDOW_BYTES + 1 },
    { byteCount: 0 }, { expected: "caller assertion" }])
    assert.equal(readSourceWindow(root, { path: "inside.txt", ...input }).reason, "invalid-source-window");
  assert.equal(readSourceWindow(root, { path: root }).reason, "exact-source-required");
  assert.equal(readSourceWindow(root, { path: "." }).reason, "outside-workspace");
  symlinkSync(tmpdir(), join(root, "escape"));
  assert.equal(readSourceWindow(root, { path: "escape" }).reason, "outside-workspace");
});

test("invalid ending UTF-8 and selected binary bytes are not presented as text", t => {
  const root = fixture(t);
  writeFileSync(join(root, "invalid.txt"), Buffer.from([65, 0xff]));
  writeFileSync(join(root, "binary.txt"), Buffer.from([65, 0, 66]));
  assert.equal(readSourceWindow(root, { path: "invalid.txt" }).reason, "bounded-text-window-unavailable");
  assert.equal(readSourceWindow(root, { path: "binary.txt" }).reason, "bounded-text-window-unavailable");
});


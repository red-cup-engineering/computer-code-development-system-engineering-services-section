import test from "node:test";
import assert from "node:assert/strict";
import { MAX_SOURCE_SNAPSHOT_BYTES as maximum, readSourceSnapshot } from "../src/workspace/source-snapshot.mjs";

function filesystem(size, source, file = true) {
  const reads = [];
  return { reads, statPathOrNull: () => ({ size, isFile: () => file }),
    readFileHeadUtf8: (path, bytes) => { reads.push({ path, bytes }); return source; },
    foldFileLinesUtf8: () => { throw new Error("unbounded fold must not be reachable"); } };
}
test("large source and directories are refused without reading their contents", () => {
  for (const fs of [filesystem(maximum + 1, "unread"), filesystem(0, "unread", false)]) {
    assert.equal(readSourceSnapshot("selected", fs).kind, "workspace.read:obstruction");
    assert.equal(fs.reads.length, 0);
  }
});
test("source growth between stat and read is caught by the overflow sentinel", () => {
  const fs = filesystem(1, "x".repeat(maximum + 1));
  assert.equal(readSourceSnapshot("selected", fs).reason, "bounded-text-snapshot-unavailable");
  assert.deepEqual(fs.reads, [{ path: "selected", bytes: maximum + 1 }]);
});
test("one bounded complete snapshot preserves source bytes and rejects binary data", () => {
  const text = "Šource\r\nsecond line\n";
  const fs = filesystem(Buffer.byteLength(text), text);
  assert.deepEqual(readSourceSnapshot("selected", fs), { kind: "workspace.source-snapshot", source: text, readBytes: Buffer.byteLength(text) });
  assert.equal(fs.reads.length, 1);
  assert.equal(readSourceSnapshot("selected", filesystem(3, "a\u0000b")).reason, "bounded-text-snapshot-unavailable");
});
test("a caller cannot raise the source IO budget", () => {
  const fs = filesystem(1, "a");
  assert.throws(() => readSourceSnapshot("selected", fs, maximum + 1), TypeError);
  assert.equal(fs.reads.length, 0);
});

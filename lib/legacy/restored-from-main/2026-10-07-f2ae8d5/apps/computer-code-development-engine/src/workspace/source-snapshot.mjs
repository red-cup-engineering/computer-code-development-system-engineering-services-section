/** The finite source-reading algorithm shared by inspection and exact-file search.
 * Custody supplies its filesystem capabilities. No traversal or stream-fold
 * capability is accepted; an oversized file is refused before a content read. */
export const MAX_SOURCE_SNAPSHOT_BYTES = 256 * 1024;

export function readSourceSnapshot(absolute, filesystem, maxBytes = MAX_SOURCE_SNAPSHOT_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_SOURCE_SNAPSHOT_BYTES)
    throw new TypeError("source snapshot bound exceeds the owning resource limit");
  const stat = filesystem.statPathOrNull(absolute);
  if (stat === null || !stat.isFile()) return Object.freeze({
    kind: "workspace.read:obstruction", reason: "exact-source-required",
  });
  if (!Number.isSafeInteger(stat.size) || stat.size > maxBytes) return Object.freeze({
    kind: "workspace.read:obstruction", reason: "file-read-budget-exceeded", maxReadBytes: maxBytes,
  });
  const source = filesystem.readFileHeadUtf8(absolute, maxBytes + 1);
  if (typeof source !== "string" || Buffer.byteLength(source) > maxBytes || source.includes("\u0000"))
    return Object.freeze({ kind: "workspace.read:obstruction", reason: "bounded-text-snapshot-unavailable" });
  return Object.freeze({ kind: "workspace.source-snapshot", source, readBytes: Buffer.byteLength(source) });
}

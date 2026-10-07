import { constants, openSync, statSync, fstatSync, readSync, closeSync, realpathSync } from "node:fs";
import { relative, isAbsolute, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

export const MAX_SOURCE_WINDOW_BYTES = 32 * 1024;
const obstruction = reason => Object.freeze({ kind: "workspace.read:obstruction", reason });
const identity = stat => createHash("sha256").update(
  [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":"),
).digest("hex");
const inside = (root, file) => {
  const name = relative(root, file);
  return name !== "" && name !== ".." && !name.startsWith(".." + sep) && !isAbsolute(name);
};

/** Direct seek into ONE selected file, never a prefix read, line fold or walk.
 * Source identity is a witnessed file revision, not a hash of unread contents.
 * The content address describes ONLY the returned byte window.
 * An expected revision binds successive reads; a changed file must be reselected.
 * This finite algorithm still requires the owning host admission/containment.
 */
export function readSourceWindow(root, request) {
  if (!request || typeof request.path !== "string" || !request.path || isAbsolute(request.path))
    return obstruction("exact-source-required");
  const offset = request.byteOffset ?? 0;
  const count = request.byteCount ?? MAX_SOURCE_WINDOW_BYTES;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(count)
      || count < 4 || count > MAX_SOURCE_WINDOW_BYTES
      || (request.expected !== undefined && !/^[a-f0-9]{64}$/.test(request.expected)))
    return obstruction("invalid-source-window");
  let descriptor;
  try {
    const canonicalRoot = realpathSync(root);
    const file = realpathSync(resolve(canonicalRoot, request.path));
    if (!inside(canonicalRoot, file)) return obstruction("outside-workspace");
    // No-follow protects the final component. Check the opened inode as well:
    // a pathname's observation alone must not license reading a replacement.
    const selectedFile = statSync(file, { bigint: true });
    if (!selectedFile.isFile()) return obstruction("exact-source-required");
    const observedDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    descriptor = observedDescriptor;
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.dev !== selectedFile.dev || before.ino !== selectedFile.ino
        || before.size > BigInt(Number.MAX_SAFE_INTEGER))
      return obstruction("exact-source-required");
    const revision = identity(before);
    if (request.expected !== undefined && request.expected !== revision)
      return obstruction("source-revision-changed");
    if (offset > Number(before.size)) return obstruction("source-offset-outside-file");
    const buffer = Buffer.alloc(Math.min(count, Number(before.size) - offset));
    let readBytes = 0;
    while (readBytes < buffer.length) {
      const read = readSync(descriptor, buffer, readBytes, buffer.length - readBytes, offset + readBytes);
      if (read === 0) break;
      readBytes += read;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (identity(after) !== revision) return obstruction("source-revision-changed");
    const bytes = buffer.subarray(0, readBytes);
    // A cursor may point inside a UTF-8 sequence. Keep actual byte coordinates,
    // omit at most three leading continuation bytes, and leave an incomplete
    // ending sequence for the next window rather than corrupting its evidence.
    let start = 0;
    while (start < Math.min(3, bytes.length) && (bytes[start] & 0xc0) === 0x80) start++;
    let end = bytes.length, source;
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    const maxRemoved = offset + readBytes < Number(before.size) ? 3 : 0;
    for (let removed = 0; removed <= maxRemoved && end >= start; removed++, end--) {
      try { source = decoder.decode(bytes.subarray(start, end)); break; } catch {}
    }
    if (source === undefined || source.includes("\u0000")) return obstruction("bounded-text-window-unavailable");
    const nextByteOffset = offset + end;
    const eof = nextByteOffset === Number(before.size);
    if (!eof && nextByteOffset <= offset) return obstruction("bounded-text-window-unavailable");
    const selected = bytes.subarray(start, end);
    return Object.freeze({
      kind: "metroplat.filesystem.workspace-file-window-readout",
      path: relative(canonicalRoot, file).split("\\").join("/"),
      revision, byteOffset: offset + start, byteCount: selected.length, readBytes,
      contentAddress: "sha256:" + createHash("sha256").update(selected).digest("hex"),
      source, eof, nextByteOffset,
      evidence: Object.freeze(["operation:direct-file-seek", "carrier:bounded-byte-window",
        "revision:witnessed-file-metadata", "content-address:returned-window-only"]),
    });
  } catch { return obstruction("source-window-unavailable"); }
  finally { if (descriptor !== undefined) closeSync(descriptor); }
}


import { sha256Digest } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/integrity";
import { closeSync, existsSync, fstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

function confined(root, path) {
  const absolute = resolve(root, path);
  const real = realpathSync(absolute);
  if (real !== root && !real.startsWith(`${root}${sep}`)) throw new Error(`context path escapes root: ${path}`);
  return real;
}
function bounded(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative integer`);
  return value;
}

// Locate a requested line interval with fixed-size scanning; retain at most the
// remaining evidence budget plus one byte to distinguish a complete excerpt.
function selectedBytes(fd, size, capacity, candidate) {
  const firstLine = candidate.line ?? 1, lastLine = candidate.endLine;
  const output = Buffer.alloc(Math.min(size, capacity) + 1);
  const chunk = Buffer.alloc(64 * 1024);
  let currentLine = 1, position = 0, byteOffset = firstLine === 1 ? 0 : null;
  let count = 0, eof = false, endReached = false;
  while (!endReached && count < output.length) {
    const length = readSync(fd, chunk, 0, chunk.length, null);
    if (length === 0) { eof = true; break; }
    if (chunk.subarray(0, length).includes(0)) return { binary: true };
    let start = 0;
    while (currentLine < firstLine && start < length) {
      const newline = chunk.indexOf(10, start);
      if (newline === -1 || newline >= length) { start = length; break; }
      start = newline + 1; currentLine += 1;
    }
    if (currentLine >= firstLine) {
      if (byteOffset === null) byteOffset = position + start;
      let end = length;
      if (lastLine !== undefined) {
        let cursor = start;
        while (cursor < length) {
          const newline = chunk.indexOf(10, cursor);
          if (newline === -1 || newline >= length) break;
          if (currentLine === lastLine) { end = newline + 1; endReached = true; break; }
          currentLine += 1; cursor = newline + 1;
        }
      }
      const copied = Math.min(end - start, output.length - count);
      chunk.copy(output, count, start, start + copied); count += copied;
      // The interval ended in this chunk, but its bytes may exceed the budget.
      if (copied < end - start) endReached = false;
    }
    position += length;
  }
  // A final line need not end with a newline. Observed EOF still completes it.
  const actualEndLine = byteOffset === null ? 0 : firstLine + output.subarray(0, count).reduce((n, byte) => n + (byte === 10 ? 1 : 0), 0) - (count > 0 && output[count - 1] === 10 ? 1 : 0);
  return { buffer: output, count, byteOffset, missing: byteOffset === null || (count === 0 && firstLine > 1), complete: endReached || eof && (lastLine === undefined || actualEndLine >= lastLine) };
}

/** Read current, explicitly selected sources. No admissions, logs, or inferred memories. */
export function readCodingContext({ root, paths = [], intent = "", identity = {}, constraints = [], maxBytes, maxFiles, instructions = true, requireComplete = false } = {}) {
  if (typeof root !== "string" || !Array.isArray(paths)) throw new TypeError("root and paths are required");
  root = realpathSync(root);
  const budgetBytes = bounded(maxBytes, 64_000, "maxBytes"), fileLimit = bounded(maxFiles, 64, "maxFiles");
  const candidates = new Map(), omitted = [], evidence = [];
  const add = (path, role, line, endLine) => {
    const absolute = resolve(root, path);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error(`context path escapes root: ${path}`);
    const key = relative(root, absolute).split(sep).join("/") || ".";
    const selection = JSON.stringify([key, line ?? 1, endLine ?? null]);
    if (!candidates.has(selection)) candidates.set(selection, { path: key, role, ...(line === undefined ? {} : {line}), ...(endLine === undefined ? {} : {endLine}) });
  };
  const requested = paths.map((item) => typeof item === "string" ? { path: item, role: "requested" } : item);
  for (const item of requested) {
    if (!item || typeof item.path !== "string") throw new TypeError("each context path must be a string or {path, role, line, endLine}");
    for (const name of ["line", "endLine"]) if (item[name] !== undefined && (!Number.isSafeInteger(item[name]) || item[name] < 1)) throw new TypeError(`${name} must be a positive integer`);
    if (item.endLine !== undefined && item.endLine < (item.line ?? 1)) throw new TypeError("endLine precedes line");
    const absolute = resolve(root, item.path);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error(`context path escapes root: ${item.path}`);
    if (instructions) {
      let at = existsSync(absolute) && statSync(absolute).isDirectory() ? absolute : dirname(absolute);
      const ancestors = [];
      while (at === root || at.startsWith(`${root}${sep}`)) { ancestors.unshift(at); if (at === root) break; at = dirname(at); }
      for (const directory of ancestors) for (const name of ["AGENTS.md", "CLAUDE.md"]) if (existsSync(join(directory, name))) add(join(directory, name), "instructions");
    }
  }
  for (const item of requested) add(item.path, item.role ?? "requested", item.line, item.endLine);
  let usedBytes = 0;
  for (const candidate of candidates.values()) {
    let fd;
    try {
      const absolute = confined(root, candidate.path);
      fd = openSync(absolute, "r");
      const stat = fstatSync(fd);
      if (!stat.isFile()) { omitted.push({ ...candidate, reason: "not-a-file" }); continue; }
      const remaining = budgetBytes - usedBytes;
      if (evidence.length >= fileLimit || remaining === 0) { omitted.push({ ...candidate, reason: evidence.length >= fileLimit ? "file-budget" : "byte-budget", bytes: stat.size }); continue; }
      if (requireComplete && candidate.line === undefined && candidate.endLine === undefined && stat.size > remaining) { omitted.push({ ...candidate, reason: "complete-artifact-exceeds-budget", bytes: stat.size }); continue; }
      const selection = selectedBytes(fd, stat.size, remaining, candidate);
      if (selection.binary) { omitted.push({ ...candidate, reason: "binary" }); continue; }
      if (selection.missing) { omitted.push({ ...candidate, reason: "line-range-outside-source", bytes: stat.size }); continue; }
      const after = fstatSync(fd);
      if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) { omitted.push({ ...candidate, reason: "source-changed-during-read" }); continue; }
      const { buffer, count, byteOffset } = selection;
      let admitted = Math.min(count, remaining);
      // Exclude a partial UTF-8 scalar; an excerpt must never invent replacement bytes.
      let text;
      while (admitted >= 0) { try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, admitted)); break; } catch { if (count <= remaining || count - admitted > 4) break; admitted -= 1; } }
      if (text === undefined) { omitted.push({ ...candidate, reason: "invalid-utf8" }); continue; }
      const truncated = count > admitted || !selection.complete;
      if (requireComplete && truncated) { omitted.push({ ...candidate, reason: "source-changed-or-incomplete", bytes: stat.size }); continue; }
      if (admitted === 0 && stat.size > 0) { omitted.push({ ...candidate, reason: "byte-budget", bytes: stat.size }); continue; }
      evidence.push({ ...candidate, digest: sha256Digest(text), digestScope: byteOffset === 0 && admitted === stat.size ? "file" : "excerpt", bytes: stat.size, suppliedBytes: admitted, byteOffset, omittedBytes: stat.size - admitted, line: candidate.line ?? 1, endLine: (candidate.line ?? 1) + (text === "" ? 0 : text.split("\n").length - 1 - (text.endsWith("\n") ? 1 : 0)), ...((candidate.line !== undefined || candidate.endLine !== undefined) ? { requestedRange: { line: candidate.line ?? 1, endLine: candidate.endLine ?? null } } : {}), truncated, text });
      usedBytes += admitted;
    } catch (error) { omitted.push({ ...candidate, reason: error.code === "ENOENT" ? "missing" : "unreadable-or-outside-root", diagnostic: error.message }); }
    finally { if (fd !== undefined) closeSync(fd); }
  }
  const result = { kind: "coding-context.sources", root, intent, identity, constraints, requestedPaths: requested.map(({path, line, endLine}) => line === undefined && endLine === undefined ? path : {path, ...(line === undefined ? {} : {line}), ...(endLine === undefined ? {} : {endLine})}), budgetBytes, usedBytes, evidence, omitted, complete: omitted.length === 0 && evidence.every(({truncated}) => !truncated) };
  return { ...result, id: sha256Digest(JSON.stringify(result)) };
}

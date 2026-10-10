#!/usr/bin/env node
import { readFileText } from "@red-cup-engineering/computer-file-engineering-services-section/read-file";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

const HAND_REGISTERED_YIELD = /yield\s+Object\.freeze\(\{\s*module:\s*"([^"]+)"/gu;

/**
 * Reads one catalog module's source text and counts every statically
 * module-named `yield Object.freeze({ module: "...", ... })` statement --
 * the hand-imported operation families the catalog registers from inside
 * the package rather than mounting from a FERN's admitted operations. A
 * `yield` inside a loop over an externally supplied source never matches,
 * because its `module` is a loop variable, not a literal string.
 * @param {{ catalogPath: string, baseline: number }} input
 * @returns {Promise<{ kind: "check-hand-registered-operations", count: number,
 *   baseline: number, ok: boolean, families: readonly string[] }>}
 * @throws {TypeError} When `input.catalogPath` or `input.baseline` is missing or malformed.
 */
export async function checkHandRegisteredOperations(input) {
  if (!input || typeof input !== "object") throw new TypeError("check-hand-registered-operations: input must be an object");
  if (typeof input.catalogPath !== "string" || input.catalogPath.length === 0) {
    throw new TypeError("check-hand-registered-operations: input.catalogPath must be a non-empty string");
  }
  if (typeof input.baseline !== "number" || !Number.isInteger(input.baseline) || input.baseline < 0) {
    throw new TypeError("check-hand-registered-operations: input.baseline must be a non-negative integer");
  }
  const text = await readFileText(input.catalogPath);
  const families = [...text.matchAll(HAND_REGISTERED_YIELD)].map((match) => match[1]);
  return Object.freeze({
    kind: "check-hand-registered-operations",
    count: families.length,
    baseline: input.baseline,
    ok: families.length <= input.baseline,
    families: Object.freeze(families),
  });
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "check-hand-registered-operations", description: "Reads one catalog module's source text and counts every statically module-named `yield Object.freeze({ module: \"...\", ...", operation: checkHandRegisteredOperations }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}

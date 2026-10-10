# check-hand-registered-operations
## Requirements
- `count-hand-registered-yields`: The operation reads a catalog module's source text at `input.catalogPath` and counts every statically module-named `yield Object.freeze({ module: "...", ... })` statement -- the hand-imported operation families a package's catalog registers from inside the package rather than mounting from a FERN's admitted operations.
- `ratchet-against-baseline`: The operation compares the counted total against `input.baseline` and reports `ok: true` only when the count is at or below the baseline, so the baseline may only fall over time as families migrate onto a FERN.
- `name-every-family`: The operation returns the exact list of matched module names as `families`, in source order, so a caller can see which families still need migrating.
## Prohibitions
- `no-loop-yield-miscount`: The operation must not count a `yield` inside a `for`/`for..of` loop over an externally supplied source (a FERN's `trustedOperationSources`, a generic `Object.entries` table) as a hand-registered family -- only a `yield` whose `module` is a literal string counts.
- `no-mutation`: The operation must not write to `input.catalogPath`; it only reads the file.
## Laws
- `primitives-live-once` | Primitives live once, on the registry (asserted 2026-08-30) | v1 | .claude/rules/org-layering.md | Applies to composing file-services for the one filesystem read this operation performs. | Primitives exist once, on the registry, interdependent, never copied.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to .mjs sources and package-birth assays. | The package uses one executable ESM operation source file.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/check-hand-registered-operations-service","packageVersion":"0.1.0","license":"UNLICENSED","dependencies":{"@red-cup-engineering/computer-file-engineering-services-section":"0.2.1"},"devDependencies":{"@red-cup-engineering/remove-path-service":"0.1.0"}}
```
## Operation
```mjs path=scripts/check-hand-registered-operations.mjs
#!/usr/bin/env node
import { readFileText } from "@red-cup-engineering/computer-file-engineering-services-section/read-file";

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
 *   baseline: number, ok: boolean, families: string[] }>}
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
  if (process.argv.includes("--help")) {
    process.stdout.write("checkHandRegisteredOperations — Reads one catalog module's source text and counts every statically module-named `yield Object.freeze({ module: \"...\", ... })` statement -- the hand-imported operation families the catalog registers from inside the package rather than mounting from a FERN's admitted operations. A `yield` inside a loop over an externally supplied source never matches, because its `module` is a loop variable, not a literal string.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.trim().length === 0) continue;
      process.stdout.write(`${JSON.stringify(await checkHandRegisteredOperations(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/check-hand-registered-operations.test.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeFileText } from "@red-cup-engineering/computer-file-engineering-services-section/write-file";
import { removePath } from "@red-cup-engineering/remove-path-service";
import { checkHandRegisteredOperations } from "../scripts/check-hand-registered-operations.mjs";

const SAMPLE_CATALOG = `function* serviceSources() {
  for (const [module, operations] of Object.entries(builtinOperationModules)) yield Object.freeze({ module, operations });
  for (const source of trustedOperationSources) yield Object.freeze({ module: source.module, operations: source.operations });
  yield Object.freeze({ module: "@red-cup-engineering/metroplat/markdown-files", operations: markdownFileWorkbenchOperations(binding) });
  yield Object.freeze({ module: "@red-cup-engineering/metroplat/claude-fleet", operations: claudeFleetOperations(binding) });
}
`;

async function withFixturePath(text, run) {
  const path = join(tmpdir(), `check-hand-registered-operations-test-${randomUUID()}.mts`);
  await writeFileText(path, text);
  try {
    await run(path);
  } finally {
    await removePath({ path });
  }
}

test("refuses a missing catalogPath", async () => {
  await assert.rejects(
    checkHandRegisteredOperations({ baseline: 0 }),
    /catalogPath must be a non-empty string/u,
  );
});

test("refuses a missing or malformed baseline", async () => {
  await assert.rejects(
    checkHandRegisteredOperations({ catalogPath: "/tmp/does-not-matter" }),
    /baseline must be a non-negative integer/u,
  );
});

test("counts only statically module-named yields, never loop yields", async () => {
  await withFixturePath(SAMPLE_CATALOG, async (path) => {
    const result = await checkHandRegisteredOperations({ catalogPath: path, baseline: 2 });
    assert.equal(result.kind, "check-hand-registered-operations");
    assert.equal(result.count, 2);
    assert.deepEqual(result.families, [
      "@red-cup-engineering/metroplat/markdown-files",
      "@red-cup-engineering/metroplat/claude-fleet",
    ]);
    assert.equal(result.ok, true);
  });
});

test("reports ok:false when the count exceeds the baseline", async () => {
  await withFixturePath(SAMPLE_CATALOG, async (path) => {
    const result = await checkHandRegisteredOperations({ catalogPath: path, baseline: 1 });
    assert.equal(result.count, 2);
    assert.equal(result.baseline, 1);
    assert.equal(result.ok, false);
  });
});

test("a catalog with one more yield than the baseline fails the check", async () => {
  const grown = SAMPLE_CATALOG.replace(
    'yield Object.freeze({ module: "@red-cup-engineering/metroplat/claude-fleet", operations: claudeFleetOperations(binding) });',
    'yield Object.freeze({ module: "@red-cup-engineering/metroplat/claude-fleet", operations: claudeFleetOperations(binding) });\n  yield Object.freeze({ module: "@red-cup-engineering/metroplat/one-more", operations: oneMoreOperations(binding) });',
  );
  await withFixturePath(grown, async (path) => {
    const baselineResult = await checkHandRegisteredOperations({ catalogPath: path, baseline: 2 });
    assert.equal(baselineResult.count, 3);
    assert.equal(baselineResult.ok, false);
  });
});
```
## Examples
```json name="a package manifest carries no hand-registered yields"
{"input":{"catalogPath":"package.json","baseline":0},"output":{"kind":"check-hand-registered-operations","count":0,"baseline":0,"ok":true,"families":[]}}
```
## Traceability
- `count-hand-registered-yields` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-live-once`, `node-esm-operation`
- `ratchet-against-baseline` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `name-every-family` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-loop-yield-miscount` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-mutation` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-live-once`, `node-esm-operation`

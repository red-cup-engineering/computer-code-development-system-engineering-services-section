import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeFileText } from "@red-cup-engineering/computer-file-engineering-services-section/write-file";
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
    await rm(path, { recursive: true, force: true });
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

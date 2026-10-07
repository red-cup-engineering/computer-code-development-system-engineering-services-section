import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageJsonDirectoryProvider } from "../src/monitoring/package-json-directory-provider.mjs";

test("packageJsonDirectoryProvider().observe requires an explicit observedAt (no clock read)", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fars-package-json-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const provider = packageJsonDirectoryProvider({ id: "pkg", root });
  await assert.rejects(provider.observe(), /observedAt is required/);
  await assert.rejects(provider.observe({}), /observedAt is required/);
  const outcome = await provider.observe({ observedAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(outcome.resources, []);
});

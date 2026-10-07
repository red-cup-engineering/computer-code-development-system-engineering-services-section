import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "jsnode-engineering-cli-"));
  for (const [directory, name, description] of [["one", "@x/one", "first fixture"], ["two", "@x/two", "second fixture"]]) {
    const packageDirectory = path.join(root, directory);
    mkdirSync(path.join(packageDirectory, "src"), { recursive: true });
    writeFileSync(path.join(packageDirectory, "package.json"), JSON.stringify({ name, version: "1.0.0", description, exports: "./src/index.mjs" }));
    writeFileSync(path.join(packageDirectory, "src/index.mjs"), "export const fixture = true;\n");
  }
  return root;
}

const executable = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./cli.mjs");

test("the symlinked direct-Node bin invokes the CLI", () => {
  const root = mkdtempSync(path.join(tmpdir(), "jsnode-engineering-cli-bin-"));
  try {
    const bin = path.join(root, "jsnode-engineering-cli");
    symlinkSync(executable, bin);
    const result = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /usage: jsnode-engineering-cli/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the direct bin reads a bounded fixture workspace", () => {
  const root = fixture();
  try {
    const result = spawnSync(process.execPath, [executable, "workspace", "--root", root, "--format", "names"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split("\n").sort(), ["@x/one", "@x/two"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

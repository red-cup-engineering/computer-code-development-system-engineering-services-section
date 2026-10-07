import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJSNodePackage, discoverWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/workspace/workspace";
import { runCli } from "./cli.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function capture() { let text = ""; return { write: (value) => { text += value; }, text: () => text }; }
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "jsnode-cli-workspace-"));
  for (const [directory, name, description, dependencies] of [["topology", "@fixture/jsnode-topology", "fixture topology", {}], ["reader", "@fixture/reader", "fixture reader", { "@fixture/jsnode-topology": "1.0.0" }]]) {
    const dir = path.join(root, directory, "src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.mjs"), "export const fixture = true;\n");
    writeFileSync(path.join(root, directory, "package.json"), JSON.stringify({ name, version: "1.0.0", description, dependencies, exports: "./src/index.mjs" }));
  }
  return root;
}

describe("direct workspace packages", () => {
  it("reads this CLI manifest", async () => {
    const pkg = await readJSNodePackage(PACKAGE_ROOT);
    assert.equal(pkg?.name, "@red-cup-engineering/computer-code-development-engine/cli");
    assert.ok(pkg?.exports.includes("./cli"));
  });
  it("discovers and projects a fixture workspace", async () => {
    const root = fixture();
    try {
      const workspace = await discoverWorkspace(root);
      assert.deepEqual(workspace.packages.map((pkg) => pkg.name).sort(), ["@fixture/jsnode-topology", "@fixture/reader"]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("search and describe use the direct workspace projection", async () => {
    const root = fixture();
    try {
      const out = capture();
      assert.equal(await runCli(["search", "reader", "--root", root], { stdout: out, stderr: capture() }), 0);
      assert.match(out.text(), /@fixture\/reader/);
      const describe = capture();
      assert.equal(await runCli(["describe", "@fixture/reader", "--root", root], { stdout: describe, stderr: capture() }), 0);
      assert.match(describe.text(), /depends-on: @fixture\/jsnode-topology/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

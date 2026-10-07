import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { discoverWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/workspace/workspace";
import { classifyLiberties, derivePackageLiberties } from "./package-liberties.mjs";
// Four fixture manifests exercising all three classes, both routes into
// atari (a lone consumer, and lone publication with no consumer):
//
//   @fixture/a — depended on by b and c (2 consumers), unpublished  -> live (2)
//   @fixture/b — depended on by c only (1 consumer), unpublished    -> atari (1, via consumer)
//   @fixture/c — depended on by nobody, published                  -> atari (1, via publication)
//   @fixture/d — depended on by nobody, unpublished                -> captured (0)
let root;
function pkg(name, dependencies = {}) {
    const dir = path.join(root, name.replace("@fixture/", ""));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", dependencies }), "utf8");
}
before(() => {
    root = mkdtempSync(path.join(tmpdir(), "package-liberties-"));
    pkg("@fixture/a");
    pkg("@fixture/b", { "@fixture/a": "1.0.0" });
    pkg("@fixture/c", { "@fixture/a": "1.0.0", "@fixture/b": "1.0.0" });
    pkg("@fixture/d");
});
after(() => {
    rmSync(root, { recursive: true, force: true });
});
describe("classifyLiberties", () => {
    it("0 is captured, 1 is atari, 2+ is live", () => {
        assert.equal(classifyLiberties(0), "captured");
        assert.equal(classifyLiberties(1), "atari");
        assert.equal(classifyLiberties(2), "live");
        assert.equal(classifyLiberties(5), "live");
    });
});
describe("derivePackageLiberties", () => {
    it("classifies all three boards from consumers and publication, sorted by name", async () => {
        const workspace = await discoverWorkspace(root);
        const published = new Set(["@fixture/c"]);
        const readout = await derivePackageLiberties(workspace, async (name) => published.has(name));
        assert.deepEqual(readout.packages.map((p) => p.name), ["@fixture/a", "@fixture/b", "@fixture/c", "@fixture/d"]);
        const a = readout.packages.find((p) => p.name === "@fixture/a");
        assert.deepEqual(a.consumers, ["@fixture/b", "@fixture/c"]);
        assert.equal(a.published, false);
        assert.equal(a.liberties, 2);
        assert.equal(a.classification, "live");
        const b = readout.packages.find((p) => p.name === "@fixture/b");
        assert.deepEqual(b.consumers, ["@fixture/c"]);
        assert.equal(b.published, false);
        assert.equal(b.liberties, 1);
        assert.equal(b.classification, "atari");
        const c = readout.packages.find((p) => p.name === "@fixture/c");
        assert.deepEqual(c.consumers, []);
        assert.equal(c.published, true);
        assert.equal(c.liberties, 1);
        assert.equal(c.classification, "atari");
        const d = readout.packages.find((p) => p.name === "@fixture/d");
        assert.deepEqual(d.consumers, []);
        assert.equal(d.published, false);
        assert.equal(d.liberties, 0);
        assert.equal(d.classification, "captured");
        assert.equal(readout.counts.packages, 4);
        assert.equal(readout.counts.live, 1);
        assert.equal(readout.counts.atari, 2);
        assert.equal(readout.counts.captured, 1);
        assert.deepEqual(readout.live.map((p) => p.name), ["@fixture/a"]);
        assert.deepEqual(readout.atari.map((p) => p.name), ["@fixture/b", "@fixture/c"]);
        assert.deepEqual(readout.captured.map((p) => p.name), ["@fixture/d"]);
        assert.equal(readout.offline, false);
        assert.equal(readout.root, root);
    });
    it("an unknown (null) publish check never counts toward liberties", async () => {
        const workspace = await discoverWorkspace(root);
        const readout = await derivePackageLiberties(workspace, async () => null, { offline: true });
        const c = readout.packages.find((p) => p.name === "@fixture/c");
        assert.equal(c.published, null);
        assert.equal(c.liberties, 0);
        assert.equal(c.classification, "captured");
        assert.equal(readout.offline, true);
    });
    it("is deterministic across repeated runs", async () => {
        const workspace = await discoverWorkspace(root);
        const published = new Set(["@fixture/c"]);
        const first = await derivePackageLiberties(workspace, async (name) => published.has(name));
        const second = await derivePackageLiberties(workspace, async (name) => published.has(name));
        assert.deepEqual(first, second);
    });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eachWorkspacePackageDir } from "@red-cup-engineering/javascript-computer";
import { discoverWorkspace, workspaceFromDiscoveredPackages } from "./workspace.mjs";
// A fake workspace of four lib packages, plus one directory that has no
// manifest at all (an "archive" tree). Exclusion is a pure argument: the walk
// drops the names you hand it, exact or by `*` wildcard, and nothing else.
let root;
function pkg(dir, name) {
    const pkgDir = path.join(root, dir);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name, version: "0.0.0" }), "utf8");
}
before(() => {
    root = mkdtempSync(path.join(tmpdir(), "workspace-"));
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - lib/*\n", "utf8");
    pkg("lib/core", "@x/core");
    pkg("lib/keepme", "@x/keepme");
    pkg("lib/playground", "@x/playground");
    pkg("lib/foo-experimental", "@x/foo-experimental");
    // a manifest-less directory — must never surface as a package.
    mkdirSync(path.join(root, "lib", "archive", "deep"), { recursive: true });
    writeFileSync(path.join(root, "lib", "archive", "deep", "route.ts"), "export function POST() {}\n", "utf8");
    // a Python virtualenv nested under a package dir — its own package.json (a
    // vendored npm dependency of a Python tool) must never surface, and its
    // subtree must never be descended into at all.
    pkg("lib/core/.venv/lib/python3.13/site-packages/some-vendored-npm-shim", "@vendored/should-not-surface");
    pkg(".claude/worktrees/copied-checkout/lib/copied", "@copied/should-not-surface");
});
after(() => {
    rmSync(root, { recursive: true, force: true });
});
function names(filter) {
    return [...eachWorkspacePackageDir(root, filter)].map((p) => p.name).sort();
}
describe("eachWorkspacePackageDir exclusion", () => {
    it("excludes nothing by default, and skips manifest-less directories", () => {
        assert.deepEqual(names(), ["@x/core", "@x/foo-experimental", "@x/keepme", "@x/playground"]);
    });
    it("drops an exact name", () => {
        assert.deepEqual(names({ exclude: ["@x/playground"] }), [
            "@x/core",
            "@x/foo-experimental",
            "@x/keepme",
        ]);
    });
    it("drops names by `*` wildcard", () => {
        assert.deepEqual(names({ exclude: ["@x/*-experimental"] }), [
            "@x/core",
            "@x/keepme",
            "@x/playground",
        ]);
    });
    it("treats `[]` as exclude-nothing", () => {
        assert.equal(names({ exclude: [] }).length, 4);
    });
    it("never descends into a .venv (Python virtualenv trees carry no workspace packages)", () => {
        assert.ok(!names().includes("@vendored/should-not-surface"));
    });
    it("never treats Codex worktree replicas as independent workspace packages", () => {
        assert.ok(!names().includes("@copied/should-not-surface"));
    });
});
describe("discoverWorkspace honours the same exclusion", () => {
    it("omits excluded packages from the carrier set", async () => {
        const ws = await discoverWorkspace(root, { exclude: ["@x/playground", "@x/*-experimental"] });
        const got = ws.packages.map((p) => p.name).sort();
        assert.deepEqual(got, ["@x/core", "@x/keepme"]);
    });
});
describe("workspaceFromDiscoveredPackages", () => {
    it("projects the collected manifest snapshot after its source file changes or disappears", () => {
        pkg("lib/snapshot", "@x/snapshot");
        const snapshot = [...eachWorkspacePackageDir(root)];
        const manifestPath = path.join(root, "lib/snapshot/package.json");
        writeFileSync(manifestPath, JSON.stringify({ name: "@x/replacement", version: "9.9.9" }), "utf8");
        rmSync(manifestPath);
        const workspace = workspaceFromDiscoveredPackages(root, snapshot);
        assert.deepEqual(workspace.packages.map((candidate) => candidate.name).sort(), [
            "@x/core",
            "@x/foo-experimental",
            "@x/keepme",
            "@x/playground",
            "@x/snapshot",
        ]);
        assert.equal(workspace.packages.find((candidate) => candidate.name === "@x/snapshot")?.version, "0.0.0");
    });
});

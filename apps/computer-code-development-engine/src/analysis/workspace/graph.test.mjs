import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jsNodePackage, jsNodeWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { discoverWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/workspace/workspace";
import { workspaceDependencyGraph, egoGraph } from "./graph.mjs";
function findRepositoryRoot(start) {
    let current = path.resolve(start);
    while (!existsSync(path.join(current, ".git"))) {
        const parent = path.dirname(current);
        if (parent === current)
            throw new Error("repository root not found");
        current = parent;
    }
    return current;
}
const REPO_ROOT = findRepositoryRoot(path.dirname(fileURLToPath(import.meta.url)));
// A tiny hand-built workspace: app → lib, lib → (external npm), and a leaf.
function fixture() {
    return jsNodeWorkspace("/fake", [
        jsNodePackage({
            name: "@x/app", version: "1.0.0", description: "the app", layer: "apps",
            exports: ["."], dependencies: ["@x/core", "zod"],
        }),
        jsNodePackage({
            name: "@x/core", version: "1.0.0", description: "the core", layer: "lib",
            exports: ["."], dependencies: ["@x/util", "left-pad"],
        }),
        jsNodePackage({
            name: "@x/util", version: "1.0.0", description: "leaf util", layer: "lib",
            exports: ["."], dependencies: [],
        }),
    ]);
}
describe("workspaceDependencyGraph", () => {
    it("keeps a node per discovered package", () => {
        const g = workspaceDependencyGraph(fixture());
        assert.deepEqual(g.nodes.map((n) => n.name), ["@x/app", "@x/core", "@x/util"]);
    });
    it("drops external-npm deps, keeping only internal edges", () => {
        const g = workspaceDependencyGraph(fixture());
        assert.deepEqual(g.edges, [
            { from: "@x/app", to: "@x/core" },
            { from: "@x/core", to: "@x/util" },
        ]);
        // zod / left-pad never appear as a node or an edge target.
        const targets = new Set(g.edges.map((e) => e.to));
        assert.ok(!targets.has("zod") && !targets.has("left-pad"));
    });
    it("denormalizes the internal deps onto each node", () => {
        const g = workspaceDependencyGraph(fixture());
        const core = g.nodes.find((n) => n.name === "@x/core");
        assert.deepEqual(core?.dependencies, ["@x/util"]);
        assert.deepEqual(g.nodes.find((n) => n.name === "@x/util")?.dependencies, []);
    });
    it("carries node coordinates through", () => {
        const app = workspaceDependencyGraph(fixture()).nodes[0];
        assert.equal(app?.layer, "apps");
        assert.equal(app?.description, "the app");
        assert.equal(app?.version, "1.0.0");
    });
    it("over the real repo: closed over its own package set", async () => {
        const g = workspaceDependencyGraph(await discoverWorkspace(REPO_ROOT));
        assert.ok(g.nodes.length > 50, `expected >50 packages, got ${g.nodes.length}`);
        const names = new Set(g.nodes.map((n) => n.name));
        // every edge endpoint is itself a node — no external leaves leaked in.
        for (const e of g.edges) {
            assert.ok(names.has(e.from), `edge from ${e.from} is not a node`);
            assert.ok(names.has(e.to), `edge to ${e.to} is not a node`);
        }
    });
});
// A wider fixture for neighbourhood tests: two apps over a shared core, a leaf
// under the core, and an unrelated package that must never be pulled in.
function egoFixture() {
    return workspaceDependencyGraph(jsNodeWorkspace("/fake", [
        jsNodePackage({ name: "@x/app", version: "1.0.0", description: "", layer: "apps", exports: ["."], dependencies: ["@x/core"] }),
        jsNodePackage({ name: "@x/app2", version: "1.0.0", description: "", layer: "apps", exports: ["."], dependencies: ["@x/core"] }),
        jsNodePackage({ name: "@x/core", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: ["@x/util"] }),
        jsNodePackage({ name: "@x/util", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: [] }),
        jsNodePackage({ name: "@x/unrelated", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: [] }),
    ]));
}
describe("egoGraph", () => {
    it("includes the focus, its direct deps and direct dependents at depth 1", () => {
        const ego = egoGraph(egoFixture(), "@x/core");
        assert.deepEqual(ego.nodes.map((n) => n.name).sort(), ["@x/app", "@x/app2", "@x/core", "@x/util"]);
        assert.ok(!ego.nodes.some((n) => n.name === "@x/unrelated"), "unrelated package excluded");
    });
    it("keeps only edges whose endpoints are both in the neighbourhood", () => {
        const ego = egoGraph(egoFixture(), "@x/core");
        for (const e of ego.edges) {
            assert.ok(ego.nodes.some((n) => n.name === e.from));
            assert.ok(ego.nodes.some((n) => n.name === e.to));
        }
        // core's denormalised deps stay consistent with the filtered set.
        assert.deepEqual(ego.nodes.find((n) => n.name === "@x/core")?.dependencies, ["@x/util"]);
    });
    it("depth 0 either side yields the focus alone", () => {
        const ego = egoGraph(egoFixture(), "@x/core", { upDepth: 0, downDepth: 0 });
        assert.deepEqual(ego.nodes.map((n) => n.name), ["@x/core"]);
        assert.deepEqual(ego.edges, []);
    });
    it("reaches transitively with deeper depth", () => {
        // From the app, two dependency hops reach util via core.
        const ego = egoGraph(egoFixture(), "@x/app", { downDepth: 2, upDepth: 0 });
        assert.deepEqual(ego.nodes.map((n) => n.name).sort(), ["@x/app", "@x/core", "@x/util"]);
    });
    it("returns an empty graph for an unknown package", () => {
        assert.deepEqual(egoGraph(egoFixture(), "@x/nope"), { nodes: [], edges: [] });
    });
});
describe("egoGraph — over the real repo", () => {
    it("a hub package's neighbourhood is a closed subset of the full graph", async () => {
        const full = workspaceDependencyGraph(await discoverWorkspace(REPO_ROOT));
        // Pick the hub *structurally* — the package with the most internal
        // dependents — rather than naming any one package, so this test cannot rot
        // as packages merge, split, or get renamed.
        const dependentCount = new Map();
        for (const n of full.nodes)
            dependentCount.set(n.name, 0);
        for (const e of full.edges)
            dependentCount.set(e.to, (dependentCount.get(e.to) ?? 0) + 1);
        const hub = [...dependentCount.entries()].sort((a, b) => b[1] - a[1])[0];
        assert.ok(hub && hub[1] > 0, "expected at least one depended-on package");
        const hubName = hub[0];
        const ego = egoGraph(full, hubName);
        const egoNames = new Set(ego.nodes.map((n) => n.name));
        const fullNames = new Set(full.nodes.map((n) => n.name));
        assert.ok(egoNames.has(hubName), "focus is present");
        assert.ok(ego.nodes.length < full.nodes.length, "neighbourhood is a strict subset");
        for (const n of egoNames)
            assert.ok(fullNames.has(n), `${n} is a real node`);
        for (const e of ego.edges) {
            assert.ok(egoNames.has(e.from) && egoNames.has(e.to), "edge stays within the neighbourhood");
        }
    });
});

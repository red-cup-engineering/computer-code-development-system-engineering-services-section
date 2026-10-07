import { test } from "node:test";
import assert from "node:assert/strict";
import { jsNodePackage, jsNodeWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { workspaceDependencies } from "./dependencies.mjs";
import { workspaceConsistency } from "./consistency.mjs";
import { buildOrder } from "./build-order.mjs";
import { workspaceLifecycle } from "./lifecycle.mjs";
import { workspaceDependencyGraph } from "./graph.mjs";
function pkg(over) {
    return jsNodePackage({
        version: "0.0.0",
        description: "",
        layer: "lib",
        exports: ["."],
        dependencies: [],
        ...over,
    });
}
// A workspace where two packages pin typescript at different ranges (drift) and
// one external dep is shared; meme-topology depends on meme-algebra internally.
function workspace() {
    return jsNodeWorkspace("/repo", [
        pkg({
            name: "@emsenn/meme-algebra",
            description: "the meme algebra",
            license: "MIT",
            engines: { node: ">=22" },
            scripts: ["build", "test"],
            moduleType: "module",
            deps: [{ name: "typescript", range: "^5.8.0", kind: "dev" }],
        }),
        pkg({
            name: "@emsenn/meme-topology",
            dependencies: ["@emsenn/meme-algebra"],
            engines: { node: ">=24" },
            scripts: ["build"],
            moduleType: "module",
            deps: [
                { name: "@emsenn/meme-algebra", range: "workspace:*", kind: "runtime" },
                { name: "typescript", range: "^5.9.0", kind: "dev" },
                { name: "zod", range: "^3.0.0", kind: "runtime" },
            ],
        }),
    ]);
}
test("the dependency report gathers external deps with their version ranges", () => {
    const rep = workspaceDependencies(workspace());
    const ts = rep.entries.find((e) => e.name === "typescript");
    assert.equal(ts.internal, false);
    assert.equal(ts.usedBy, 2);
    assert.deepEqual([...ts.ranges].sort(), ["^5.8.0", "^5.9.0"]);
});
test("a dependency pinned at two ranges is flagged as drift", () => {
    const rep = workspaceDependencies(workspace());
    assert.ok(rep.drift.some((d) => d.name === "typescript"), "typescript drifts");
    const ts = rep.entries.find((e) => e.name === "typescript");
    assert.equal(ts.drift, true);
    // zod is pinned one way only — not drift.
    assert.equal(rep.entries.find((e) => e.name === "zod").drift, false);
});
test("internal vs external dependencies are distinguished", () => {
    const rep = workspaceDependencies(workspace());
    assert.equal(rep.entries.find((e) => e.name === "@emsenn/meme-algebra").internal, true);
    assert.equal(rep.entries.find((e) => e.name === "zod").internal, false);
    assert.ok(rep.externalCount >= 2 && rep.internalCount >= 1);
});
test("consistency reports the node-engine spread and folds in the drift", () => {
    const c = workspaceConsistency(workspace());
    assert.equal(c.nodeEngines.length, 2); // >=22 and >=24
    assert.ok(c.driftCount >= 1 && c.driftNames.includes("typescript"));
});
test("consistency surfaces script-coverage gaps for a common script", () => {
    // `test` is defined by two of three packages — common — and the third lacks it.
    const ws = jsNodeWorkspace("/repo", [
        pkg({ name: "@x/a", scripts: ["build", "test"] }),
        pkg({ name: "@x/b", scripts: ["build", "test"] }),
        pkg({ name: "@x/c", scripts: ["build"] }),
    ]);
    const c = workspaceConsistency(ws);
    const testCov = c.scripts.find((s) => s.script === "test");
    assert.ok(testCov, "test is recognised as a common script");
    assert.equal(testCov.have, 2);
    assert.deepEqual([...testCov.missing], ["@x/c"]);
});
test("consistency flags missing license (the field most manifests omit)", () => {
    const c = workspaceConsistency(workspace());
    assert.ok(c.missingLicense.includes("@emsenn/meme-topology"));
    assert.ok(!c.missingLicense.includes("@emsenn/meme-algebra"));
});
test("build order tiers dependencies before dependents", () => {
    const bo = buildOrder(workspaceDependencyGraph(workspace()));
    assert.equal(bo.acyclic, true);
    assert.deepEqual(bo.tiers[0], ["@emsenn/meme-algebra"]); // no deps, builds first
    assert.deepEqual(bo.tiers[1], ["@emsenn/meme-topology"]);
    assert.deepEqual([...bo.order], ["@emsenn/meme-algebra", "@emsenn/meme-topology"]);
});
// A workspace with an active package depending on a deprecated one (migration
// debt), plus an abandoned package missing a description (which must be exempt).
function lifecycleWorkspace() {
    return jsNodeWorkspace("/repo", [
        pkg({ name: "@x/active", description: "live", dependencies: ["@x/old"], scripts: ["build", "test"] }),
        pkg({ name: "@x/old", description: "going away", tags: ["deprecated"], scripts: ["build"] }),
        pkg({ name: "@x/frozen", description: "", tags: ["abandoned"], version: "1.0.0" }),
    ]);
}
test("lifecycle gathers cohorts and the active→deprecated migration debt", () => {
    const lc = workspaceLifecycle(workspaceDependencyGraph(lifecycleWorkspace()));
    assert.deepEqual([...lc.byLifecycle.deprecated], ["@x/old"]);
    assert.deepEqual([...lc.byLifecycle.abandoned], ["@x/frozen"]);
    assert.deepEqual([...lc.migrationDebt], [{ from: "@x/active", to: "@x/old" }]);
    const old = lc.deprecated.find((d) => d.name === "@x/old");
    assert.deepEqual([...old.activeDependents], ["@x/active"]);
});
test("maturity cohorts come from versions (0.0.0 experimental, 1.0.0 stable)", () => {
    const lc = workspaceLifecycle(workspaceDependencyGraph(lifecycleWorkspace()));
    assert.ok(lc.byMaturity.experimental.includes("@x/active"));
    assert.ok(lc.byMaturity.stable.includes("@x/frozen"));
});
test("consistency exempts deprecated and abandoned from hygiene gaps", () => {
    const c = workspaceConsistency(lifecycleWorkspace());
    // @x/frozen has no description but is abandoned → exempt, not nagged.
    assert.ok(!c.missingDescription.includes("@x/frozen"));
    assert.ok(c.exempt.includes("@x/frozen") && c.exempt.includes("@x/old"));
    assert.equal(c.activeCount, 1);
    assert.equal(c.lifecycleCounts.deprecated, 1);
    assert.equal(c.lifecycleCounts.abandoned, 1);
});

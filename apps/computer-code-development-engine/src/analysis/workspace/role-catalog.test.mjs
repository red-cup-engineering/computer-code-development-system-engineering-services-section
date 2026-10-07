import { test } from "node:test";
import assert from "node:assert/strict";
import { roleCatalog, roleCatalogEntry } from "./role-catalog.mjs";
import { JSNODE_ROLES } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
// Two SYNTHETIC domains, alpha and beta, sharing roles — none names a real
// workspace package. alpha: algebra ← topology ← geometry; beta: topology,
// codecs-http. One cross-domain edge beta-topology → alpha-algebra, and one
// role-less package (beta-server) that must be counted, not catalogued.
function graph() {
    const spec = [
        ["@scope/alpha-algebra", "the alpha algebra", []],
        ["@scope/alpha-topology", "the alpha topology", ["@scope/alpha-algebra"]],
        ["@scope/alpha-geometry", "", ["@scope/alpha-topology"]],
        ["@scope/beta-topology", "", ["@scope/alpha-algebra", "@scope/beta-codecs-http"]],
        ["@scope/beta-codecs-http", "", []],
        ["@other/beta-server", "", ["@scope/beta-topology"]],
    ];
    const nodes = spec.map(([name, description, dependencies]) => ({
        name,
        version: "0.0.0",
        description,
        layer: "lib",
        tags: [],
        lifecycle: "active",
        maturity: "experimental",
        dependencies,
    }));
    const edges = spec.flatMap(([name, , deps]) => deps.map((to) => ({ from: name, to })));
    return { nodes, edges };
}
test("the catalog lists every role in stratum order", () => {
    const cat = roleCatalog(graph());
    assert.deepEqual(cat.roles.map((r) => r.role), [...JSNODE_ROLES]);
    cat.roles.forEach((r, i) => assert.equal(r.stratum, i));
});
test("a role gathers every package instantiating it, across domains", () => {
    const cat = roleCatalog(graph());
    const topology = cat.roles.find((r) => r.role === "topology");
    assert.deepEqual(topology.members.map((m) => m.name), ["@scope/alpha-topology", "@scope/beta-topology"]);
    assert.deepEqual([...topology.domains], ["alpha", "beta"]);
});
test("each role carries its authored gloss verbatim, never synthesised", () => {
    const cat = roleCatalog(graph());
    const algebra = cat.roles.find((r) => r.role === "algebra");
    assert.match(algebra.gloss, /generators and relations at the base/);
    assert.ok(algebra.source.length > 0);
});
test("role-less packages are counted but not catalogued under any role", () => {
    const cat = roleCatalog(graph());
    assert.equal(cat.rolelessCount, 1); // @other/beta-server
    for (const r of cat.roles) {
        assert.ok(!r.members.some((m) => m.name === "@other/beta-server"));
    }
});
test("cross-role dependency is read off the graph (topology depends on algebra)", () => {
    const cat = roleCatalog(graph());
    const topology = cat.roles.find((r) => r.role === "topology");
    assert.ok(topology.dependsOn.includes("algebra"));
    const algebra = cat.roles.find((r) => r.role === "algebra");
    assert.ok(algebra.dependedOnBy.includes("topology"));
});
test("roleCatalogEntry returns undefined for a non-role string", () => {
    assert.equal(roleCatalogEntry(graph(), "not-a-role"), undefined);
    assert.ok(roleCatalogEntry(graph(), "codecs"));
});

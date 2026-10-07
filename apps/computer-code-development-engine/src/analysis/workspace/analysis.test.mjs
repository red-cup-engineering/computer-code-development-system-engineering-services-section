import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceAnalysis, roleDomainGrid, roleQuotientGraph } from "./analysis.mjs";
// A small hand-built graph: a → b → c (a chain), plus an isolated node d, and
// a separate pair e ↔ f forming a 2-cycle.
function graph() {
    const names = ["a", "b", "c", "d", "e", "f"];
    const nodes = names.map((name) => ({
        name,
        version: "0.0.0",
        description: "",
        layer: "lib",
        tags: [],
        lifecycle: "active",
        maturity: "experimental",
        dependencies: [],
    }));
    const edges = [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "e", to: "f" },
        { from: "f", to: "e" },
    ];
    return { nodes, edges };
}
test("the chain a→b→c has its deepest stratum at the chain's head", () => {
    const a = workspaceAnalysis(graph());
    const byName = new Map(a.centrality.map((c) => [c.name, c]));
    assert.equal(byName.get("a").stratum, 2);
    assert.equal(byName.get("c").stratum, 0);
});
test("an unconnected node is counted as its own component", () => {
    const a = workspaceAnalysis(graph());
    // {a,b,c}, {d}, {e,f} = 3 weakly-connected components.
    assert.equal(a.componentCount, 3);
    assert.ok(a.components.some((c) => c.size === 1 && c.members[0] === "d"));
});
test("a mutual dependency e↔f is reported as a cycle, so the graph is not acyclic", () => {
    const a = workspaceAnalysis(graph());
    assert.equal(a.acyclic, false);
    assert.ok(a.cycles.some((c) => c.includes("e") && c.includes("f")));
});
test("the most depended-upon package sorts first in centrality", () => {
    const a = workspaceAnalysis(graph());
    // b and c each have one dependent; the sort is stable on dependents desc.
    assert.ok(a.centrality[0].dependents >= a.centrality[a.centrality.length - 1].dependents);
});
test("the fibration grid places a package at its (domain, role) coordinate", () => {
    // Synthetic names: a roled package lands in its (domain, role) cell, a
    // role-less one (alpha-server has no known role suffix) in the "—" column.
    const grid = roleDomainGrid(["@scope/alpha-topology", "@scope/alpha-algebra", "@scope/alpha-server"]);
    const alphaTop = grid.cells.find((c) => c.domain === "alpha" && c.role === "topology");
    assert.ok(alphaTop);
    assert.ok(alphaTop.packages.includes("@scope/alpha-topology"));
    // alpha-server has no known role, so it lands in the "—" column.
    assert.ok(grid.cells.some((c) => c.role === "—" && c.packages.includes("@scope/alpha-server")));
});
// A small role-bearing graph for the quotient. Two domains (a, b) each with a
// topology and an algebra, plus a role-less app. Edges:
//   a-topology → a-algebra   (within domain "a"; topology depends down → "with")
//   b-algebra  → a-topology  (cross domain; algebra depends up → "against")
//   app        → a-topology  (role-less depender → "unranked")
// The two roled cross-edges make algebra ⇄ topology mutually dependent.
function roledGraph() {
    const mk = (name, dependencies) => ({
        name, version: "0.0.0", description: "", layer: "lib", tags: [], lifecycle: "active", maturity: "experimental", dependencies,
    });
    const nodes = [
        mk("@x/a-topology", ["@x/a-algebra"]),
        mk("@x/a-algebra", []),
        mk("@x/b-algebra", ["@x/a-topology"]),
        mk("@x/app", ["@x/a-topology"]),
    ];
    const edges = [
        { from: "@x/a-topology", to: "@x/a-algebra" },
        { from: "@x/b-algebra", to: "@x/a-topology" },
        { from: "@x/app", to: "@x/a-topology" },
    ];
    return { nodes, edges };
}
test("the role quotient contracts packages sharing a role to one node", () => {
    const q = roleQuotientGraph(roledGraph());
    // Roles present: algebra, topology, and the role-less bucket → 3 nodes.
    assert.equal(q.order, 3);
    assert.deepEqual([...q.roles], ["algebra", "topology", "—"]);
    const topo = q.nodes.find((n) => n.role === "topology");
    assert.equal(topo.packages, 1);
    assert.equal(topo.stratum, 1); // topology is index 1 in the declared order
});
test("a within-domain dependency lands in the vertical mass, a cross-domain one in the horizontal", () => {
    const q = roleQuotientGraph(roledGraph());
    assert.equal(q.withinDomainEdges, 1); // a-topology → a-algebra
    assert.equal(q.crossDomainEdges, 2); // b-algebra → a-topology, app → a-topology
    const topoAlg = q.edges.find((e) => e.from === "topology" && e.to === "algebra");
    assert.equal(topoAlg.withinDomain, 1);
    assert.equal(topoAlg.crossDomain, 0);
});
test("topology depending on algebra runs with the declared order; algebra on topology runs against it", () => {
    const q = roleQuotientGraph(roledGraph());
    assert.equal(q.edges.find((e) => e.from === "topology" && e.to === "algebra").declaredOrder, "with");
    assert.equal(q.edges.find((e) => e.from === "algebra" && e.to === "topology").declaredOrder, "against");
    // role-less depender → unranked
    assert.equal(q.edges.find((e) => e.from === "—").declaredOrder, "unranked");
    assert.ok(q.againstDeclared.some((e) => e.from === "algebra" && e.to === "topology"));
});
test("mutually depending roles make the quotient non-acyclic and report the entangled class", () => {
    const q = roleQuotientGraph(roledGraph());
    assert.equal(q.acyclic, false);
    assert.ok(q.entangled.some((c) => c.includes("algebra") && c.includes("topology")));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { domainAtlas, domainQuotientGraph } from "./domain.mjs";
import { roleQuotientGraph } from "./analysis.mjs";
// A hand-built workspace over two SYNTHETIC domains, alpha and beta. None of
// these names is a package that exists in the workspace — they are chosen only
// to exercise the (domain, role) split and the graph-shape invariants. alpha has
// three roles forming an internal chain (algebra ← topology ← geometry); beta
// has two, one of them a codecs subpath (beta-codecs-http) whose qualifier the
// coordinate parser must strip when it derives beta's domain. One cross-domain
// edge runs beta-topology → alpha-algebra.
function graph() {
    const spec = [
        ["@scope/alpha-algebra", "the alpha algebra", []],
        ["@scope/alpha-topology", "", ["@scope/alpha-algebra"]],
        ["@scope/alpha-geometry", "", ["@scope/alpha-topology"]],
        ["@scope/beta-topology", "", ["@scope/alpha-algebra", "@scope/beta-codecs-http"]],
        ["@scope/beta-codecs-http", "", []],
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
test("a domain gathers every package sharing its prefix as its members", () => {
    const atlas = domainAtlas(graph());
    const alpha = atlas.domains.find((d) => d.domain === "alpha");
    assert.ok(alpha);
    assert.equal(alpha.size, 3);
    assert.deepEqual(alpha.roles, ["algebra", "topology", "geometry"]);
});
test("a codecs subpath member is gathered under its base domain with the qualifier stripped", () => {
    // beta-codecs-http must land under domain "beta" (not "beta-codecs" or
    // "beta-codecs-http"): the coordinate parser strips the trailing qualifier
    // when deriving the domain, and the atlas groups on that derived domain.
    const atlas = domainAtlas(graph());
    const beta = atlas.domains.find((d) => d.domain === "beta");
    assert.ok(beta);
    const codec = beta.members.find((m) => m.name === "@scope/beta-codecs-http");
    assert.ok(codec, "the codecs subpath package is a member of beta");
    assert.equal(codec.role, "codecs");
    assert.equal(codec.qualifier, "http");
});
test("the synopsis is a member's verbatim description, never fabricated", () => {
    const atlas = domainAtlas(graph());
    const alpha = atlas.domains.find((d) => d.domain === "alpha");
    // Only alpha-algebra carries a description, so it is the representative.
    assert.equal(alpha.synopsis, "the alpha algebra");
    assert.equal(alpha.synopsisFrom, "@scope/alpha-algebra");
    // beta's members all lack descriptions, so the synopsis is empty (not invented).
    const beta = atlas.domains.find((d) => d.domain === "beta");
    assert.equal(beta.synopsis, "");
    assert.equal(beta.synopsisFrom, null);
});
test("a domain's imports are exactly the other domains it depends on", () => {
    const atlas = domainAtlas(graph());
    const beta = atlas.domains.find((d) => d.domain === "beta");
    assert.deepEqual(beta.dependsOn, ["alpha"]);
    const alpha = atlas.domains.find((d) => d.domain === "alpha");
    assert.deepEqual(alpha.dependedOnBy, ["beta"]);
    // alpha's three-package chain is two internal edges.
    assert.equal(alpha.internalEdges, 2);
});
test("the domain quotient contracts each package to its domain", () => {
    const q = domainQuotientGraph(graph());
    assert.deepEqual([...q.domains].sort(), ["alpha", "beta"]);
    const betaToAlpha = q.edges.find((e) => e.from === "beta" && e.to === "alpha");
    assert.ok(betaToAlpha);
    assert.equal(betaToAlpha.weight, 1);
});
// The load-bearing theorem: the domain and role quotients partition the SAME
// edge set, so the domain quotient's within/cross totals must equal the role
// quotient's. This validates both duals against each other.
test("the domain quotient and role quotient agree on the within/cross-domain split", () => {
    const g = graph();
    const dq = domainQuotientGraph(g);
    const rq = roleQuotientGraph(g);
    assert.equal(dq.withinDomainTotal, rq.withinDomainEdges);
    assert.equal(dq.crossDomainTotal, rq.crossDomainEdges);
    assert.equal(dq.withinDomainTotal + dq.crossDomainTotal, g.edges.length);
});
test("the domain quotient is acyclic when no two subjects mutually depend", () => {
    const q = domainQuotientGraph(graph());
    assert.equal(q.acyclic, true);
    assert.deepEqual(q.entangled, []);
    // alpha is depended on by beta; beta by nobody.
    assert.equal(q.mostDependedOn[0].domain, "alpha");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { graphSpectrum, spanningTreeCount, spectralComponentCount, berkowitzCharPoly, integerLaplacian, bareissDeterminant, packageNeighbourhoodSpectrum, workspaceSpectrum, } from "./spectrum.mjs";
// Undirected adjacency builders for the classical graphs whose invariants are
// known closed forms — the cross-checks that pin the arithmetic.
function complete(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : 1)));
}
function path(n) {
    const a = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i + 1 < n; i++) {
        a[i][i + 1] = 1;
        a[i + 1][i] = 1;
    }
    return a;
}
function cycle(n) {
    const a = path(n);
    if (n >= 3) {
        a[0][n - 1] = 1;
        a[n - 1][0] = 1;
    }
    return a;
}
function star(n) {
    // one centre, n leaves
    const a = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        a[0][i] = 1;
        a[i][0] = 1;
    }
    return a;
}
test("Cayley's formula: the complete graph K_n has n^(n-2) spanning trees", () => {
    assert.equal(spanningTreeCount(complete(3)), 3n); // 3^1
    assert.equal(spanningTreeCount(complete(4)), 16n); // 4^2
    assert.equal(spanningTreeCount(complete(5)), 125n); // 5^3
    assert.equal(spanningTreeCount(complete(6)), 1296n); // 6^4
});
test("a path and a star are trees, so each has exactly one spanning tree", () => {
    assert.equal(spanningTreeCount(path(7)), 1n);
    assert.equal(spanningTreeCount(star(20)), 1n);
});
test("the cycle C_n has exactly n spanning trees", () => {
    assert.equal(spanningTreeCount(cycle(3)), 3n);
    assert.equal(spanningTreeCount(cycle(8)), 8n);
});
test("a disconnected graph has no spanning tree and a component per island", () => {
    // two disjoint edges: {0,1} and {2,3}
    const a = [
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
    ];
    assert.equal(spanningTreeCount(a), 0n);
    assert.equal(spectralComponentCount(a), 2);
});
test("the Laplacian characteristic polynomial of the path P3 is x(x-1)(x-3)", () => {
    // eigenvalues 0, 1, 3 → (x)(x-1)(x-3) = x^3 - 4x^2 + 3x → low→high [0, 3, -4, 1]
    const cp = berkowitzCharPoly(integerLaplacian(path(3)));
    assert.deepEqual(cp, [0n, 3n, -4n, 1n]);
});
test("the Laplacian characteristic polynomial is monic with a vanishing constant term", () => {
    // monic (leading 1) and singular (a connected graph's Laplacian has a zero
    // eigenvalue, so the constant term is 0) for every connected graph.
    for (const g of [path(5), cycle(6), complete(5), star(8)]) {
        const cp = berkowitzCharPoly(integerLaplacian(g));
        assert.equal(cp[cp.length - 1], 1n, "monic");
        assert.equal(cp[0], 0n, "singular Laplacian");
    }
});
test("the x^1 coefficient of the Laplacian char poly is ± n times the tree count (Kirchhoff)", () => {
    for (const g of [complete(5), cycle(7), star(6)]) {
        const n = g.length;
        const cp = berkowitzCharPoly(integerLaplacian(g));
        const tau = spanningTreeCount(g);
        // coeff of x^1, up to sign, is n·τ.
        const c1 = cp[1] < 0n ? -cp[1] : cp[1];
        assert.equal(c1, BigInt(n) * tau);
    }
});
test("the x^(n-1) coefficient is minus the trace of the Laplacian, i.e. -2|E|", () => {
    const g = complete(5); // 10 edges, trace = 2·10 = 20; n = 5
    const cp = berkowitzCharPoly(integerLaplacian(g)); // length n+1 = 6, low→high
    assert.equal(cp[g.length], 1n); // leading coeff of x^n is monic
    assert.equal(cp[g.length - 1], -20n); // coeff of x^(n-1) = -trace
});
test("Bareiss determinant agrees with a known small determinant", () => {
    // det [[2,-1],[-1,2]] = 3 (the reduced Laplacian of a triangle)
    assert.equal(bareissDeterminant([[2n, -1n], [-1n, 2n]]), 3n);
});
test("graphSpectrum reports the cyclomatic number E − V + C", () => {
    const s = graphSpectrum(cycle(5)); // 5 edges, 5 vertices, 1 component → 1 independent cycle
    assert.equal(s.cyclomatic, 1);
    assert.equal(s.components, 1);
    const t = graphSpectrum(complete(4)); // 6 edges, 4 vertices, 1 comp → 3
    assert.equal(t.cyclomatic, 3);
});
// --- the slice layer over a hand-built workspace graph ---
function node(name) {
    return {
        name,
        version: "0.0.0",
        description: "",
        layer: "lib",
        tags: [],
        lifecycle: "active",
        maturity: "experimental",
        dependencies: [],
    };
}
// hub h depended on by three leaves x,y,z; the leaves also all depend on a
// shared base b — so h's radius-1 neighbourhood {h,x,y,z} is a star (tree),
// while b's neighbourhood {b,x,y,z} is also a star.
function meshGraph() {
    const nodes = ["h", "x", "y", "z", "b"].map(node);
    const edges = [
        { from: "x", to: "h" },
        { from: "y", to: "h" },
        { from: "z", to: "h" },
        { from: "x", to: "b" },
        { from: "y", to: "b" },
        { from: "z", to: "b" },
    ];
    return { nodes, edges };
}
test("a package whose neighbourhood is a star has exactly one spanning tree", () => {
    const s = packageNeighbourhoodSpectrum(meshGraph(), "h");
    assert.ok(s);
    // radius-1 of h: h plus its three dependents x,y,z (none depend on each other)
    assert.equal(s.order, 4);
    assert.equal(s.spanningTrees, "1");
    assert.equal(s.exact, true);
    assert.equal(s.charPolyDegree, 4);
});
// f depends on a and b, and a depends on b — so f, a, b form a triangle. The
// radius-1 neighbourhood of f (its dependencies a, b are joined by the a→b edge)
// is a 3-cycle, redundantly wired.
function triangleGraph() {
    const nodes = ["f", "a", "b", "c"].map(node);
    const edges = [
        { from: "f", to: "a" },
        { from: "f", to: "b" },
        { from: "a", to: "b" },
        { from: "c", to: "f" },
    ];
    return { nodes, edges };
}
test("a package whose dependencies depend on each other sees a redundantly-wired neighbourhood", () => {
    const s = packageNeighbourhoodSpectrum(triangleGraph(), "f");
    assert.ok(s);
    // radius-1 of f: f, its dependencies a and b (joined by a→b), and its
    // dependent c — a triangle f–a–b with a pendant c. The triangle alone has 3
    // spanning trees; the pendant edge is forced, so the count stays 3.
    assert.equal(s.order, 4);
    assert.equal(s.spanningTrees, "3");
    assert.ok(BigInt(s.spanningTrees) > 1n, "more than one spanning tree");
});
test("an unknown package has no neighbourhood spectrum", () => {
    assert.equal(packageNeighbourhoodSpectrum(meshGraph(), "nope"), undefined);
});
test("the workspace spectrum's component count cross-checks the weak component count", () => {
    const ws = workspaceSpectrum(meshGraph());
    assert.equal(ws.kind, "jsnode.spectrum");
    assert.equal(ws.order, 5);
    assert.equal(ws.components, 1); // h,x,y,z,b are all one connected island
    // ranked by spanning-tree count, descending
    for (let i = 1; i < ws.spectra.length; i++) {
        assert.ok(BigInt(ws.spectra[i - 1].spanningTrees) >= BigInt(ws.spectra[i].spanningTrees));
    }
});
test("the workspace component count is the spectral Laplacian nullity, counting every island", () => {
    // meshGraph's {h,x,y,z,b} plus a disjoint pair {p,q} → two components, read as
    // the multiplicity of the whole-graph Laplacian's zero eigenvalue.
    const base = meshGraph();
    const nodes = [...base.nodes, node("p"), node("q")];
    const edges = [...base.edges, { from: "p", to: "q" }];
    const ws = workspaceSpectrum({ nodes, edges });
    assert.equal(ws.order, 7);
    assert.equal(ws.components, 2);
});

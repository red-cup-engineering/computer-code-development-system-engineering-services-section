import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { workspaceTypeFlow, typeFlowNeighbourhood, shortestPipeline } from "./type-flow.mjs";
// A two-package index forming a cross-package pipeline A → B → C, plus a name
// (`Options`) declared in both packages — the collision that must be excluded —
// and a function producing C only from a foreign type (so C has a producer but
// no addressable upstream edge).
const INDEX = {
    types: [
        { pkg: "@x/p", name: "A", kind: "interface" },
        { pkg: "@x/p", name: "B", kind: "interface" },
        { pkg: "@y/q", name: "C", kind: "interface" },
        { pkg: "@x/p", name: "Options", kind: "type-alias" },
        { pkg: "@y/q", name: "Options", kind: "type-alias" },
    ],
    functions: [
        { pkg: "@x/p", name: "toB", domain: ["A", "Options"], codomain: "B" },
        { pkg: "@y/q", name: "toC", domain: ["B"], codomain: "C" },
        { pkg: "@y/q", name: "fromString", domain: ["string"], codomain: "A" },
    ],
    subtypes: [],
};
const edge = (f, from, to) => f.edges.some((e) => e.from === from && e.to === to);
describe("workspaceTypeFlow", () => {
    it("draws a composition edge A→B when a function takes A and produces B", () => {
        const f = workspaceTypeFlow(INDEX);
        assert.ok(edge(f, "A", "B"), "toB: A → B");
        assert.ok(edge(f, "B", "C"), "toC: B → C");
    });
    it("excludes a type name declared in more than one package (not addressable)", () => {
        const f = workspaceTypeFlow(INDEX);
        assert.ok(f.ambiguousNames.includes("Options"), "Options is ambiguous");
        assert.ok(!f.nodes.some((n) => n.name === "Options"), "no Options node");
        assert.ok(!f.edges.some((e) => e.from === "Options" || e.to === "Options"), "no Options edge");
        assert.equal(f.ambiguous, 1);
    });
    it("counts an edge crossing package boundaries as a transformation seam", () => {
        const f = workspaceTypeFlow(INDEX);
        // B (@x/p) → C (@y/q) crosses; A (@x/p) → B (@x/p) does not.
        assert.equal(f.crossPackageEdges, 1);
    });
    it("marks a type no function produces as a source, none consumes as a sink", () => {
        const f = workspaceTypeFlow(INDEX);
        // A is produced by fromString, so it is not a source; C is consumed by
        // nothing, so it is a sink.
        assert.ok(f.sinks.includes("C"), "C is a sink");
        assert.ok(!f.sources.includes("A"), "A has a producer (fromString)");
    });
});
describe("typeFlowNeighbourhood", () => {
    it("presents a type by the functions that produce and consume it (its hom-functor)", () => {
        const f = workspaceTypeFlow(INDEX);
        const n = typeFlowNeighbourhood(INDEX, f, "B");
        assert.equal(n.producedBy.map((p) => p.name).join(","), "toB");
        assert.equal(n.consumedBy.map((p) => p.name).join(","), "toC");
        assert.deepEqual(n.upstream.map((r) => r.name), ["A"]);
        assert.deepEqual(n.downstream.map((r) => r.name), ["C"]);
        // a type ref carries its single declaring package
        assert.equal(n.downstream[0].pkg, "@y/q");
    });
    it("reaches every type downstream by composition", () => {
        const f = workspaceTypeFlow(INDEX);
        const a = typeFlowNeighbourhood(INDEX, f, "A");
        assert.deepEqual(a.reaches.map((r) => r.name).sort(), ["B", "C"]);
    });
    it("returns undefined for an ambiguous or unknown name", () => {
        const f = workspaceTypeFlow(INDEX);
        assert.equal(typeFlowNeighbourhood(INDEX, f, "Options"), undefined);
        assert.equal(typeFlowNeighbourhood(INDEX, f, "Nope"), undefined);
    });
});
describe("shortestPipeline", () => {
    it("returns the function sequence that transforms one type into another", () => {
        const f = workspaceTypeFlow(INDEX);
        const path = shortestPipeline(f, "A", "C");
        assert.equal(path.map((e) => e.fn).join(" → "), "toB → toC");
    });
    it("returns null when the target is unreachable", () => {
        const f = workspaceTypeFlow(INDEX);
        assert.equal(shortestPipeline(f, "C", "A"), null);
    });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { packageSymbolGraph } from "./symbol-graph.mjs";
// A hand-built index: one package with classes/interface/type-alias, functions
// over them (including a structured `readonly Account[]` domain and a
// `Promise<Amount>` codomain), an internal and an external subtype, plus an
// unrelated package that must never leak in.
const INDEX = {
    types: [
        { pkg: "@x/p", name: "Account", kind: "class" },
        { pkg: "@x/p", name: "Ledger", kind: "interface" },
        { pkg: "@x/p", name: "Amount", kind: "type-alias" },
        { pkg: "@x/p", name: "BaseAccount", kind: "class" },
        { pkg: "@other", name: "Foreign", kind: "class" },
    ],
    functions: [
        { pkg: "@x/p", name: "credit", domain: ["Account", "Amount"], codomain: "Account" },
        { pkg: "@x/p", name: "toLedger", domain: ["readonly Account[]"], codomain: "Ledger" },
        { pkg: "@x/p", name: "parse", domain: ["string"], codomain: "Promise<Amount>" },
        { pkg: "@other", name: "noise", domain: ["Account"], codomain: "Account" },
    ],
    subtypes: [
        { pkg: "@x/p", sub: "Account", base: "BaseAccount" },
        { pkg: "@x/p", sub: "Account", base: "Error" }, // foreign base — must drop
    ],
};
const has = (g, from, to, kind) => g.edges.some((e) => e.from === from && e.to === to && e.kind === kind);
describe("packageSymbolGraph", () => {
    it("makes a node for each internal type and function, excluding other packages", () => {
        const g = packageSymbolGraph(INDEX, "@x/p");
        assert.deepEqual(g.nodes.map((n) => `${n.kind}:${n.name}`).sort(), ["class:Account", "class:BaseAccount", "function:credit", "function:parse", "function:toLedger", "interface:Ledger", "type-alias:Amount"]);
        assert.ok(g.populated);
    });
    it("runs an arc in from each domain type and out to the codomain type", () => {
        const g = packageSymbolGraph(INDEX, "@x/p");
        assert.ok(has(g, "type:Account", "fn:credit", "param"), "Account → credit");
        assert.ok(has(g, "type:Amount", "fn:credit", "param"), "Amount → credit");
        assert.ok(has(g, "fn:credit", "type:Account", "returns"), "credit → Account");
    });
    it("resolves a type out of a structured domain/codomain expression", () => {
        const g = packageSymbolGraph(INDEX, "@x/p");
        assert.ok(has(g, "type:Account", "fn:toLedger", "param"), "readonly Account[] → toLedger");
        assert.ok(has(g, "fn:toLedger", "type:Ledger", "returns"));
        assert.ok(has(g, "fn:parse", "type:Amount", "returns"), "Promise<Amount> resolves to Amount");
    });
    it("keeps internal subtype edges and drops foreign bases", () => {
        const g = packageSymbolGraph(INDEX, "@x/p");
        assert.ok(has(g, "type:Account", "type:BaseAccount", "extends"));
        assert.ok(!g.edges.some((e) => e.kind === "extends" && e.to === "type:Error"), "foreign base dropped");
    });
    it("draws no arc for a function over only foreign types", () => {
        const g = packageSymbolGraph(INDEX, "@x/p");
        // parse(string) has no internal param arc — string is not a package type.
        assert.ok(!g.edges.some((e) => e.to === "fn:parse" && e.kind === "param"));
    });
    it("an unbuilt / unknown package yields an empty, unpopulated graph", () => {
        const g = packageSymbolGraph(INDEX, "@x/missing");
        assert.deepEqual(g.nodes, []);
        assert.deepEqual(g.edges, []);
        assert.equal(g.populated, false);
    });
});

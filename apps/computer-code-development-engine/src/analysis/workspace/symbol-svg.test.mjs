import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { packageSymbolGraph } from "./symbol-graph.mjs";
import { symbolGraphSvg } from "./symbol-svg.mjs";
const INDEX = {
    types: [
        { pkg: "@x/p", name: "Account", kind: "class" },
        { pkg: "@x/p", name: "Ledger", kind: "interface" },
        { pkg: "@x/p", name: "Amount", kind: "type-alias" },
    ],
    functions: [{ pkg: "@x/p", name: "credit", domain: ["Account", "Amount"], codomain: "Account" }],
    subtypes: [],
};
const svg = () => symbolGraphSvg(packageSymbolGraph(INDEX, "@x/p"));
describe("symbolGraphSvg", () => {
    it("emits a well-formed-ish svg", () => {
        const s = svg();
        assert.ok(s.startsWith("<svg"));
        assert.ok(s.trimEnd().endsWith("</svg>"));
    });
    it("tags each symbol with its kind for shape-by-kind and machine reading", () => {
        const s = svg();
        assert.ok(s.includes(`data-kind="class"`));
        assert.ok(s.includes(`data-kind="interface"`));
        assert.ok(s.includes(`data-kind="type-alias"`));
        assert.ok(s.includes(`data-kind="function"`));
    });
    it("draws a distinct shape per kind", () => {
        const s = svg();
        assert.ok(/<polygon /.test(s), "type-alias renders as a parallelogram polygon");
        assert.ok(/rx="13"/.test(s), "interface renders rounded");
        assert.ok(/stroke-dasharray/.test(s), "interface is dashed");
    });
    it("carries the relation edges with from/to/kind", () => {
        const s = svg();
        assert.ok(s.includes(`data-from="type:Account"`) && s.includes(`data-to="fn:credit"`));
        assert.ok(s.includes(`data-kind="param"`));
        assert.ok(s.includes(`data-kind="returns"`));
    });
    it("documents its shape vocabulary in <desc> for agents", () => {
        const s = svg();
        assert.ok(/<desc>.*rectangle = class.*pill = function/s.test(s));
    });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsNodePackage, jsNodeWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { workspaceDependencyGraph } from "./graph.mjs";
import { dependencyGraphSvg, layoutDependencyGraph } from "./svg.mjs";
function graph() {
    return workspaceDependencyGraph(jsNodeWorkspace("/fake", [
        jsNodePackage({ name: "@x/app", version: "1.0.0", description: "the <app>", layer: "apps", exports: ["."], dependencies: ["@x/core"] }),
        jsNodePackage({ name: "@x/core", version: "1.0.0", description: "core", layer: "lib", exports: ["."], dependencies: ["@x/util"] }),
        jsNodePackage({ name: "@x/util", version: "1.0.0", description: "leaf", layer: "lib", exports: ["."], dependencies: [] }),
    ]));
}
describe("layoutDependencyGraph", () => {
    it("ranks roots at depth 0 and foundations below by longest consumer path", () => {
        const l = layoutDependencyGraph(graph());
        const depthOf = (name) => l.nodes.find((p) => p.node.name === name).depth;
        assert.equal(depthOf("@x/app"), 0); // nothing depends on the app — it's a root
        assert.equal(depthOf("@x/core"), 1);
        assert.equal(depthOf("@x/util"), 2); // most foundational — sinks to the base
        assert.equal(l.maxDepth, 2);
    });
    it("places foundations at the base (largest y), roots at the top", () => {
        const l = layoutDependencyGraph(graph());
        const cy = (name) => l.nodes.find((p) => p.node.name === name).cy;
        assert.ok(cy("@x/util") > cy("@x/core"), "foundation should sit below its consumer");
        assert.ok(cy("@x/core") > cy("@x/app"));
    });
    it("floats an incidental leaf up to its consumer instead of crushing it to the base", () => {
        // @x/app depends on both a deep chain (core -> deepfoundation) and a leaf
        // used only by the app. The shared deep foundation must sink to the base;
        // the app-only leaf should rank just below the app, not down with it.
        const g = workspaceDependencyGraph(jsNodeWorkspace("/fake", [
            jsNodePackage({ name: "@x/app", version: "1.0.0", description: "", layer: "apps", exports: ["."], dependencies: ["@x/core", "@x/leaf"] }),
            jsNodePackage({ name: "@x/core", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: ["@x/deepfoundation"] }),
            jsNodePackage({ name: "@x/deepfoundation", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: [] }),
            jsNodePackage({ name: "@x/leaf", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: [] }),
        ]));
        const l = layoutDependencyGraph(g);
        const depthOf = (name) => l.nodes.find((p) => p.node.name === name).depth;
        assert.equal(depthOf("@x/app"), 0);
        assert.equal(depthOf("@x/leaf"), 1, "app-only leaf floats up beside core, not to the base");
        assert.equal(depthOf("@x/deepfoundation"), 2, "shared deep foundation sinks to the base");
    });
    it("does not loop on a dependency cycle", () => {
        const cyclic = workspaceDependencyGraph(jsNodeWorkspace("/fake", [
            jsNodePackage({ name: "@x/a", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: ["@x/b"] }),
            jsNodePackage({ name: "@x/b", version: "1.0.0", description: "", layer: "lib", exports: ["."], dependencies: ["@x/a"] }),
        ]));
        const l = layoutDependencyGraph(cyclic);
        assert.equal(l.nodes.length, 2);
    });
});
describe("dependencyGraphSvg", () => {
    it("emits a well-formed-ish svg with a node per package", () => {
        const svg = dependencyGraphSvg(graph());
        assert.ok(svg.startsWith("<svg"));
        assert.ok(svg.trimEnd().endsWith("</svg>"));
        for (const name of ["@x/app", "@x/core", "@x/util"]) {
            assert.ok(svg.includes(`data-name="${name}"`), `missing node ${name}`);
        }
    });
    it("xml-escapes names and descriptions", () => {
        const svg = dependencyGraphSvg(graph());
        assert.ok(svg.includes("the &lt;app&gt;"), "description must be escaped");
        assert.ok(!svg.includes("the <app>"));
    });
    it("makes nodes clickable when an href mapper is given", () => {
        const svg = dependencyGraphSvg(graph(), { href: (n) => `/pkg/${encodeURIComponent(n.name)}` });
        assert.ok(svg.includes(`href="/pkg/%40x%2Fapp"`));
        assert.ok(svg.includes("<a "));
    });
    it("carries a self-describing <desc> with counts", () => {
        const svg = dependencyGraphSvg(graph());
        assert.ok(/<desc>3 packages, 2 internal dependency edges/.test(svg));
    });
});

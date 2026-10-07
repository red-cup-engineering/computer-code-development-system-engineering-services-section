/**
 * build-order — in what order do the workspace's packages build?
 *
 * The plainest question a monorepo raises and the one the role/spectral views
 * never answer: a package can be built only once everything it depends on is
 * built. That is a topological sort of the internal dependency graph, grouped
 * into tiers — tier 0 (no internal dependencies) builds first, each later tier
 * depends only on earlier ones, so every tier could build in parallel. When the
 * graph has a cycle the packages in it cannot be linearly ordered; they are
 * reported as `unordered` rather than silently dropped.
 *
 * Pure over the dependency graph; no I/O. Edge convention: `from` depends on
 * `to` (dependent → dependency).
 */
import { createGraph, topologicalTiers } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
/** Topologically tier the internal dependency graph. Delegates to
 *  SignGraph's shared Kahn-by-levels instead of
 *  a private copy of it; a package enters a tier once all its dependencies
 *  have entered an earlier one. */
export function buildOrder(graph) {
    // topologicalTiers places zero-*incoming*-edge nodes first; a tier 0
    // package here is one with zero *dependencies*, so edges are added
    // reversed (dependency -> dependent) to make "incoming" mean "depended on
    // by nothing not yet placed" in SignGraph's terms.
    const dependencyGraph = createGraph({ nodes: graph.nodes.map((n) => ({ id: n.name })) });
    for (const e of graph.edges) {
        // Only count edges between known nodes (graph.edges are already internal).
        if (!dependencyGraph.hasNode(e.from) || !dependencyGraph.hasNode(e.to))
            continue;
        dependencyGraph.addEdge({ from: e.to, to: e.from });
    }
    const { tiers: rawTiers, cycle } = topologicalTiers(dependencyGraph);
    const tiers = rawTiers.map((tier) => [...tier].sort());
    const unordered = cycle === undefined ? [] : [...cycle].sort();
    return {
        kind: "jsnode.build-order",
        tiers: Object.freeze(tiers.map((t) => Object.freeze(t))),
        order: Object.freeze(tiers.flat()),
        tierCount: tiers.length,
        maxWidth: tiers.reduce((m, t) => Math.max(m, t.length), 0),
        acyclic: unordered.length === 0,
        unordered: Object.freeze(unordered),
    };
}

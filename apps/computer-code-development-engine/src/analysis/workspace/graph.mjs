import { createGraph, neighborhood } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
/** The neighbourhood of one package as its own dependency graph: the focus
 *  package, the packages it depends on (down to `downDepth` hops), and the
 *  packages that depend on it (up to `upDepth` hops). Edges are kept only when
 *  both endpoints are in the neighbourhood, so the subgraph is closed and can be
 *  laid out and rendered by the same machinery as the whole-workspace DAG.
 *
 *  Returns an empty graph if `name` is not a node in `graph`. The focus package
 *  is always included even with both depths 0. */
export function egoGraph(graph, name, opts = {}) {
    const downDepth = opts.downDepth ?? 1;
    const upDepth = opts.upDepth ?? 1;
    const byName = new Map(graph.nodes.map((n) => [n.name, n]));
    if (!byName.has(name))
        return { nodes: [], edges: [] };
    // Down = outgoing (a package -> its dependencies), up = incoming (-> its
    // dependents) — SignGraph's neighborhood over the same edge
    // convention (from depends on to) instead of a private bounded BFS.
    const dependencyGraph = createGraph({ nodes: graph.nodes.map((n) => ({ id: n.name })) });
    for (const e of graph.edges)
        dependencyGraph.addEdge({ from: e.from, to: e.to });
    const keep = neighborhood(dependencyGraph, name, { downDepth, upDepth });
    const nodes = [];
    for (const n of graph.nodes) {
        if (!keep.has(n.name))
            continue;
        // Restrict each kept node's denormalised dependency list to kept nodes, so
        // it stays consistent with the filtered edge set.
        nodes.push({ ...n, dependencies: n.dependencies.filter((d) => keep.has(d)) });
    }
    const edges = graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to));
    return { nodes, edges };
}
/** Project a discovered workspace onto its internal package dependency DAG.
 *  Keeps only edges whose target is itself a discovered package, so the graph
 *  is closed over the workspace and carries no external-npm leaves. */
export function workspaceDependencyGraph(workspace) {
    const internal = new Set(workspace.packages.map((p) => p.name));
    const nodes = [];
    const edges = [];
    for (const pkg of workspace.packages) {
        const deps = pkg.dependencies.filter((d) => internal.has(d) && d !== pkg.name);
        nodes.push({
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            layer: pkg.layer,
            tags: pkg.tags,
            lifecycle: pkg.lifecycle,
            maturity: pkg.maturity,
            dependencies: deps,
        });
        for (const to of deps)
            edges.push({ from: pkg.name, to });
    }
    return { nodes, edges };
}

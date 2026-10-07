/**
 * analysis — geometric and analytical invariants of the workspace dependency
 * graph, computed directly over {@link WorkspaceDependencyGraph}.
 *
 * The graph already determines a great deal that nothing reads off it: how many
 * disconnected islands the workspace is in, whether the dependency relation is
 * acyclic, how far apart two packages are, which package the most flow passes
 * through, and how deep below the surface a package sits. These are the
 * *geometric* (distance, centre, diameter) and *analytical* (components,
 * cycles, strata, centrality) facts about the package graph.
 *
 * `@emsenn/meme-analysis` defines the spectral versions of several of these
 * (component count, Laplacian characteristic polynomial, spanning-tree count)
 * exactly, over the meme-topology carrier `jsnode-topology` emits — but its
 * hereditarily-finite-set arithmetic, where an integer V costs O(V), does not
 * fit at workspace scale (the whole-workspace carrier OOMs a Laplacian
 * determinant). So this module computes the *combinatorial* invariants —
 * components, cycles, distance, centrality, strata — with ordinary numeric graph
 * algorithms over the package dependency graph. The *spectral* invariants are
 * computed in {@link ./spectrum.mjs} by the move that header's earlier draft
 * proposed: slice the graph to a single package's neighbourhood (where the
 * invariants are small and legible) and carry the exact integers as native
 * `bigint` (where they cost no more than their digits) — so the exact spectrum
 * runs at workspace scale after all, one bounded slice per package.
 *
 * Pure functions of the graph; no I/O.
 */
import { packageCoordinate, JSNODE_ROLES } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
function adjacency(graph) {
    const names = graph.nodes.map((n) => n.name);
    const index = new Map(names.map((n, i) => [n, i]));
    const out = names.map(() => []);
    const inn = names.map(() => []);
    for (const e of graph.edges) {
        const a = index.get(e.from);
        const b = index.get(e.to);
        if (a !== undefined && b !== undefined) {
            out[a].push(b);
            inn[b].push(a);
        }
    }
    return { index, names, out, inn };
}
/** Weakly-connected components (direction ignored), largest first. */
function components(names, out, inn) {
    const comp = new Array(names.length).fill(-1);
    let k = 0;
    for (let s = 0; s < names.length; s++) {
        if (comp[s] !== -1)
            continue;
        const stack = [s];
        comp[s] = k;
        while (stack.length) {
            const u = stack.pop();
            for (const v of [...out[u], ...inn[u]]) {
                if (comp[v] === -1) {
                    comp[v] = k;
                    stack.push(v);
                }
            }
        }
        k++;
    }
    const buckets = Array.from({ length: k }, () => []);
    for (let i = 0; i < names.length; i++)
        buckets[comp[i]].push(names[i]);
    return buckets
        .map((members) => ({ size: members.length, members: Object.freeze(members) }))
        .sort((a, b) => b.size - a.size);
}
/** Tarjan strongly-connected components; cycles are the SCCs of size > 1. */
function stronglyConnected(names, out) {
    const N = names.length;
    const num = new Array(N).fill(-1);
    const low = new Array(N).fill(0);
    const onStack = new Array(N).fill(false);
    const stack = [];
    const sccs = [];
    let idx = 0;
    // Iterative Tarjan to avoid blowing the call stack on deep graphs.
    for (let root = 0; root < N; root++) {
        if (num[root] !== -1)
            continue;
        const work = [{ v: root, i: 0 }];
        while (work.length) {
            const frame = work[work.length - 1];
            const v = frame.v;
            if (frame.i === 0) {
                num[v] = low[v] = idx++;
                stack.push(v);
                onStack[v] = true;
            }
            if (frame.i < out[v].length) {
                const w = out[v][frame.i];
                frame.i++;
                if (num[w] === -1) {
                    work.push({ v: w, i: 0 });
                }
                else if (onStack[w]) {
                    low[v] = Math.min(low[v], num[w]);
                }
            }
            else {
                if (low[v] === num[v]) {
                    const scc = [];
                    let w;
                    do {
                        w = stack.pop();
                        onStack[w] = false;
                        scc.push(w);
                    } while (w !== v);
                    sccs.push(scc);
                }
                work.pop();
                if (work.length) {
                    const parent = work[work.length - 1].v;
                    low[parent] = Math.min(low[parent], low[v]);
                }
            }
        }
    }
    return sccs.filter((c) => c.length > 1).map((c) => c.map((i) => names[i]));
}
/** BFS eccentricity over the undirected graph, restricted to one component. */
function eccentricities(members, index, out, inn) {
    const local = new Set(members.map((m) => index.get(m)));
    const ecc = new Map();
    let diameter = 0;
    for (const m of members) {
        const src = index.get(m);
        const dist = new Map([[src, 0]]);
        const queue = [src];
        let far = 0;
        for (let qi = 0; qi < queue.length; qi++) {
            const u = queue[qi];
            const d = dist.get(u);
            for (const v of [...out[u], ...inn[u]]) {
                if (!local.has(v) || dist.has(v))
                    continue;
                dist.set(v, d + 1);
                far = Math.max(far, d + 1);
                queue.push(v);
            }
        }
        ecc.set(m, far);
        diameter = Math.max(diameter, far);
    }
    return { ecc, diameter };
}
/** Brandes betweenness centrality on the directed unweighted graph. */
function betweenness(names, out) {
    const N = names.length;
    const cb = new Array(N).fill(0);
    for (let s = 0; s < N; s++) {
        const stack = [];
        const pred = names.map(() => []);
        const sigma = new Array(N).fill(0);
        const dist = new Array(N).fill(-1);
        sigma[s] = 1;
        dist[s] = 0;
        const queue = [s];
        for (let qi = 0; qi < queue.length; qi++) {
            const v = queue[qi];
            stack.push(v);
            for (const w of out[v]) {
                if (dist[w] === -1) {
                    dist[w] = dist[v] + 1;
                    queue.push(w);
                }
                if (dist[w] === dist[v] + 1) {
                    sigma[w] += sigma[v];
                    pred[w].push(v);
                }
            }
        }
        const delta = new Array(N).fill(0);
        for (let i = stack.length - 1; i >= 0; i--) {
            const w = stack[i];
            for (const v of pred[w]) {
                delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
            }
            if (w !== s)
                cb[w] += delta[w];
        }
    }
    return cb;
}
/** Longest dependency chain below each node (memoised over a DAG). For a
 *  graph with cycles the cyclic nodes settle to a finite bound rather than
 *  recursing forever. */
function strata(names, out) {
    const depth = new Array(names.length).fill(-1);
    const visiting = new Array(names.length).fill(false);
    const compute = (v) => {
        if (depth[v] !== -1)
            return depth[v];
        if (visiting[v])
            return 0; // break cycles defensively
        visiting[v] = true;
        let best = 0;
        for (const w of out[v])
            best = Math.max(best, 1 + compute(w));
        visiting[v] = false;
        depth[v] = best;
        return best;
    };
    for (let i = 0; i < names.length; i++)
        compute(i);
    return depth;
}
/** Compute the geometry and analysis of a workspace dependency graph. */
export function workspaceAnalysis(graph) {
    const { index, names, out, inn } = adjacency(graph);
    const comps = components(names, out, inn);
    const cycles = stronglyConnected(names, out);
    const largest = comps[0]?.members ?? [];
    const { ecc, diameter } = eccentricities([...largest], index, out, inn);
    let radius = Infinity;
    for (const e of ecc.values())
        radius = Math.min(radius, e);
    if (!Number.isFinite(radius))
        radius = 0;
    const center = [...ecc.entries()].filter(([, e]) => e === radius).map(([n]) => n);
    const cb = betweenness(names, out);
    const depth = strata(names, out);
    const centrality = names
        .map((name, i) => ({
        name,
        dependents: inn[i].length,
        dependencies: out[i].length,
        betweenness: cb[i],
        stratum: depth[i],
    }))
        .sort((a, b) => b.dependents - a.dependents || b.betweenness - a.betweenness);
    return {
        order: names.length,
        size: graph.edges.length,
        components: comps,
        componentCount: comps.length,
        acyclic: cycles.length === 0,
        cycles: Object.freeze(cycles.map((c) => Object.freeze(c))),
        diameter,
        radius,
        center: Object.freeze(center),
        height: depth.length ? Math.max(0, ...depth) : 0,
        centrality: Object.freeze(centrality),
    };
}
/** Project a set of package names onto the (domain, role) fibration grid. */
export function roleDomainGrid(packageNames) {
    const byCell = new Map();
    const roleCount = new Map();
    const domainCount = new Map();
    const roles = new Set();
    const domains = new Set();
    for (const name of packageNames) {
        const c = packageCoordinate(name);
        const role = c.role ?? "—";
        roles.add(role);
        domains.add(c.domain);
        const key = `${c.domain} ${role}`;
        (byCell.get(key) ?? byCell.set(key, []).get(key)).push(name);
        roleCount.set(role, (roleCount.get(role) ?? 0) + 1);
        domainCount.set(c.domain, (domainCount.get(c.domain) ?? 0) + 1);
    }
    const cells = [...byCell.entries()].map(([key, packages]) => {
        const [domain, role] = key.split(" ");
        return { domain, role, packages: Object.freeze([...packages].sort()) };
    });
    const roleOrder = (r) => (r === "—" ? 99 : 0);
    return {
        roles: Object.freeze([...roles].sort((a, b) => roleOrder(a) - roleOrder(b) || a.localeCompare(b))),
        domains: Object.freeze([...domains].sort()),
        cells: Object.freeze(cells.sort((a, b) => a.domain.localeCompare(b.domain) || String(a.role).localeCompare(String(b.role)))),
        byRole: Object.freeze([...roleCount.entries()].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count)),
        byDomain: Object.freeze([...domainCount.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count)),
    };
}
// ---------- the role quotient (base of the fibration) ----------
/** A non-role role label: the role-less bucket of atoms and applications. */
const NO_ROLE = "—";
const roleStratum = (role) => {
    if (role === NO_ROLE)
        return null;
    const i = JSNODE_ROLES.indexOf(role);
    return i === -1 ? null : i;
};
const declaredOrderOf = (from, to) => {
    if (from === to)
        return "lateral";
    const sf = roleStratum(from);
    const st = roleStratum(to);
    if (sf === null || st === null)
        return "unranked";
    // `from` depends on `to`; declared order builds higher strata atop lower, so
    // depending downward (sf > st) runs *with* the order, upward runs against it.
    return sf > st ? "with" : "against";
};
/** Tarjan SCCs over a role adjacency map (self-loops already excluded). Returns
 *  only the classes of size > 1 — the mutually-dependent role groups. */
function entangledRoleClasses(roles, adj) {
    const index = new Map();
    const low = new Map();
    const onStack = new Set();
    const stack = [];
    const out = [];
    let idx = 0;
    const strongConnect = (v) => {
        index.set(v, idx);
        low.set(v, idx);
        idx++;
        stack.push(v);
        onStack.add(v);
        for (const w of adj.get(v) ?? []) {
            if (!index.has(w)) {
                strongConnect(w);
                low.set(v, Math.min(low.get(v), low.get(w)));
            }
            else if (onStack.has(w)) {
                low.set(v, Math.min(low.get(v), index.get(w)));
            }
        }
        if (low.get(v) === index.get(v)) {
            const scc = [];
            let w;
            do {
                w = stack.pop();
                onStack.delete(w);
                scc.push(w);
            } while (w !== v);
            out.push(scc);
        }
    };
    for (const r of roles)
        if (!index.has(r))
            strongConnect(r);
    return out.filter((c) => c.length > 1).map((c) => c);
}
/** Quotient a workspace dependency graph by the role projection: contract every
 *  package to its role, keep parallel edges and self-loops (the multigraph
 *  convention the corpus quotient-graph note declares), and read off the
 *  fibration's base structure. Pure over the graph; no I/O. */
export function roleQuotientGraph(graph) {
    const coordOf = new Map();
    const pkgCount = new Map();
    const present = new Set();
    for (const n of graph.nodes) {
        const c = packageCoordinate(n.name);
        const role = c.role ?? NO_ROLE;
        coordOf.set(n.name, { domain: c.domain, role });
        pkgCount.set(role, (pkgCount.get(role) ?? 0) + 1);
        present.add(role);
    }
    const cells = new Map();
    let withinDomainEdges = 0;
    let crossDomainEdges = 0;
    for (const e of graph.edges) {
        const cf = coordOf.get(e.from);
        const ct = coordOf.get(e.to);
        if (cf === undefined || ct === undefined)
            continue;
        present.add(cf.role);
        present.add(ct.role);
        const key = `${cf.role} ${ct.role}`;
        const acc = cells.get(key) ?? { weight: 0, withinDomain: 0, crossDomain: 0 };
        acc.weight++;
        const within = cf.domain === ct.domain;
        if (within) {
            acc.withinDomain++;
            withinDomainEdges++;
        }
        else {
            acc.crossDomain++;
            crossDomainEdges++;
        }
        cells.set(key, acc);
    }
    // Roles in declared order, the role-less bucket last; only those present.
    const rolesOrdered = [
        ...JSNODE_ROLES.filter((r) => present.has(r)),
        ...(present.has(NO_ROLE) ? [NO_ROLE] : []),
    ];
    const selfLoop = new Map();
    const edges = [];
    const adj = new Map();
    for (const [key, acc] of cells) {
        const [from, to] = key.split(" ");
        if (from === to) {
            selfLoop.set(from, acc.weight);
        }
        else if (from !== NO_ROLE && to !== NO_ROLE) {
            // Only ranked role pairs feed the grading test; the "—" bucket is held out
            // (see `acyclic`), so edges touching it never enter the SCC adjacency.
            (adj.get(from) ?? adj.set(from, new Set()).get(from)).add(to);
        }
        edges.push({
            from,
            to,
            weight: acc.weight,
            withinDomain: acc.withinDomain,
            crossDomain: acc.crossDomain,
            declaredOrder: declaredOrderOf(from, to),
        });
    }
    edges.sort((a, b) => b.weight - a.weight || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    const nodes = rolesOrdered.map((role) => ({
        role,
        stratum: roleStratum(role),
        packages: pkgCount.get(role) ?? 0,
        selfLoop: selfLoop.get(role) ?? 0,
    }));
    const rankedRoles = rolesOrdered.filter((r) => r !== NO_ROLE);
    const entangled = entangledRoleClasses(rankedRoles, adj)
        // Present each class in declared order for a stable reading.
        .map((c) => [...c].sort((a, b) => rolesOrdered.indexOf(a) - rolesOrdered.indexOf(b)));
    const againstDeclared = edges.filter((e) => e.declaredOrder === "against");
    return {
        kind: "jsnode.role-quotient",
        roles: Object.freeze(rolesOrdered),
        nodes: Object.freeze(nodes),
        edges: Object.freeze(edges),
        order: rolesOrdered.length,
        size: edges.length,
        withinDomainEdges,
        crossDomainEdges,
        acyclic: entangled.length === 0,
        entangled: Object.freeze(entangled.map((c) => Object.freeze(c))),
        againstDeclared: Object.freeze(againstDeclared),
    };
}

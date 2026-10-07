// Identifier tokens of a type expression, the same crude resolver symbol-graph
// uses: `Map<string, Bar>` → ["Map","string","Bar"]. Intersected with the
// addressable type set, this resolves a structured reference to its carriers
// without a full type parser.
const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const identsOf = (typeExpr) => typeExpr.match(IDENT) ?? [];
const tidy = (s) => s.replace(/\s+/g, " ").trim();
const signatureOf = (name, domain, codomain) => `${name}(${domain.map(tidy).join(", ")})${codomain ? ` → ${tidy(codomain)}` : ""}`;
/** Build the type-flow category from the workspace type index. */
export function workspaceTypeFlow(index) {
    // Addressability: a name is addressable iff exactly one package declares it.
    const declarers = new Map();
    const kindOf = new Map();
    for (const t of index.types) {
        let set = declarers.get(t.name);
        if (set === undefined) {
            set = new Set();
            declarers.set(t.name, set);
        }
        set.add(t.pkg);
        if (!kindOf.has(t.name))
            kindOf.set(t.name, t.kind);
    }
    const pkgOf = new Map();
    const ambiguousNames = [];
    for (const [name, set] of declarers) {
        if (set.size === 1)
            pkgOf.set(name, [...set][0]);
        else
            ambiguousNames.push(name);
    }
    ambiguousNames.sort();
    const addressable = (n) => pkgOf.has(n);
    // Edges + per-type producer/consumer counts, over every function. A function
    // contributes one edge per (addressable domain type × addressable codomain
    // type); a multi-argument function honestly yields several. Self-edges drop.
    const edges = [];
    const edgeSeen = new Set();
    const producers = new Map();
    const consumers = new Map();
    const inFlow = new Set();
    const packages = new Set();
    // Deduplicate functions by (pkg, name), the same convention symbol-graph uses:
    // a package may declare or re-export `f` from several modules, but it is one
    // morphism. Counting it once keeps the hub magnitudes here consistent with the
    // deduplicated producedBy/consumedBy lists on the per-type pages.
    const fnSeen = new Set();
    for (const f of index.functions) {
        packages.add(f.pkg);
        const fnKey = `${f.pkg}|${f.name}`;
        if (fnSeen.has(fnKey))
            continue;
        fnSeen.add(fnKey);
        const domTypes = new Set();
        for (const d of f.domain)
            for (const id of identsOf(d))
                if (addressable(id))
                    domTypes.add(id);
        const codTypes = new Set();
        if (f.codomain !== undefined)
            for (const id of identsOf(f.codomain))
                if (addressable(id))
                    codTypes.add(id);
        for (const a of domTypes) {
            consumers.set(a, (consumers.get(a) ?? 0) + 1);
            inFlow.add(a);
        }
        for (const b of codTypes) {
            producers.set(b, (producers.get(b) ?? 0) + 1);
            inFlow.add(b);
        }
        for (const a of domTypes) {
            for (const b of codTypes) {
                if (a === b)
                    continue;
                const key = `${a}|${b}|${f.pkg}|${f.name}`;
                if (edgeSeen.has(key))
                    continue;
                edgeSeen.add(key);
                edges.push({ from: a, to: b, fn: f.name, pkg: f.pkg });
            }
        }
    }
    const nodes = [];
    for (const name of inFlow) {
        nodes.push({
            name,
            pkg: pkgOf.get(name),
            kind: kindOf.get(name) ?? "type",
            producers: producers.get(name) ?? 0,
            consumers: consumers.get(name) ?? 0,
        });
    }
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    const crossPackageEdges = edges.reduce((acc, e) => acc + (pkgOf.get(e.from) !== pkgOf.get(e.to) ? 1 : 0), 0);
    const sources = nodes.filter((n) => n.producers === 0).map((n) => n.name);
    const sinks = nodes.filter((n) => n.consumers === 0).map((n) => n.name);
    const hubs = [...nodes]
        .sort((a, b) => b.producers + b.consumers - (a.producers + a.consumers))
        .slice(0, 20);
    return {
        kind: "jsnode.type-flow",
        order: nodes.length,
        size: edges.length,
        packages: packages.size,
        addressable: pkgOf.size,
        ambiguous: ambiguousNames.length,
        crossPackageEdges,
        sources,
        sinks,
        hubs,
        nodes,
        edges,
        ambiguousNames,
    };
}
// Forward / backward adjacency over composition edges, computed on demand for a
// neighbourhood read (cheap relative to the edge build).
function adjacency(edges) {
    const out = new Map();
    const inn = new Map();
    const push = (m, k, v) => {
        let s = m.get(k);
        if (s === undefined) {
            s = new Set();
            m.set(k, s);
        }
        s.add(v);
    };
    for (const e of edges) {
        push(out, e.from, e.to);
        push(inn, e.to, e.from);
    }
    return { out, in: inn };
}
// BFS the reachable set from a seed over an adjacency map (each node once).
function reachable(adj, seed) {
    const seen = new Set();
    const queue = [seed];
    while (queue.length > 0) {
        const cur = queue.shift();
        for (const nxt of adj.get(cur) ?? []) {
            if (nxt === seed || seen.has(nxt))
                continue;
            seen.add(nxt);
            queue.push(nxt);
        }
    }
    return [...seen].sort();
}
/** The hom-functor presentation of one addressable type. Returns `undefined`
 *  when the name is not an addressable in-flow type (unknown, foreign, or
 *  ambiguous — the caller distinguishes ambiguous via `flow.ambiguousNames`). */
export function typeFlowNeighbourhood(index, flow, name) {
    const node = flow.nodes.find((n) => n.name === name);
    if (node === undefined)
        return undefined;
    const seenP = new Set();
    const seenC = new Set();
    const producedBy = [];
    const consumedBy = [];
    for (const f of index.functions) {
        const cod = f.codomain !== undefined ? new Set(identsOf(f.codomain)) : new Set();
        const dom = new Set();
        for (const d of f.domain)
            for (const id of identsOf(d))
                dom.add(id);
        if (cod.has(name)) {
            const key = `${f.pkg}|${f.name}`;
            if (!seenP.has(key)) {
                seenP.add(key);
                producedBy.push({ pkg: f.pkg, name: f.name, signature: signatureOf(f.name, f.domain, f.codomain) });
            }
        }
        if (dom.has(name)) {
            const key = `${f.pkg}|${f.name}`;
            if (!seenC.has(key)) {
                seenC.add(key);
                consumedBy.push({ pkg: f.pkg, name: f.name, signature: signatureOf(f.name, f.domain, f.codomain) });
            }
        }
    }
    const bySig = (a, b) => a.pkg.localeCompare(b.pkg) || a.name.localeCompare(b.name);
    producedBy.sort(bySig);
    consumedBy.sort(bySig);
    const pkgOf = new Map(flow.nodes.map((n) => [n.name, n.pkg]));
    const ref = (n) => ({ name: n, pkg: pkgOf.get(n) ?? "?" });
    const refs = (names) => names.map(ref);
    const adj = adjacency(flow.edges);
    const upstream = refs([...(adj.in.get(name) ?? [])].sort());
    const downstream = refs([...(adj.out.get(name) ?? [])].sort());
    return {
        kind: "jsnode.type-flow-neighbourhood",
        name,
        pkg: node.pkg,
        typeKind: node.kind,
        producedBy,
        consumedBy,
        upstream,
        downstream,
        reaches: refs(reachable(adj.out, name)),
        reachableFrom: refs(reachable(adj.in, name)),
    };
}
/** One shortest composition pipeline from `from` to `to`, as the edge sequence
 *  realizing it, or `null` when `to` is unreachable from `from`. Each edge
 *  carries the function (and its package) that performs that step. BFS over the
 *  type graph — shortest by number of steps, each type visited once. */
export function shortestPipeline(flow, from, to) {
    if (from === to)
        return [];
    // First edge out of each type, by target — enough to reconstruct one path.
    const byFrom = new Map();
    for (const e of flow.edges) {
        let list = byFrom.get(e.from);
        if (list === undefined) {
            list = [];
            byFrom.set(e.from, list);
        }
        list.push(e);
    }
    const prev = new Map();
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length > 0) {
        const cur = queue.shift();
        for (const e of byFrom.get(cur) ?? []) {
            if (seen.has(e.to))
                continue;
            seen.add(e.to);
            prev.set(e.to, e);
            if (e.to === to) {
                const path = [];
                let step = to;
                while (step !== from) {
                    const incoming = prev.get(step);
                    if (incoming === undefined)
                        break;
                    path.unshift(incoming);
                    step = incoming.from;
                }
                return path;
            }
            queue.push(e.to);
        }
    }
    return null;
}

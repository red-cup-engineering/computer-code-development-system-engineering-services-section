/**
 * domain — the workspace read along its *other* facet.
 *
 * Every package is named `<domain>-<role>`: `meme-topology`, `agent-algebra`,
 * `web-codecs-http`. That is a two-facet classification in the sense of
 * Ranganathan's Colon Classification — the role suffix is the *Energy* facet
 * (the operation: algebra, topology, codecs…), the domain prefix is the
 * *Personality* facet (the focal subject: meme, agent, web…). The hyphen is the
 * colon. {@link ./analysis.mjs} already quotients the dependency graph onto the
 * role facet (`roleQuotientGraph`) and lays the full grid out
 * (`roleDomainGrid`). This module supplies the missing dual: the projection onto
 * the *domain* facet.
 *
 * Two readings, mirroring the role side:
 *   - {@link domainAtlas}: the catalog. Each domain is a union of the packages
 *     sharing its prefix — a namespace — gathered with their descriptions,
 *     roles, layers, and the domains it imports / is imported by. This is the
 *     semantic surface: what each subject *is*, not just who depends on whom.
 *   - {@link domainQuotientGraph}: the analytic dual of `roleQuotientGraph`.
 *     Contract every package to its domain and keep the domain→domain
 *     dependency multigraph: which subjects depend on which, whether the subject
 *     graph is acyclic, which subjects mutually entangle.
 *
 * The two quotients partition the *same* edge set: an edge is either
 * within-domain (a self-loop of the domain quotient; a cross-role edge of the
 * role quotient) or cross-domain. So `domainQuotient.crossDomainTotal` equals
 * `roleQuotient.crossDomainEdges` and `domainQuotient.withinDomainTotal` equals
 * `roleQuotient.withinDomainEdges` — a free cross-check that the dual is exact.
 *
 * Pure functions of the dependency graph; no I/O.
 */
import { packageCoordinate, JSNODE_ROLES, domainTerm } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { createGraph, cycles as graphCycles } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
const roleRank = (r) => (r === null ? 99 : JSNODE_ROLES.indexOf(r));
const LAYER_ORDER = ["lib", "apps", "services", "sites", "ops"];
const layerRank = (l) => {
    const i = LAYER_ORDER.indexOf(l);
    return i === -1 ? 99 : i;
};
/** Group the workspace's packages by domain and gather each domain's catalog
 *  entry — members with descriptions, role/layer coverage, and the domains it
 *  imports and is imported by. Pure over the dependency graph. */
export function domainAtlas(graph) {
    // Per-package coordinate and degree, read once off the graph.
    const domainOf = new Map();
    const dependentsOf = new Map();
    for (const n of graph.nodes) {
        domainOf.set(n.name, packageCoordinate(n.name).domain);
        dependentsOf.set(n.name, 0);
    }
    for (const e of graph.edges) {
        if (dependentsOf.has(e.to))
            dependentsOf.set(e.to, (dependentsOf.get(e.to) ?? 0) + 1);
    }
    // Cross-domain import/importer sets and internal-edge counts.
    const imports = new Map(); // domain -> domains it depends on
    const importers = new Map(); // domain -> domains that depend on it
    const internal = new Map();
    for (const n of graph.nodes) {
        const d = domainOf.get(n.name);
        if (!imports.has(d))
            imports.set(d, new Set());
        if (!importers.has(d))
            importers.set(d, new Set());
        if (!internal.has(d))
            internal.set(d, 0);
    }
    for (const e of graph.edges) {
        const a = domainOf.get(e.from);
        const b = domainOf.get(e.to);
        if (a === undefined || b === undefined)
            continue;
        if (a === b) {
            internal.set(a, (internal.get(a) ?? 0) + 1);
        }
        else {
            imports.get(a).add(b);
            importers.get(b).add(a);
        }
    }
    // Members per domain.
    const membersOf = new Map();
    for (const n of graph.nodes) {
        const c = packageCoordinate(n.name);
        const member = {
            name: n.name,
            role: c.role,
            qualifier: c.qualifier,
            layer: n.layer,
            version: n.version,
            description: n.description,
            dependencies: n.dependencies.length,
            dependents: dependentsOf.get(n.name) ?? 0,
        };
        (membersOf.get(c.domain) ?? membersOf.set(c.domain, []).get(c.domain)).push(member);
    }
    const domains = [...membersOf.entries()].map(([domain, members]) => {
        members.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name));
        const roles = [...new Set(members.map((m) => m.role).filter((r) => r !== null))]
            .sort((a, b) => JSNODE_ROLES.indexOf(a) - JSNODE_ROLES.indexOf(b));
        const layers = [...new Set(members.map((m) => m.layer))].sort((a, b) => layerRank(a) - layerRank(b));
        // Representative synopsis: a member's verbatim description, never fabricated.
        // Prefer the package whose scope-stripped local name *is* the domain; else
        // the most-depended-on member; only ever a member that has a description.
        const withDesc = members.filter((m) => m.description.trim() !== "");
        const eponymous = withDesc.find((m) => packageCoordinate(m.name).local === domain);
        const repr = eponymous
            ?? [...withDesc].sort((a, b) => b.dependents - a.dependents || a.name.localeCompare(b.name))[0];
        const dependsOn = [...(imports.get(domain) ?? [])].sort();
        const dependedOnBy = [...(importers.get(domain) ?? [])].sort();
        return {
            domain,
            term: domainTerm(domain),
            members: Object.freeze(members),
            size: members.length,
            roles: Object.freeze(roles),
            layers: Object.freeze(layers),
            synopsis: repr?.description ?? "",
            synopsisFrom: repr?.name ?? null,
            internalEdges: internal.get(domain) ?? 0,
            dependsOn: Object.freeze(dependsOn),
            dependedOnBy: Object.freeze(dependedOnBy),
        };
    });
    domains.sort((a, b) => b.size - a.size || a.domain.localeCompare(b.domain));
    return {
        kind: "jsnode.domain-atlas",
        domains: Object.freeze(domains),
        domainCount: domains.length,
        packageCount: graph.nodes.length,
    };
}
/** Look one domain up in the atlas (or build a single entry). Convenience for
 *  the per-domain surface; returns undefined when the domain has no packages. */
export function domainEntry(graph, domain) {
    return domainAtlas(graph).domains.find((d) => d.domain === domain);
}
/** Mutually-dependent domain classes (size > 1) over a cross-domain adjacency
 *  map that never carries a self-loop (the caller excludes those before
 *  building `adj`). Delegates to SignGraph's
 *  shared Tarjan instead of a second, private copy of it. */
function stronglyConnectedDomains(domains, adj) {
    const graph = createGraph({ nodes: domains.map((id) => ({ id })) });
    for (const [from, targets] of adj)
        for (const to of targets)
            graph.addEdge({ from, to });
    return graphCycles(graph);
}
/** Quotient a workspace dependency graph by the domain projection. Pure over the
 *  graph; no I/O. The dual of {@link roleQuotientGraph}. */
export function domainQuotientGraph(graph) {
    const domainOf = new Map();
    const pkgCount = new Map();
    for (const n of graph.nodes) {
        const d = packageCoordinate(n.name).domain;
        domainOf.set(n.name, d);
        pkgCount.set(d, (pkgCount.get(d) ?? 0) + 1);
    }
    const cells = new Map(); // "from\tto" -> weight
    const selfLoop = new Map();
    const adj = new Map(); // cross-domain only, for SCCs
    const importerCount = new Map();
    let withinDomainTotal = 0;
    let crossDomainTotal = 0;
    for (const e of graph.edges) {
        const a = domainOf.get(e.from);
        const b = domainOf.get(e.to);
        if (a === undefined || b === undefined)
            continue;
        if (a === b) {
            selfLoop.set(a, (selfLoop.get(a) ?? 0) + 1);
            withinDomainTotal++;
        }
        else {
            const key = `${a}\t${b}`;
            cells.set(key, (cells.get(key) ?? 0) + 1);
            crossDomainTotal++;
            (adj.get(a) ?? adj.set(a, new Set()).get(a)).add(b);
            (importerCount.get(b) ?? importerCount.set(b, new Set()).get(b)).add(a);
        }
    }
    const domains = [...pkgCount.keys()].sort((a, b) => (pkgCount.get(b) ?? 0) - (pkgCount.get(a) ?? 0) || a.localeCompare(b));
    const nodes = domains.map((domain) => ({
        domain,
        packages: pkgCount.get(domain) ?? 0,
        selfLoop: selfLoop.get(domain) ?? 0,
    }));
    const edges = [...cells.entries()]
        .map(([key, weight]) => {
        const [from, to] = key.split("\t");
        return { from, to, weight };
    })
        .sort((a, b) => b.weight - a.weight || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    const entangled = stronglyConnectedDomains(domains, adj)
        .map((c) => Object.freeze([...c].sort()))
        .sort((a, b) => b.length - a.length || (a[0] ?? "").localeCompare(b[0] ?? ""));
    const mostDependedOn = domains
        .map((domain) => ({ domain, dependents: importerCount.get(domain)?.size ?? 0 }))
        .filter((d) => d.dependents > 0)
        .sort((a, b) => b.dependents - a.dependents || a.domain.localeCompare(b.domain));
    return {
        kind: "jsnode.domain-quotient",
        domains: Object.freeze(domains),
        nodes: Object.freeze(nodes),
        edges: Object.freeze(edges),
        order: domains.length,
        size: edges.length,
        withinDomainTotal,
        crossDomainTotal,
        acyclic: entangled.length === 0,
        entangled: Object.freeze(entangled),
        mostDependedOn: Object.freeze(mostDependedOn),
    };
}

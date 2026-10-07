/**
 * role-catalog — the workspace read along its *role* facet, as a defined
 * vocabulary.
 *
 * {@link ./domain.mjs} reads the workspace along the Personality facet (the
 * subject prefix: meme, agent, web…). This is the dual catalog on the Energy
 * facet — the role suffix (algebra, topology, codecs…) — but with the piece the
 * domain side has no equivalent of: every role is a *defined concept*. The
 * meaning of each role has lived only in prose (the layer semantics authored in
 * `LANGUAGE-MIGRATION.md`, freed into `ROLE_LEXICON` by jsnode-topology); this
 * joins that lexicon to the live workspace, so each role carries both its
 * authored definition and the packages that actually instantiate it, across
 * which domains, with which cross-role dependency.
 *
 * Like the domain atlas, descriptions are taken verbatim from the packages
 * themselves and role glosses verbatim from `ROLE_LEXICON`; nothing here is
 * synthesised. Pure over the dependency graph; no I/O.
 */
import { packageCoordinate, JSNODE_ROLES, ROLE_LEXICON, roleConcept, roleTerm } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
const LAYER_ORDER = ["lib", "apps", "services", "sites", "ops"];
const layerRank = (l) => {
    const i = LAYER_ORDER.indexOf(l);
    return i === -1 ? 99 : i;
};
const stratumOrder = (a, b) => JSNODE_ROLES.indexOf(a) - JSNODE_ROLES.indexOf(b);
/** Join `ROLE_LEXICON` to the live workspace: group packages by role, gather
 *  each role's members, subject coverage, layer span, and cross-role dependency.
 *  Pure over the dependency graph. Only packages whose names carry a known role
 *  enter a role entry; role-less packages are counted but not catalogued (they
 *  instantiate no role functor). */
export function roleCatalog(graph) {
    const roleOf = new Map();
    const domainByName = new Map();
    const dependentsOf = new Map();
    for (const n of graph.nodes) {
        const c = packageCoordinate(n.name);
        roleOf.set(n.name, c.role);
        domainByName.set(n.name, c.domain);
        dependentsOf.set(n.name, 0);
    }
    for (const e of graph.edges) {
        if (dependentsOf.has(e.to))
            dependentsOf.set(e.to, (dependentsOf.get(e.to) ?? 0) + 1);
    }
    // Cross-role import/importer sets and within-role edge counts.
    const imports = new Map();
    const importers = new Map();
    const internal = new Map();
    for (const role of JSNODE_ROLES) {
        imports.set(role, new Set());
        importers.set(role, new Set());
        internal.set(role, 0);
    }
    for (const e of graph.edges) {
        const a = roleOf.get(e.from) ?? null;
        const b = roleOf.get(e.to) ?? null;
        if (a === null || b === null)
            continue; // role-less endpoint: not attributable to a role
        if (a === b) {
            internal.set(a, (internal.get(a) ?? 0) + 1);
        }
        else {
            imports.get(a).add(b);
            importers.get(b).add(a);
        }
    }
    // Members per role.
    const membersOf = new Map();
    for (const role of JSNODE_ROLES)
        membersOf.set(role, []);
    let rolelessCount = 0;
    for (const n of graph.nodes) {
        const c = packageCoordinate(n.name);
        if (c.role === null) {
            rolelessCount++;
            continue;
        }
        membersOf.get(c.role).push({
            name: n.name,
            domain: c.domain,
            qualifier: c.qualifier,
            layer: n.layer,
            version: n.version,
            description: n.description,
            dependencies: n.dependencies.length,
            dependents: dependentsOf.get(n.name) ?? 0,
        });
    }
    const roles = ROLE_LEXICON.map((concept) => {
        const members = membersOf.get(concept.role);
        members.sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
        const domains = [...new Set(members.map((m) => m.domain))].sort();
        const layers = [...new Set(members.map((m) => m.layer))].sort((a, b) => layerRank(a) - layerRank(b));
        const dependsOn = [...(imports.get(concept.role) ?? [])].sort(stratumOrder);
        const dependedOnBy = [...(importers.get(concept.role) ?? [])].sort(stratumOrder);
        return {
            role: concept.role,
            term: roleTerm(concept.role),
            stratum: concept.stratum,
            classification: concept.classification,
            gloss: concept.gloss,
            source: concept.source,
            members: Object.freeze(members),
            size: members.length,
            domains: Object.freeze(domains),
            domainCount: domains.length,
            layers: Object.freeze(layers),
            dependsOn: Object.freeze(dependsOn),
            dependedOnBy: Object.freeze(dependedOnBy),
            internalEdges: internal.get(concept.role) ?? 0,
        };
    });
    return {
        kind: "jsnode.role-catalog",
        roles: Object.freeze(roles),
        roleCount: roles.length,
        packageCount: roles.reduce((a, r) => a + r.size, 0),
        rolelessCount,
    };
}
/** One role's catalog entry (or undefined if the role string is unknown).
 *  Convenience for the per-role surface. */
export function roleCatalogEntry(graph, role) {
    if (!JSNODE_ROLES.includes(role))
        return undefined;
    return roleCatalog(graph).roles.find((r) => r.role === role);
}
// Keep roleConcept reachable to consumers reading a single concept without a graph.
export { roleConcept };

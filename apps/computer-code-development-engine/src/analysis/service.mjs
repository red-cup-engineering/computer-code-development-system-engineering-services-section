import { workspaceTypeIndex, eachWorkspacePackageDir } from "@red-cup-engineering/javascript-computer";
import { projectContextRelevance } from "../coding-context/context-relevance.mjs";
import { workspaceFromDiscoveredPackages } from "@red-cup-engineering/computer-code-development-engine/analysis/workspace/workspace";
import { createJsnodePlatform } from "./mcp.mjs";
import { buildGlossaryIndex, buildSectionIndex, fabricationRecordsGraph, resolveGlossaryTerm, searchSections, } from "./discovery.mjs";
import { relative, sep } from "node:path";
import { workspaceDependencyGraph, workspaceAnalysis, roleDomainGrid, roleQuotientGraph, workspaceSpectrum, packageNeighbourhoodSpectrum, dependencyGraphSvg, egoGraph, packageSymbolGraph, symbolGraphSvg, domainAtlas, domainQuotientGraph, roleCatalog, roleCatalogEntry, workspaceDependencies, workspaceConsistency, buildOrder, workspaceLifecycle, workspaceTypeFlow, typeFlowNeighbourhood, shortestPipeline, } from "@red-cup-engineering/computer-code-development-engine/analysis/workspace/index";
import { searchPackages, packageCoordinate, roleConcept } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { packageTurtle, packageJsonLd, workspaceTurtle, workspaceJsonLd, domainTurtle, domainJsonLd, roleTurtle, roleJsonLd, typeFlowTurtle, typeFlowJsonLd, vocabulary, } from "@red-cup-engineering/computer-code-development-engine/analysis/codecs/index";
/** Per-consumer detail (declarations, consumer names) beyond this count is
 *  trimmed under the default compact `detail: false` mode, since a widely
 *  depended-on package's full declaration list is what pushes a jsnode_search
 *  result over the MCP tool-result size limit (measured 2026-09-05: a single
 *  match's consumerDeclarations reached 161 entries, ~26KB alone). */
const CONSUMER_DETAIL_CAP = 20;
/**
 * MCP and HTTP share this evidence-preserving search projection. The fallbacks
 * keep the transport useful while jsnode-server remains pinned to an older
 * published jsnode-topology: they derive consumer declarations from the same
 * JSNode carriers and explicitly mark delivery paths unassayed.
 *
 * `options.limit`/`options.offset` page the (still fully computed) match set;
 * `count` always reports the full, unpaged total. `options.detail` (default
 * `false`) caps each match's `consumers`/`consumerDeclarations` arrays at
 * {@link CONSUMER_DETAIL_CAP}, adding a `*Total` field when a cap truncated
 * one; pass `true` for the previous, uncapped behavior.
 */
export function capabilitySearchPayload(packages, term, options) {
    const matches = searchPackages(packages, term);
    const offset = options?.offset ?? 0;
    const limit = options?.limit;
    const detail = options?.detail ?? false;
    const paged = limit === undefined ? matches.slice(offset) : matches.slice(offset, offset + limit);
    return Object.freeze({
        term,
        count: matches.length,
        offset,
        ...(limit !== undefined ? { limit } : {}),
        matches: Object.freeze(paged.map((match) => {
            const declarations = packages.flatMap((consumer) => consumer.deps
                .filter((dependency) => dependency.name === match.package.name)
                .map((dependency) => Object.freeze({ package: consumer.name, kind: dependency.kind, range: dependency.range })))
                .sort((a, b) => a.package.localeCompare(b.package) || a.kind.localeCompare(b.kind));
            const fullConsumers = match.consumers ?? Object.freeze([...new Set(declarations
                    .filter(({ kind }) => kind === "runtime")
                    .map(({ package: consumer }) => consumer))]);
            const fullDeclarations = match.consumerDeclarations ?? Object.freeze(declarations);
            const consumers = detail || fullConsumers.length <= CONSUMER_DETAIL_CAP
                ? fullConsumers
                : Object.freeze(fullConsumers.slice(0, CONSUMER_DETAIL_CAP));
            const consumerDeclarations = detail || fullDeclarations.length <= CONSUMER_DETAIL_CAP
                ? fullDeclarations
                : Object.freeze(fullDeclarations.slice(0, CONSUMER_DETAIL_CAP));
            return Object.freeze({
                name: match.package.name,
                path: options?.packagePaths?.get(match.package.name) ?? null,
                field: match.field,
                rank: match.rank,
                ...(match.tag !== undefined ? { tag: match.tag } : {}),
                layer: match.package.layer,
                tags: match.package.tags,
                description: match.package.description,
                reasons: match.reasons ?? Object.freeze([`${match.field} matches "${term}"`]),
                consumers,
                ...(consumers.length !== fullConsumers.length ? { consumersTotal: fullConsumers.length } : {}),
                consumerDeclarations,
                ...(consumerDeclarations.length !== fullDeclarations.length ? { consumerDeclarationsTotal: fullDeclarations.length } : {}),
                paths: match.paths ?? Object.freeze({
                    source: Object.freeze({ status: "observed", version: match.package.version }),
                    published: Object.freeze([]),
                    installed: Object.freeze([]),
                    live: Object.freeze([]),
                    sourceOnly: null,
                    classification: "source-with-unassayed-delivery",
                }),
            });
        })),
    });
}
/** Fields `jsnode_query`'s `return` may project. Kept in one place so the tool
 *  description, the input schema's enum, and the projector agree. */
const QUERY_FIELDS = [
    "name", "version", "description", "layer", "scope", "path",
    "tags", "lifecycle", "maturity", "exports", "dependencies",
];
function queryFieldValue(pkg, field, path) {
    switch (field) {
        case "name": return pkg.name;
        case "version": return pkg.version;
        case "description": return pkg.description;
        case "layer": return pkg.layer;
        case "scope": return packageCoordinate(pkg.name).scope;
        case "path": return path;
        case "tags": return pkg.tags;
        case "lifecycle": return pkg.lifecycle;
        case "maturity": return pkg.maturity;
        case "exports": return pkg.exports;
        case "dependencies": return pkg.dependencies;
    }
}
/**
 * The structured (quasi-SPARQL) filter behind `jsnode_query`: an AND of exact
 * (scope, layer) and case-insensitive substring (tag, name, description)
 * predicates over the package graph, projected to the requested `return`
 * fields. `count` is the full match total; `limit`, when given, only caps the
 * `packages` array — so a caller can tell a limited page from the whole set.
 */
export function packageQueryPayload(packages, filter, packagePaths = new Map()) {
    const fields = (filter.return && filter.return.length > 0 ? filter.return : ["name"]);
    for (const field of fields) {
        if (!QUERY_FIELDS.includes(field)) {
            throw new Error(`unknown return field: ${field} (choices: ${QUERY_FIELDS.join(", ")})`);
        }
    }
    const nameNeedle = filter.name?.toLowerCase();
    const tagNeedle = filter.tag?.toLowerCase();
    const descriptionNeedle = filter.description?.toLowerCase();
    const pathNeedle = filter.pathContains?.toLowerCase();
    const dependsOn = filter.dependsOn;
    const lacksDependency = filter.lacksDependency;
    const limit = filter.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new Error("limit must be an integer from 1 through 100");
    const matches = packages
        .filter((pkg) => filter.scope === undefined || packageCoordinate(pkg.name).scope === filter.scope)
        .filter((pkg) => filter.layer === undefined || pkg.layer === filter.layer)
        .filter((pkg) => tagNeedle === undefined || pkg.tags.some((tag) => tag.toLowerCase().includes(tagNeedle)))
        .filter((pkg) => nameNeedle === undefined || pkg.name.toLowerCase().includes(nameNeedle))
        .filter((pkg) => descriptionNeedle === undefined || pkg.description.toLowerCase().includes(descriptionNeedle))
        .filter((pkg) => pathNeedle === undefined || (packagePaths.get(pkg.name) ?? "").toLowerCase().includes(pathNeedle))
        .filter((pkg) => dependsOn === undefined || pkg.deps.some((dependency) => dependency.name === dependsOn))
        .filter((pkg) => lacksDependency === undefined || !pkg.deps.some((dependency) => dependency.name === lacksDependency))
        .sort((a, b) => a.name.localeCompare(b.name));
    const page = matches.slice(0, limit);
    return Object.freeze({
        count: matches.length,
        packages: Object.freeze(page.map((pkg) => Object.freeze(Object.fromEntries(fields.map((field) => [field, queryFieldValue(pkg, field, packagePaths.get(pkg.name) ?? "")]))))),
    });
}
/** Bind cached workspace observations to the shared platform's provider lifetime. */
export function createJsnodeWorkspacePlatform(config) {
    let workspace;
    let packagePaths = new Map();
    let cachedTypeIndex;
    let discoveredPackages = [];
    let cachedContextObservation;
    let cachedGraph;
    let cachedSpectrum;
    let cachedAtlas;
    let cachedDomainQuotient;
    let cachedRoleCatalog;
    let cachedDependencies;
    let cachedConsistency;
    let cachedBuildOrder;
    let cachedLifecycle;
    let cachedTypeFlow;
    const cachedDuplication = new Map();
    const cachedDuplicationMigration = new Map();
    let cachedGlossaryIndex;
    let cachedSectionIndex;
    const cachedFabricationRecords = new Map();
    let timer;
    // Server-process metadata only (when the in-memory index was last read off
    // disk), never folded into the workspace domain model itself — the package
    // graph stays timestamp-free; this answers "how stale can this be" for a
    // caller deciding whether to force a refresh.
    let lastRefreshedAt;
    const base = config.base ?? "/";
    async function refresh() {
        const discovered = [...eachWorkspacePackageDir(config.root)];
        discoveredPackages = discovered;
        workspace = workspaceFromDiscoveredPackages(config.root, discovered);
        packagePaths = new Map(discovered.map((pkg) => [pkg.name, relative(config.root, pkg.dir).split(sep).join("/")]));
        cachedContextObservation = Object.freeze({
            packages: Object.freeze(discovered.map((pkg) => Object.freeze({ name: pkg.name, packagePath: relative(config.root, pkg.dir).split(sep).join("/"), manifest: pkg.manifest }))),
            functions: null,
            types: null,
        });
        // Invalidate the held indices; the next read rebuilds them from the
        // filesystem state this refresh captured.
        cachedTypeIndex = undefined;
        cachedGraph = undefined;
        cachedSpectrum = undefined;
        cachedAtlas = undefined;
        cachedDomainQuotient = undefined;
        cachedRoleCatalog = undefined;
        cachedDependencies = undefined;
        cachedConsistency = undefined;
        cachedBuildOrder = undefined;
        cachedLifecycle = undefined;
        cachedTypeFlow = undefined;
        cachedDuplication.clear();
        cachedDuplicationMigration.clear();
        cachedGlossaryIndex = undefined;
        cachedSectionIndex = undefined;
        cachedFabricationRecords.clear();
        lastRefreshedAt = new Date().toISOString();
    }
    /** Shared by `/healthz`, `POST /refresh`, and the `jsnode_status`/
     *  `jsnode_refresh` MCP tools, so every freshness surface reports the same
     *  fields off the same state. Uses the same authored-source observation as function/type discovery. */
    function statusPayload() {
        return Object.freeze({
            status: "ok",
            packages: workspace?.packages.length ?? 0,
            types: cachedTypeIndex?.types.length ?? null,
            functions: cachedTypeIndex?.functions.length ?? null,
            root: config.root,
            lastRefreshedAt: lastRefreshedAt ?? null,
            refreshIntervalSeconds: config.intervalSeconds ?? null,
        });
    }
    // The internal dependency DAG over the held workspace. Cheap (a pure
    // projection of the manifests already read), but held so the SVG and the
    // package pages share one graph and refresh() invalidates it in lockstep.
    function ensureGraph() {
        if (cachedGraph === undefined) {
            cachedGraph = workspaceDependencyGraph(workspace ?? emptyWorkspace());
        }
        return cachedGraph;
    }
    // The workspace spectral field: every package's neighbourhood spanning-tree
    // count and cyclomatic number, computed off the held graph (one exact bignum
    // determinant per package, ~half a second whole), then held so /spectrum is a
    // lookup and refresh() invalidates it with the graph.
    function ensureSpectrum() {
        if (cachedSpectrum === undefined) {
            cachedSpectrum = workspaceSpectrum(ensureGraph());
        }
        return cachedSpectrum;
    }
    // The domain atlas (the subject-facet catalog) and the domain quotient (the
    // subject dependency graph), both pure projections of the held dependency
    // graph — cheap, but held so the homepage is a lookup and refresh()
    // invalidates them with the graph.
    function ensureAtlas() {
        if (cachedAtlas === undefined) {
            cachedAtlas = domainAtlas(ensureGraph());
        }
        return cachedAtlas;
    }
    function ensureDomainQuotient() {
        if (cachedDomainQuotient === undefined) {
            cachedDomainQuotient = domainQuotientGraph(ensureGraph());
        }
        return cachedDomainQuotient;
    }
    // The role catalog (the Energy-facet vocabulary): every role joined to the
    // packages that instantiate it. A pure projection of the held dependency graph
    // plus the static lexicon — cheap, held so /roles is a lookup and refresh()
    // invalidates it with the graph.
    function ensureRoleCatalog() {
        if (cachedRoleCatalog === undefined) {
            cachedRoleCatalog = roleCatalog(ensureGraph());
        }
        return cachedRoleCatalog;
    }
    // The normie surface — the dependency report, the consistency report, and the
    // build order. The first two read the workspace carrier directly (every
    // declared dependency and manifest fact); the build order reads the internal
    // graph. All held off the workspace, so refresh() invalidates them.
    function ensureDependencies() {
        if (cachedDependencies === undefined) {
            cachedDependencies = workspaceDependencies(workspace ?? emptyWorkspace());
        }
        return cachedDependencies;
    }
    function ensureConsistency() {
        if (cachedConsistency === undefined) {
            cachedConsistency = workspaceConsistency(workspace ?? emptyWorkspace());
        }
        return cachedConsistency;
    }
    function ensureBuildOrder() {
        if (cachedBuildOrder === undefined) {
            cachedBuildOrder = buildOrder(ensureGraph());
        }
        return cachedBuildOrder;
    }
    function ensureLifecycle() {
        if (cachedLifecycle === undefined) {
            cachedLifecycle = workspaceLifecycle(ensureGraph());
        }
        return cachedLifecycle;
    }
    // The glossary index behind jsnode_term — every glossary carrier in the
    // tree, read and folded once per refresh epoch (a tree-wide walk plus one
    // markdown parse per carrier), then held until refresh() clears it.
    function ensureGlossaryIndex() {
        if (cachedGlossaryIndex === undefined) {
            cachedGlossaryIndex = buildGlossaryIndex(config.root);
        }
        return cachedGlossaryIndex;
    }
    // The section index behind jsnode_section — every *-services-section
    // directory, folded once per refresh epoch, then held until refresh().
    function ensureSectionIndex() {
        if (cachedSectionIndex === undefined) {
            cachedSectionIndex = buildSectionIndex(config.root);
        }
        return cachedSectionIndex;
    }
    // Read current declarations once per refresh, without requiring a build.
    function ensureTypeIndex() {
        if (cachedTypeIndex === undefined) {
            cachedTypeIndex = workspaceTypeIndex(config.root, {}, discoveredPackages);
        }
        return cachedTypeIndex;
    }
    function ensureContextObservation() {
        if (cachedContextObservation?.functions === null) {
            const index = ensureTypeIndex();
            cachedContextObservation = Object.freeze({ ...cachedContextObservation, functions: index.functions, types: index.types });
        }
        return cachedContextObservation ?? Object.freeze({ packages: [], functions: null, types: null });
    }
    function contextPayload(query) {
        return projectContextRelevance(ensureContextObservation(), { ...query, metadata: { root: config.root, lastRefreshedAt: lastRefreshedAt ?? null, typeIndex: cachedTypeIndex === undefined ? "unavailable" : "cached" } });
    }
    // The type-flow category — types as objects, functions as morphisms,
    // composition (codomain meets domain) made explicit. A pure projection of the
    // held type index, so its cost is the index build (held, not per-request) plus
    // a cheap pass; held so /typeflow is a lookup and refresh() invalidates it.
    function ensureTypeFlow() {
        if (cachedTypeFlow === undefined) {
            cachedTypeFlow = workspaceTypeFlow(ensureTypeIndex());
        }
        return cachedTypeFlow;
    }
    const emptyWorkspace = () => ({ kind: "jsnode.workspace", root: config.root, packages: [], utterances: [] });
    const mcpDeps = {
        search: (filter) => {
            return capabilitySearchPayload(workspace?.packages ?? [], filter.query, {
                packagePaths,
                limit: filter.limit ?? 10,
                offset: filter.offset ?? 0,
                detail: filter.detail ?? false,
            });
        },
        package: (name) => {
            const pkg = workspace?.packages.find((p) => p.name === name);
            if (pkg === undefined)
                return undefined;
            // The tool's own description promises "dependencies and dependents";
            // `pkg` only carries `dependencies` (a source-declared field). `dependents`
            // is the reverse edge, held nowhere on the package record itself — it is
            // read off the graph the same way the HTML package page already does
            // (views.mts renderPackagePage), so both surfaces agree.
            const dependents = ensureGraph().edges.filter((e) => e.to === pkg.name).map((e) => e.from).sort();
            return { ...pkg, dependents };
        },
        atlas: () => ensureAtlas(),
        domains: () => ensureDomainQuotient(),
        analysis: () => workspaceAnalysis(ensureGraph()),
        typeFlow: () => ensureTypeFlow(),
        typeFlowType: (type, to) => {
            const flow = ensureTypeFlow();
            const nb = typeFlowNeighbourhood(ensureTypeIndex(), flow, type);
            if (nb === undefined)
                return undefined;
            if (to !== undefined) {
                const steps = shortestPipeline(flow, type, to);
                return { ...nb, pipeline: { to, steps: steps ?? null } };
            }
            return nb;
        },
        types: (match, page = {}) => {
            const index = ensureTypeIndex();
            const needle = match.toLowerCase();
            const types = match === "" ? index.types : index.types.filter((t) => t.name.toLowerCase().includes(needle));
            const limit = Math.max(1, Math.min(200, page.limit ?? 50));
            const offset = Math.max(0, page.offset ?? 0);
            return { match, count: types.length, offset, truncated: offset + limit < types.length, types: types.slice(offset, offset + limit) };
        },
        functions: (taking, producing, page = {}) => {
            const index = ensureTypeIndex();
            let functions = index.functions;
            if (page.match !== undefined)
                functions = functions.filter((fn) => fn.name.toLowerCase().includes(page.match.toLowerCase()));
            if (taking !== undefined)
                functions = functions.filter((f) => f.domain.some((d) => d.includes(taking)));
            if (producing !== undefined) {
                functions = functions.filter((f) => f.codomain !== undefined && f.codomain.includes(producing));
            }
            return {
                ...(taking !== undefined ? { taking } : {}),
                ...(producing !== undefined ? { producing } : {}),
                count: functions.length,
                offset: Math.max(0, page.offset ?? 0),
                truncated: Math.max(0, page.offset ?? 0) + Math.max(1, Math.min(200, page.limit ?? 50)) < functions.length,
                functions: functions.slice(Math.max(0, page.offset ?? 0), Math.max(0, page.offset ?? 0) + Math.max(1, Math.min(200, page.limit ?? 50))),
            };
        },
        duplication: async (filter) => {
            const key = JSON.stringify(filter);
            let report = cachedDuplication.get(key);
            if (report === undefined) {
                const { workspaceDuplication } = await import("@red-cup-engineering/javascript-deduplication-services-section/duplication");
                report = workspaceDuplication(config.root, filter);
                cachedDuplication.set(key, report);
            }
            return report;
        },
        duplicationMigration: async (selector) => {
            const key = JSON.stringify(selector);
            let plan = cachedDuplicationMigration.get(key);
            if (plan === undefined) {
                const { planDuplicationMigration } = await import("@red-cup-engineering/javascript-deduplication-services-section/duplication-migration");
                plan = await planDuplicationMigration(config.root, {
                    ...(selector.fingerprint !== undefined ? { fingerprint: selector.fingerprint } : {}),
                    ...(selector.rank !== undefined ? { rank: selector.rank } : {}),
                }, {
                    ...(selector.scope !== undefined ? { scope: selector.scope } : {}),
                    ...(selector.minimumBytes !== undefined ? { minimumBytes: selector.minimumBytes } : {}),
                    ...(selector.owner !== undefined ? { owner: selector.owner } : {}),
                });
                cachedDuplicationMigration.set(key, plan);
            }
            return plan;
        },
        query: (filter) => packageQueryPayload(workspace?.packages ?? [], filter, packagePaths),
        status: () => statusPayload(),
        refresh: async () => {
            await refresh();
            return statusPayload();
        },
        term: (lookup) => {
            const matches = resolveGlossaryTerm(ensureGlossaryIndex(), lookup.name, { includeLegacy: lookup.includeLegacy ?? false });
            return { name: lookup.name, includeLegacy: lookup.includeLegacy ?? false, count: matches.length, matches };
        },
        section: (query) => searchSections(ensureSectionIndex(), query.query, query.limit ?? 10),
        fabricationRecords: (limit) => {
            let report = cachedFabricationRecords.get(limit);
            if (report === undefined) {
                report = fabricationRecordsGraph(config.root, workspace?.packages ?? [], limit);
                cachedFabricationRecords.set(limit, report);
            }
            return report;
        },
        context: (query) => contextPayload(query),
        report: ({ kind, name, up = 1, down = 1 }) => {
            const selected = () => { if (!name)
                throw new TypeError(`${kind} requires name`); return name; };
            const memberPackages = (facet) => (workspace?.packages ?? []).filter(pkg => packageCoordinate(pkg.name)[facet] === selected());
            const selectedPackage = () => { const pkg = workspace?.packages.find(pkg => pkg.name === selected()); if (!pkg)
                throw new TypeError(`package not found: ${name}`); return pkg; };
            const neighbourhood = () => { const nb = typeFlowNeighbourhood(ensureTypeIndex(), ensureTypeFlow(), selected()); if (!nb)
                throw new TypeError(`type not found: ${name}`); return nb; };
            switch (kind) {
                case "workspace": return workspace ?? emptyWorkspace();
                case "graph": return ensureGraph();
                case "graph-svg": return dependencyGraphSvg(ensureGraph());
                case "grid": return roleDomainGrid((workspace?.packages ?? []).map(pkg => pkg.name));
                case "quotient": return roleQuotientGraph(ensureGraph());
                case "spectrum": return ensureSpectrum();
                case "roles": return ensureRoleCatalog();
                case "dependencies": return ensureDependencies();
                case "consistency": return ensureConsistency();
                case "build-order": return ensureBuildOrder();
                case "lifecycle": return ensureLifecycle();
                case "vocabulary": return vocabulary(base);
                case "workspace-turtle": return workspaceTurtle(workspace ?? emptyWorkspace(), { base });
                case "workspace-jsonld": return workspaceJsonLd(workspace ?? emptyWorkspace(), { base });
                case "package-graph": return egoGraph(ensureGraph(), selected(), { upDepth: up, downDepth: down });
                case "package-graph-svg": return dependencyGraphSvg(egoGraph(ensureGraph(), selected(), { upDepth: up, downDepth: down }), { focus: selected() });
                case "package-symbols": return packageSymbolGraph(ensureTypeIndex(), selected());
                case "package-symbols-svg": return symbolGraphSvg(packageSymbolGraph(ensureTypeIndex(), selected()));
                case "package-spectrum": return packageNeighbourhoodSpectrum(ensureGraph(), selected()) ?? null;
                case "package-turtle": return packageTurtle(selectedPackage(), { base });
                case "package-jsonld": return packageJsonLd(selectedPackage(), { base });
                case "domain-turtle": return domainTurtle(selected(), memberPackages("domain"), { base });
                case "domain-jsonld": return domainJsonLd(selected(), memberPackages("domain"), { base });
                case "role": return roleCatalogEntry(ensureGraph(), selected()) ?? null;
                case "role-turtle": return roleTurtle(roleConcept(roleCatalogEntry(ensureGraph(), selected())?.role ?? (() => { throw new TypeError(`role not found: ${name}`); })()), memberPackages("role"), { base });
                case "role-jsonld": return roleJsonLd(roleConcept(roleCatalogEntry(ensureGraph(), selected())?.role ?? (() => { throw new TypeError(`role not found: ${name}`); })()), memberPackages("role"), { base });
                case "type-turtle": return typeFlowTurtle(neighbourhood(), { base });
                case "type-jsonld": return typeFlowJsonLd(neighbourhood(), { base });
                default: throw new TypeError(`unknown report: ${kind}`);
            }
        },
    };
    const platform = createJsnodePlatform(mcpDeps, [{
            name: "jsnode-workspace",
            start: async () => {
                await refresh();
                if (config.intervalSeconds !== undefined)
                    timer = setInterval(() => { void refresh(); }, config.intervalSeconds * 1000);
                return mcpDeps;
            },
            close: () => { if (timer !== undefined)
                clearInterval(timer); },
        }], config.journalRoot ? { packageRoot: config.journalRoot, server: config.name } : undefined);
    return platform;
}
//# sourceMappingURL=service.mjs.map

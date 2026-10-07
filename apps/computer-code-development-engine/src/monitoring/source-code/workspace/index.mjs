/**
 * @packageDocumentation
 *
 * monitoring/source-code/workspace - the workspace as its internal package dependency DAG.
 *
 * Pure over an already-admitted `WorkspaceScan` (`src/integrations/filesystem/services/workspace-scanner`,
 * `src/workspace/schemas/admission`): no filesystem read happens here. Nodes are admitted
 * packages; edges are runtime `dependencies` whose target is itself a
 * discovered package — external npm leaves and dev/peer ranges are dropped so
 * the graph stays closed over the workspace. Build order is read as a
 * causal-set height stratification (`core/closure/analysis/causal`) rather
 * than a hand-rolled topological sort: a cycle surfaces as the same
 * closed-timelike-curve obstruction any other causal-set reading in this
 * package would produce, not a silently-dropped cycle member.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";

import {
  buildOrderObstructionContract,
  buildOrderTiersContract,
  workspaceDependencyGraphContract,
  workspaceDependencyGraphEdgeContract,
  workspaceDependencyGraphNodeContract,

} from "./schema.mjs";
import * as causal from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal";

export * from "./schema.mjs";
export * from "./import-audit.mjs";

function admittedPackagesOf(scan) {
  const out = [];
  for (const entry of scan.packages) {
    if (entry.admission.kind === "metroplat.admission.package-manifest") {
      out.push(Object.freeze({ scan: entry, admission: entry.admission }));
    }
  }
  return Object.freeze(out);
}

function internalDependencyNames(admission, internalNames) {
  const deps = admission.manifest.dependencies;
  if (deps === undefined || deps === null || typeof deps !== "object" || Array.isArray(deps)) return Object.freeze([]);
  return Object.freeze(
    Object.keys(deps)
      .filter((name) => internalNames.has(name) && name !== admission.manifest.name)
      .sort(),
  );
}

function buildOrderOf(
  nodes,
  edges,
) {
  // Causal links run dependency -> dependent so height 0 is "depends on
  // nothing internal" (leaf-first build order), the reverse of the edge's own
  // dependent -> dependency direction.
  const causalSet = Object.freeze({
    kind: "lorentzian.causalSet",
    events: Object.freeze(nodes.map((node) => node.name)),
    links: Object.freeze(edges.map((edge) => Object.freeze({ from: edge.to, to: edge.from }))),
  });
  const strata = causal.causalHeightStrata(causalSet);
  if (Array.isArray(strata)) {
    return buildOrderTiersContract.assert({
      kind: "metroplat.workspace-graph.build-order",
      tiers: strata,
    }, "workspace build order");
  }
  return buildOrderObstructionContract.assert(strata, "workspace build order obstruction");
}

/** Importer-relative path (`.` for the workspace root) a lockfile keys resolution facts under. */
function lockfileImporterPath(workspaceRoot, packageRoot) {
  const relative = path.relative(workspaceRoot, packageRoot).split(path.sep).join("/");
  return relative === "" ? "." : relative;
}

/** Whether a lockfile importer proves `to` resolves for `from` as a `link:` target. */
function lockfileConfirmsWorkspaceLink(lockfile, importerPath, to) {
  const importer = lockfile.importers.find((entry) => entry.path === importerPath);
  return importer?.dependencies.some((use) => use.name === to && use.workspaceLink) ?? false;
}

/**
 * Project an admitted workspace scan onto its internal package dependency
 * DAG. When a pnpm lockfile admission is supplied, edges also carry
 * `resolved`: true only when the lockfile importer for the consumer proves
 * the dependency resolves to a `link:` target, not merely a declared range.
 */
export function workspaceDependencyGraphOf(scan, options = {}) {
  const admitted = admittedPackagesOf(scan);
  const internalNames = new Set(admitted.map((entry) => entry.admission.manifest.name));

  const nodes = [];
  const edges = [];
  for (const { scan: packageScan, admission } of admitted) {
    const dependencies = internalDependencyNames(admission, internalNames);
    nodes.push(workspaceDependencyGraphNodeContract.assert({
      name: admission.manifest.name,
      root: packageScan.root,
      private: admission.manifest.private === true,
      dependencies,
    }, `workspace graph node ${admission.manifest.name}`));
    const importerPath = options.lockfile === undefined ? undefined : lockfileImporterPath(scan.root, packageScan.root);
    for (const to of dependencies) {
      edges.push(workspaceDependencyGraphEdgeContract.assert({
        from: admission.manifest.name,
        to,
        ...(options.lockfile === undefined || importerPath === undefined
          ? {}
          : { resolved: lockfileConfirmsWorkspaceLink(options.lockfile, importerPath, to) }),
      }, `workspace graph edge ${admission.manifest.name}->${to}`));
    }
  }

  return workspaceDependencyGraphContract.assert({
    kind: "metroplat.workspace-graph",
    root: scan.root,
    nodes,
    edges,
    buildOrder: buildOrderOf(nodes, edges),
  }, "workspace dependency graph");
}

/** The neighbourhood of one package: itself, its dependencies to `downDepth`
 *  hops, and its dependents to `upDepth` hops. Edges are kept only when both
 *  endpoints remain, so the result stays a closed subgraph. Build order is
 *  re-derived over the restricted node set, not sliced from the parent. */
export function egoWorkspaceDependencyGraph(
  graph,
  name,
  options = {},
) {
  const downDepth = options.downDepth ?? 1;
  const upDepth = options.upDepth ?? 1;
  const byName = new Map(graph.nodes.map((node) => [node.name, node]));
  if (!byName.has(name)) {
    return workspaceDependencyGraphContract.assert({
      kind: "metroplat.workspace-graph",
      root: graph.root,
      nodes: [],
      edges: [],
      buildOrder: buildOrderOf([], []),
    }, "empty ego workspace dependency graph");
  }

  const forward = new Map();
  const reverse = new Map();
  for (const node of graph.nodes) {
    forward.set(node.name, []);
    reverse.set(node.name, []);
  }
  for (const edge of graph.edges) {
    forward.get(edge.from)?.push(edge.to);
    reverse.get(edge.to)?.push(edge.from);
  }

  const reach = (adjacency, depth) => {
    const seen = new Set();
    let frontier = [name];
    for (let hop = 0; hop < depth; hop += 1) {
      const next = [];
      for (const current of frontier) {
        for (const neighbour of adjacency.get(current) ?? []) {
          if (!seen.has(neighbour)) {
            seen.add(neighbour);
            next.push(neighbour);
          }
        }
      }
      frontier = next;
    }
    return seen;
  };

  const keep = new Set([name, ...reach(forward, downDepth), ...reach(reverse, upDepth)]);
  const nodes = graph.nodes
    .filter((node) => keep.has(node.name))
    .map((node) => workspaceDependencyGraphNodeContract.assert({
      ...node,
      dependencies: node.dependencies.filter((dependency) => keep.has(dependency)),
    }, `ego workspace graph node ${node.name}`));
  const edges = graph.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to));

  return workspaceDependencyGraphContract.assert({
    kind: "metroplat.workspace-graph",
    root: graph.root,
    nodes,
    edges,
    buildOrder: buildOrderOf(nodes, edges),
  }, `ego workspace dependency graph ${name}`);
}

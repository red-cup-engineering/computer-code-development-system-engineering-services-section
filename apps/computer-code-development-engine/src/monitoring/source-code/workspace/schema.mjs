/**
 * @packageDocumentation
 *
 * monitoring/source-code/workspace/schema - the workspace package DAG as schema material.
 *
 * A generated projection over admitted `WorkspaceScan` material
 * (`src/workspace/schemas/admission` and
 * `src/integrations/filesystem/services/workspace-scanner`): nodes are admitted workspace packages, edges are
 * their internal (workspace-to-workspace) runtime dependency declarations. No
 * filesystem or process boundary lives here — this is the schema shape the
 * pure projection in `src/monitoring/source-code/workspace` returns.
 *
 * @metroplatSubject source-code
 */

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const nonemptyStringSchema = { type: "string", minLength: 1 };
const stringSequenceSchema = { type: "array", items: nonemptyStringSchema };

export const workspacePackageConformanceRequestSchema = {
  $id: "metroplat/projections/workspace-graph/package-conformance-request",
  title: "WorkspacePackageConformanceRequest",
  description: "An optional workspace root to inspect without changing the host authority store.",
  type: "object",
  additionalProperties: false,
  properties: { root: nonemptyStringSchema },
};

export const workspacePackageConformanceRequestContract = schemaFrom(workspacePackageConformanceRequestSchema);

export const workspaceImportAuditRequestSchema = {
  $id: "metroplat/projections/workspace-graph/import-audit-request",
  title: "WorkspaceImportAuditRequest",
  description: "An optional workspace root to inspect, and an optional scope to named package directories, without changing the host authority store.",
  type: "object",
  additionalProperties: false,
  properties: {
    root: nonemptyStringSchema,
    /** Package directories (absolute, or relative to `root`) to audit; every other discovered package is excluded. */
    paths: { type: "array", items: nonemptyStringSchema, minItems: 1 },
  },
};

export const workspaceImportAuditRequestContract = schemaFrom(workspaceImportAuditRequestSchema);

export const workspaceDependencyGraphNodeSchema = {
  $id: "metroplat/projections/workspace-graph/node",
  title: "WorkspaceDependencyGraphNode",
  description: "One admitted workspace package as a dependency-graph node.",
  type: "object",
  required: ["name", "root", "private", "dependencies"],
  properties: {
    name: nonemptyStringSchema,
    root: nonemptyStringSchema,
    private: { type: "boolean" },
    /** Runtime dependency names that resolve to other nodes in this graph. */
    dependencies: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const workspaceDependencyGraphNodeContract = schemaFrom(workspaceDependencyGraphNodeSchema);

export const workspaceDependencyGraphEdgeSchema = {
  $id: "metroplat/projections/workspace-graph/edge",
  title: "WorkspaceDependencyGraphEdge",
  description: "One dependency edge: `from` declares a runtime dependency on `to`, both workspace packages.",
  type: "object",
  required: ["from", "to"],
  properties: {
    from: nonemptyStringSchema,
    to: nonemptyStringSchema,
    /** True when a lockfile admission confirms the edge resolves to a workspace
     *  link, not merely a declared range. Absent when no lockfile was read. */
    resolved: { type: "boolean" },
  },
  additionalProperties: false,
};

export const workspaceDependencyGraphEdgeContract = schemaFrom(workspaceDependencyGraphEdgeSchema);

const causalLinkSchema = {
  type: "object",
  required: ["from", "to"],
  properties: { from: nonemptyStringSchema, to: nonemptyStringSchema },
  additionalProperties: false,
};

export const buildOrderObstructionSchema = {
  $id: "metroplat/projections/workspace-graph/build-order-obstruction",
  title: "WorkspaceBuildOrderObstruction",
  description: "The workspace dependency graph is not a DAG: a closed-timelike-curve obstruction over its causal reading.",
  type: "object",
  required: ["kind", "reason", "events", "directLinks", "closure", "cycle"],
  properties: {
    kind: { const: "lorentzian.causalSettle-obstruction" },
    reason: { enum: ["duplicate-event", "unknown-event", "closed-timelike-curve"] },
    events: stringSequenceSchema,
    directLinks: { type: "array", items: causalLinkSchema },
    closure: { type: "array", items: causalLinkSchema },
    offending: causalLinkSchema,
    cycle: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const buildOrderObstructionContract = schemaFrom(buildOrderObstructionSchema);

export const buildOrderTiersSchema = {
  $id: "metroplat/projections/workspace-graph/build-order-tiers",
  title: "WorkspaceBuildOrderTiers",
  description: "Kahn-style topological layering of the workspace dependency DAG: tier 0 depends on nothing internal.",
  type: "object",
  required: ["kind", "tiers"],
  properties: {
    kind: { const: "metroplat.workspace-graph.build-order" },
    tiers: { type: "array", items: stringSequenceSchema },
  },
  additionalProperties: false,
};

export const buildOrderTiersContract = schemaFrom(buildOrderTiersSchema);

export const workspaceDependencyGraphSchema = {
  $id: "metroplat/projections/workspace-graph/graph",
  title: "WorkspaceDependencyGraph",
  description: "The workspace as an internal package dependency DAG, projected from an admitted workspace scan.",
  type: "object",
  required: ["kind", "root", "nodes", "edges", "buildOrder"],
  properties: {
    kind: { const: "metroplat.workspace-graph" },
    root: nonemptyStringSchema,
    nodes: { type: "array", items: workspaceDependencyGraphNodeSchema },
    edges: { type: "array", items: workspaceDependencyGraphEdgeSchema },
    buildOrder: { anyOf: [buildOrderTiersSchema, buildOrderObstructionSchema] },
  },
  additionalProperties: false,
};

export const workspaceDependencyGraphContract = schemaFrom(workspaceDependencyGraphSchema);

const packageConformanceDeviationSchema = {
  type: "object",
  required: ["code", "detail"],
  properties: {
    code: nonemptyStringSchema,
    detail: nonemptyStringSchema,
  },
  additionalProperties: false,
};

export const workspacePackageConformanceSchema = {
  $id: "metroplat/projections/workspace-graph/package-conformance",
  title: "WorkspacePackageConformance",
  description: "Flatfile-projected package review observations for one workspace cut.",
  type: "object",
  required: ["kind", "root", "packages", "diagnostics", "deviationCount"],
  properties: {
    kind: { const: "metroplat.workspace-graph.package-conformance" },
    root: nonemptyStringSchema,
    packages: {
      type: "array",
      items: {
        type: "object",
        required: ["resource", "name", "deviations"],
        properties: {
          resource: nonemptyStringSchema,
          name: nonemptyStringSchema,
          deviations: { type: "array", items: packageConformanceDeviationSchema },
        },
        additionalProperties: false,
      },
    },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "path", "message"],
        properties: {
          code: nonemptyStringSchema,
          path: nonemptyStringSchema,
          message: nonemptyStringSchema,
        },
        additionalProperties: false,
      },
    },
    deviationCount: { type: "integer", minimum: 0 },
  },
  additionalProperties: false,
};

export const workspacePackageConformanceContract = schemaFrom(workspacePackageConformanceSchema);

export const decommissionedImportViolationSchema = {
  $id: "metroplat/projections/workspace-graph/decommissioned-import-violation",
  title: "DecommissionedImportViolation",
  description: "A live (non-decommissioned) package declaring a runtime dependency on a decommissioned package.",
  type: "object",
  required: ["consumer", "provider", "providerRoot"],
  properties: {
    consumer: nonemptyStringSchema,
    provider: nonemptyStringSchema,
    providerRoot: nonemptyStringSchema,
  },
  additionalProperties: false,
};

export const decommissionedImportViolationContract = schemaFrom(decommissionedImportViolationSchema);

export const workspaceDecommissionedImportAuditSchema = {
  $id: "metroplat/projections/workspace-graph/decommissioned-import-audit",
  title: "WorkspaceDecommissionedImportAudit",
  description: "Live packages whose declared runtime dependencies reach a decommissioned package family, read from the workspace dependency graph.",
  type: "object",
  required: ["kind", "decommissionedPackages", "violations"],
  properties: {
    kind: { const: "metroplat.workspace-graph.decommissioned-import-audit" },
    decommissionedPackages: stringSequenceSchema,
    violations: { type: "array", items: decommissionedImportViolationSchema },
  },
  additionalProperties: false,
};

export const workspaceDecommissionedImportAuditContract = schemaFrom(workspaceDecommissionedImportAuditSchema);

export const workspacePhantomImportSchema = {
  $id: "metroplat/projections/workspace-graph/phantom-import",
  title: "WorkspacePhantomImport",
  description: "A package's source actually imports another workspace package that its manifest never declares as a dependency.",
  type: "object",
  required: ["consumer", "provider", "importedFrom"],
  properties: {
    consumer: nonemptyStringSchema,
    provider: nonemptyStringSchema,
    /** Files in `consumer` whose import specifier resolved to `provider`. */
    importedFrom: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const workspacePhantomImportContract = schemaFrom(workspacePhantomImportSchema);

export const workspaceStaleDependencySchema = {
  $id: "metroplat/projections/workspace-graph/stale-dependency",
  title: "WorkspaceStaleDependency",
  description: "A package's manifest declares a runtime dependency on another workspace package that no source file ever actually imports.",
  type: "object",
  required: ["consumer", "provider"],
  properties: {
    consumer: nonemptyStringSchema,
    provider: nonemptyStringSchema,
  },
  additionalProperties: false,
};

export const workspaceStaleDependencyContract = schemaFrom(workspaceStaleDependencySchema);

export const workspaceCrossPackageRelativeImportSchema = {
  $id: "metroplat/projections/workspace-graph/cross-package-relative-import",
  title: "WorkspaceCrossPackageRelativeImport",
  description: "A relative import specifier resolves outside its own package root, reaching a sibling package's files by path instead of by package name.",
  type: "object",
  required: ["consumer", "file", "target"],
  properties: {
    consumer: nonemptyStringSchema,
    file: nonemptyStringSchema,
    target: nonemptyStringSchema,
    /** The workspace package `target` actually resolves inside, when one admitted the scan. */
    resolvesInto: nonemptyStringSchema,
  },
  additionalProperties: false,
};

export const workspaceCrossPackageRelativeImportContract = schemaFrom(workspaceCrossPackageRelativeImportSchema);

export const workspaceImportAuditSchema = {
  $id: "metroplat/projections/workspace-graph/import-audit",
  title: "WorkspaceImportAudit",
  description: "Declared workspace dependency edges cross-referenced against each package's own TypeScript-AST-derived imports (module-topology): phantom imports, stale declared dependencies, and relative imports that cross a package boundary.",
  type: "object",
  required: ["kind", "packagesAudited", "phantomImports", "staleDependencies", "crossPackageRelativeImports"],
  properties: {
    kind: { const: "metroplat.workspace-graph.import-audit" },
    /** Package names actually covered (a module-topology read was supplied for them). */
    packagesAudited: stringSequenceSchema,
    phantomImports: { type: "array", items: workspacePhantomImportSchema },
    staleDependencies: { type: "array", items: workspaceStaleDependencySchema },
    crossPackageRelativeImports: { type: "array", items: workspaceCrossPackageRelativeImportSchema },
  },
  additionalProperties: false,
};

export const workspaceImportAuditContract = schemaFrom(workspaceImportAuditSchema);

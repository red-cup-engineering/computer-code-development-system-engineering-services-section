/**
 * @packageDocumentation
 *
 * Contracts for source-code topology, JSNode placement, and bounded projections.
 *
 * @metroplatSubject source-code
 */

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

import { nodeBeingLayerNames, nodeBeingFormalContextSchema, nodeBeingReadoutSchema, nodeBeingSpeciesConceptSchema, nodeBeingTaxonNames, nodeSubjectAnchorSchema } from "@red-cup-engineering/communicating/language/jsnode/taxonomy";

const jsonValueSchema = {};
const stringSequenceSchema = { type: "array", items: { type: "string", minLength: 1 } };
export const nodeSubjectAnchorCoverageNames = Object.freeze(["partial", "complete"]);

/** Conventional package-layer projection of the canonical JSNode taxa. */
export const nodePackageLayerNames = nodeBeingLayerNames;

/** Project-level carrier conventions from the categorical Node layout note. */
export const nodePackageLayoutConventionNames = Object.freeze([
  "context-layer-directories",
  "layer-context-directories",
  "context-directory-layer-filename",
]);

export const nodePackageLayoutConventionReadingSchema = {
  type: "object",
  required: ["kind", "identity", "reading", "candidates", "observations", "reasons"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.layout-convention" },
    identity: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    reading: { enum: ["unknown", "held", "denied", "contested"] },
    convention: { enum: nodePackageLayoutConventionNames },
    candidates: { type: "array", items: { enum: nodePackageLayoutConventionNames } },
    observations: {
      type: "array",
      items: {
        type: "object",
        required: ["convention", "paths"],
        additionalProperties: false,
        properties: {
          convention: { enum: nodePackageLayoutConventionNames },
          paths: stringSequenceSchema,
        },
      },
    },
    reasons: stringSequenceSchema,
  },
};

const moduleTopologyPlacementObservedProperties = {
  contextStatus: { enum: ["unknown", "anchored", "cross-cutting", "contested"] },
  context: { type: "string", minLength: 1 },
  contextReason: { type: "string", minLength: 1 },
  signals: stringSequenceSchema,
  confidence: { enum: ["reified", "heuristic"] },
  ambiguous: { type: "boolean" },
  ambiguityCauses: stringSequenceSchema,
  actualLayer: { enum: nodePackageLayerNames },
  actualPackageRegion: { enum: ["source", "integration", "library", "application"] },
  actualContext: { type: "string", minLength: 1 },
  contextMatches: { type: "boolean" },
};

export const moduleTopologyPlacementSchema = {
  oneOf: [
    {
      type: "object",
      required: ["kind", "layer", "packageRegion", "packageRegionReason", "contextStatus", "contextReason", "signals", "confidence", "ambiguous", "ambiguityCauses", "actualPackageRegion"],
      additionalProperties: false,
      properties: {
        kind: { const: "metroplat.monitoring.source-code.placement:witness" },
        ...moduleTopologyPlacementObservedProperties,
        layer: { enum: nodePackageLayerNames },
        packageRegion: { enum: ["source", "integration", "library", "application"] },
        packageRegionReason: { type: "string", minLength: 1 },
        layerMatches: { type: "boolean" },
      },
    },
    {
      type: "object",
      required: ["kind", "obstructions", "contextStatus", "contextReason", "signals", "confidence", "ambiguous", "ambiguityCauses", "actualPackageRegion"],
      additionalProperties: false,
      properties: {
        kind: { const: "metroplat.monitoring.source-code.placement:obstruction" },
        ...moduleTopologyPlacementObservedProperties,
        obstructions: stringSequenceSchema,
      },
    },
  ],
};

export const moduleTopologySpeciesCensusEntrySchema = {
  type: "object",
  required: ["taxon", "taxonIdentity", "layer", "held", "denied", "contested", "unknown"],
  additionalProperties: false,
  properties: {
    taxon: { enum: nodeBeingTaxonNames },
    taxonIdentity: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    layer: { enum: nodePackageLayerNames },
    held: { type: "integer", minimum: 0 },
    denied: { type: "integer", minimum: 0 },
    contested: { type: "integer", minimum: 0 },
    unknown: { type: "integer", minimum: 0 },
  },
};

export const nodeBeingDocumentationProjectionSchema = {
  type: "object",
  required: ["kind", "version", "source", "artifact", "witness", "text", "jsdoc", "validationScope", "lossProfile"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.language.jsnode.documentation-projection" },
    version: { const: 1 },
    source: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    artifact: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    witness: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    text: { type: "string", minLength: 1 },
    jsdoc: { type: "string", minLength: 1 },
    sourceSummary: { type: "string", minLength: 1 },
    validationScope: stringSequenceSchema,
    lossProfile: {
      oneOf: [
        {
          type: "object",
          required: ["kind"],
          additionalProperties: false,
          properties: { kind: { const: "lossless" } },
        },
        {
          type: "object",
          required: ["kind", "omits"],
          additionalProperties: false,
          properties: {
            kind: { const: "lossy" },
            omits: stringSequenceSchema,
          },
        },
      ],
    },
  },
};

export const moduleTopologyReadRequestSchema = {
  $id: "metroplat/services/module-topology/read-request",
  title: "ModuleTopologyReadRequest",
  description: "A filesystem-bounded request to read one package's own source-tree scale and import topology.",
  type: "object",
  required: ["kind", "root"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.module-topology.read-request" },
    root: { type: "string", minLength: 1 },
    sourceDirs: stringSequenceSchema,
    subjectAnchors: { type: "array", items: nodeSubjectAnchorSchema },
    subjectAnchorCoverage: { enum: nodeSubjectAnchorCoverageNames },
    paths: stringSequenceSchema,
    maxFiles: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    includeSymbols: { type: "boolean" },
    at: jsonValueSchema,
    caller: jsonValueSchema,
  },
};

export const moduleTopologyReadRequestContract = schemaFrom(moduleTopologyReadRequestSchema);

export const moduleTopologySymbolSchema = {
  type: "object",
  required: ["name", "kind", "line", "exported", "dependsOnModules", "dependsOnImportedSymbols", "dependsOnLocal", "referencedBySymbols", "being", "placement"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    kind: { enum: ["function", "class", "interface", "type", "const"] },
    line: { type: "integer", minimum: 1 },
    exported: { type: "boolean" },
    summary: { type: "string", minLength: 1 },
    dependsOnModules: stringSequenceSchema,
    dependsOnImportedSymbols: stringSequenceSchema,
    dependsOnLocal: stringSequenceSchema,
    referencedBySymbols: stringSequenceSchema,
    being: nodeBeingReadoutSchema,
    placement: moduleTopologyPlacementSchema,
    documentation: nodeBeingDocumentationProjectionSchema,
  },
};

export const moduleTopologyReexportSchema = {
  type: "object",
  required: ["module", "imported", "exported", "typeOnly"],
  additionalProperties: false,
  properties: {
    module: { type: "string", minLength: 1 },
    imported: { type: "string", minLength: 1 },
    exported: { type: "string", minLength: 1 },
    typeOnly: { type: "boolean" },
  },
};

export const moduleTopologyModuleSchema = {
  type: "object",
  required: ["path", "identity", "loc", "sloc", "functions", "classes", "imports", "typeImports", "importedBy", "typeImportedBy", "externalImports", "externalTypeImports", "reexports", "symbols", "symbolClusters", "subjectAnchoredSymbols", "subjectUnanchoredSymbols", "multiplySubjectAnchoredSymbols", "placementObstructions", "placementLayers", "placementContexts", "placementColors", "carrierChromaticNumber", "mixedPlacement"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    identity: { type: "string", minLength: 1 },
    loc: { type: "integer", minimum: 0 },
    sloc: { type: "integer", minimum: 0 },
    functions: { type: "integer", minimum: 0 },
    classes: { type: "integer", minimum: 0 },
    imports: stringSequenceSchema,
    typeImports: stringSequenceSchema,
    importedBy: stringSequenceSchema,
    typeImportedBy: stringSequenceSchema,
    externalImports: stringSequenceSchema,
    externalTypeImports: stringSequenceSchema,
    reexports: { type: "array", items: moduleTopologyReexportSchema },
    symbols: { type: "array", items: moduleTopologySymbolSchema },
    symbolClusters: { type: "array", items: stringSequenceSchema },
    subjectAnchoredSymbols: { type: "integer", minimum: 0 },
    subjectUnanchoredSymbols: { type: "integer", minimum: 0 },
    multiplySubjectAnchoredSymbols: { type: "integer", minimum: 0 },
    placementObstructions: { type: "integer", minimum: 0 },
    placementLayers: stringSequenceSchema,
    placementContexts: stringSequenceSchema,
    placementColors: stringSequenceSchema,
    carrierChromaticNumber: { type: "integer", minimum: 0 },
    mixedPlacement: { type: "boolean" },
  },
};

export const moduleTopologyReadSchema = {
  $id: "metroplat/services/module-topology/read",
  title: "ModuleTopologyRead",
  description: "One package's own source-tree scale (LoC, module, function, class counts) and its import dependency graph, read from the TypeScript AST rather than pattern matching.",
  type: "object",
  required: ["kind", "operation", "source", "observation", "root", "sourceDirs", "subjectAnchors", "subjectAnchorCoverage", "layoutConvention", "files", "loc", "sloc", "functions", "classes", "modules", "modulesWithDisconnectedSymbolClusters", "maxSymbolClusters", "cyclicComponents", "symbols", "subjectAnchoredSymbols", "subjectUnanchoredSymbols", "multiplySubjectAnchoredSymbols", "speciesContext", "speciesConcepts", "speciesCensus", "speciesFormulas", "placementObstructions", "ambiguousPlacements", "layerMismatches", "contextMismatches", "mixedPlacementModules", "multicoloredCarriers", "maxCarrierChromaticNumber", "crossCuttingContexts", "unresolvedContexts"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.module-topology.read" },
    operation: { const: "read-module-topology" },
    source: { type: "string", minLength: 1 },
    observation: { type: "string", minLength: 1 },
    root: { type: "string", minLength: 1 },
    sourceDirs: stringSequenceSchema,
    subjectAnchors: { type: "array", items: nodeSubjectAnchorSchema },
    subjectAnchorCoverage: { enum: nodeSubjectAnchorCoverageNames },
    layoutConvention: nodePackageLayoutConventionReadingSchema,
    files: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    loc: { type: "integer", minimum: 0 },
    sloc: { type: "integer", minimum: 0 },
    functions: { type: "integer", minimum: 0 },
    classes: { type: "integer", minimum: 0 },
    modules: { type: "array", items: moduleTopologyModuleSchema },
    modulesWithDisconnectedSymbolClusters: { type: "integer", minimum: 0 },
    maxSymbolClusters: { type: "integer", minimum: 0 },
    cyclicComponents: { type: "array", items: stringSequenceSchema },
    symbols: { type: "integer", minimum: 0 },
    subjectAnchoredSymbols: { type: "integer", minimum: 0 },
    subjectUnanchoredSymbols: { type: "integer", minimum: 0 },
    multiplySubjectAnchoredSymbols: { type: "integer", minimum: 0 },
    speciesContext: nodeBeingFormalContextSchema,
    speciesConcepts: { type: "array", items: nodeBeingSpeciesConceptSchema },
    speciesCensus: { type: "array", items: moduleTopologySpeciesCensusEntrySchema },
    speciesFormulas: { type: "integer", minimum: 0 },
    placementObstructions: { type: "integer", minimum: 0 },
    ambiguousPlacements: { type: "integer", minimum: 0 },
    layerMismatches: { type: "integer", minimum: 0 },
    contextMismatches: { type: "integer", minimum: 0 },
    mixedPlacementModules: { type: "integer", minimum: 0 },
    multicoloredCarriers: { type: "integer", minimum: 0 },
    maxCarrierChromaticNumber: { type: "integer", minimum: 0 },
    crossCuttingContexts: { type: "integer", minimum: 0 },
    unresolvedContexts: { type: "integer", minimum: 0 },
  },
};

/** @metroplatSubject monitoring */

export const moduleTopologyReadContract = schemaFrom(moduleTopologyReadSchema);

export const moduleTopologyPageModuleSchema = {
  type: "object",
  required: ["path", "identity", "loc", "sloc", "functions", "classes", "imports", "typeImports", "importedBy", "typeImportedBy", "externalImports", "externalTypeImports", "reexports", "symbolCount", "symbolClusterCount", "subjectAnchoredSymbols", "subjectUnanchoredSymbols", "multiplySubjectAnchoredSymbols", "placementObstructions", "placementLayers", "placementContexts", "placementColors", "carrierChromaticNumber", "mixedPlacement"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    identity: { type: "string", minLength: 1 },
    loc: { type: "integer", minimum: 0 },
    sloc: { type: "integer", minimum: 0 },
    functions: { type: "integer", minimum: 0 },
    classes: { type: "integer", minimum: 0 },
    imports: stringSequenceSchema,
    typeImports: stringSequenceSchema,
    importedBy: stringSequenceSchema,
    typeImportedBy: stringSequenceSchema,
    externalImports: stringSequenceSchema,
    externalTypeImports: stringSequenceSchema,
    reexports: { type: "array", items: moduleTopologyReexportSchema },
    symbolCount: { type: "integer", minimum: 0 },
    symbolClusterCount: { type: "integer", minimum: 0 },
    subjectAnchoredSymbols: { type: "integer", minimum: 0 },
    subjectUnanchoredSymbols: { type: "integer", minimum: 0 },
    multiplySubjectAnchoredSymbols: { type: "integer", minimum: 0 },
    placementObstructions: { type: "integer", minimum: 0 },
    symbols: { type: "array", items: moduleTopologySymbolSchema },
    symbolClusters: { type: "array", items: stringSequenceSchema },
    placementLayers: stringSequenceSchema,
    placementContexts: stringSequenceSchema,
    placementColors: stringSequenceSchema,
    carrierChromaticNumber: { type: "integer", minimum: 0 },
    mixedPlacement: { type: "boolean" },
  },
};

export const moduleTopologyPageSchema = {
  $id: "metroplat/monitoring/source-code/module-topology-page",
  title: "ModuleTopologyPage",
  description: "A deterministic bounded page over one complete TypeScript source-topology observation. Aggregate measurements cover the complete observed source set; detailed modules are paged so MetroPlat can carry its own topology through its canonical artifact boundary.",
  type: "object",
  required: ["kind", "operation", "source", "observation", "root", "sourceDirs", "subjectAnchors", "subjectAnchorCoverage", "layoutConvention", "files", "loc", "sloc", "functions", "classes", "modulesWithDisconnectedSymbolClusters", "maxSymbolClusters", "cyclicComponents", "symbols", "subjectAnchoredSymbols", "subjectUnanchoredSymbols", "multiplySubjectAnchoredSymbols", "speciesContext", "speciesConcepts", "speciesCensus", "speciesFormulas", "placementObstructions", "ambiguousPlacements", "layerMismatches", "contextMismatches", "mixedPlacementModules", "multicoloredCarriers", "maxCarrierChromaticNumber", "crossCuttingContexts", "unresolvedContexts", "totalModules", "offset", "limit", "returned", "includeSymbols", "modules"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.module-topology" },
    operation: { const: "read-module-topology" },
    source: { type: "string", minLength: 1 },
    observation: { type: "string", minLength: 1 },
    root: { type: "string", minLength: 1 },
    sourceDirs: stringSequenceSchema,
    subjectAnchors: { type: "array", items: nodeSubjectAnchorSchema },
    subjectAnchorCoverage: { enum: nodeSubjectAnchorCoverageNames },
    layoutConvention: nodePackageLayoutConventionReadingSchema,
    files: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    loc: { type: "integer", minimum: 0 },
    sloc: { type: "integer", minimum: 0 },
    functions: { type: "integer", minimum: 0 },
    classes: { type: "integer", minimum: 0 },
    modulesWithDisconnectedSymbolClusters: { type: "integer", minimum: 0 },
    maxSymbolClusters: { type: "integer", minimum: 0 },
    cyclicComponents: { type: "array", items: stringSequenceSchema },
    symbols: { type: "integer", minimum: 0 },
    subjectAnchoredSymbols: { type: "integer", minimum: 0 },
    subjectUnanchoredSymbols: { type: "integer", minimum: 0 },
    multiplySubjectAnchoredSymbols: { type: "integer", minimum: 0 },
    speciesContext: nodeBeingFormalContextSchema,
    speciesConcepts: { type: "array", items: nodeBeingSpeciesConceptSchema },
    speciesCensus: { type: "array", items: moduleTopologySpeciesCensusEntrySchema },
    speciesFormulas: { type: "integer", minimum: 0 },
    placementObstructions: { type: "integer", minimum: 0 },
    ambiguousPlacements: { type: "integer", minimum: 0 },
    layerMismatches: { type: "integer", minimum: 0 },
    contextMismatches: { type: "integer", minimum: 0 },
    mixedPlacementModules: { type: "integer", minimum: 0 },
    multicoloredCarriers: { type: "integer", minimum: 0 },
    maxCarrierChromaticNumber: { type: "integer", minimum: 0 },
    crossCuttingContexts: { type: "integer", minimum: 0 },
    unresolvedContexts: { type: "integer", minimum: 0 },
    totalModules: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    returned: { type: "integer", minimum: 0, maximum: 50 },
    nextOffset: { type: "integer", minimum: 0 },
    includeSymbols: { type: "boolean" },
    paths: stringSequenceSchema,
    matchedModules: { type: "integer", minimum: 0 },
    modules: { type: "array", items: moduleTopologyPageModuleSchema, maxItems: 50 },
  },
};

export const moduleTopologyPageContract = schemaFrom(moduleTopologyPageSchema);


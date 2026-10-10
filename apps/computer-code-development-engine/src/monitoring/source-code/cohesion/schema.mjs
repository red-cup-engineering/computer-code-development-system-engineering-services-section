/**
 * @packageDocumentation
 *
 * Contracts for source-code declaration-cohesion observations and projections.
 *
 * @metroplatSubject source-code
 */

import {
  schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const jsonValueSchema = {};
const stringSequenceSchema = { type: "array", items: { type: "string", minLength: 1 } };
const symbolGroupSequenceSchema = { type: "array", items: stringSequenceSchema };

import { EvidenceRecordSchema } from "@red-cup-engineering/metrologic/articulation/predicating/positing/evidence-record";
import { readingSchema } from "@red-cup-engineering/computer-data-engineering-services-section/four";

const cohesionFiltrationOrdinalSchema = {
  type: "object",
  required: ["kind", "predecessor"],
  additionalProperties: false,
  properties: {
    kind: { const: "ordinal.closure.ordinal.successor" },
    predecessor: {
      type: "object",
      required: ["kind"],
      additionalProperties: false,
      properties: { kind: { const: "ordinal.closure.ordinal.zero" } },
    },
  },
};

export const moduleCohesionValuationSchema = {
  type: "object",
  required: ["kind", "record", "reading", "topMass", "ordinal", "regime", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.module-cohesion.valuation" },
    record: EvidenceRecordSchema,
    reading: readingSchema("knowledge"),
    topMass: { type: "integer", minimum: 0 },
    ordinal: cohesionFiltrationOrdinalSchema,
    regime: {
      type: "object",
      required: ["kind"],
      additionalProperties: false,
      properties: { kind: { const: "ordinal.closure.regime.finite" } },
    },
    evidence: stringSequenceSchema,
  },
};

export const moduleCohesionReadRequestSchema = {
  $id: "metroplat/services/module-cohesion/read-request",
  title: "ModuleCohesionReadRequest",
  description: "A filesystem-bounded request to read one package's own module symbol cohesion.",
  type: "object",
  required: ["kind", "root"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.module-cohesion.read-request" },
    root: { type: "string", minLength: 1 },
    sourceDirs: stringSequenceSchema,
    maxFiles: { type: "integer", minimum: 1 },
    minSymbols: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    includeSymbols: { type: "boolean" },
    at: jsonValueSchema,
    caller: jsonValueSchema,
  },
};

export const moduleCohesionReadRequestContract = schemaFrom(moduleCohesionReadRequestSchema);

export const moduleCohesionModuleSchema = {
  type: "object",
  required: ["path", "identity", "symbols", "componentCount", "components", "valuation"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    identity: { type: "string", minLength: 1 },
    symbols: stringSequenceSchema,
    componentCount: { type: "integer", minimum: 0 },
    components: symbolGroupSequenceSchema,
    valuation: moduleCohesionValuationSchema,
  },
};

export const moduleCohesionReadSchema = {
  $id: "metroplat/services/module-cohesion/read",
  title: "ModuleCohesionRead",
  description: "One package's Record-valued declaration-cohesion read: each module's top-level declarations are partitioned by internal cross-reference and consumer co-import evidence (persistent H0), without collapsing support and residual separation into a Boolean defect ruling.",
  type: "object",
  required: ["kind", "operation", "source", "observation", "root", "sourceDirs", "files", "modules", "valuation"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.module-cohesion.read" },
    operation: { const: "read-module-cohesion" },
    source: { type: "string", minLength: 1 },
    observation: { type: "string", minLength: 1 },
    root: { type: "string", minLength: 1 },
    sourceDirs: stringSequenceSchema,
    files: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    minSymbols: { type: "integer", minimum: 1 },
    modules: { type: "array", items: moduleCohesionModuleSchema },
    valuation: moduleCohesionValuationSchema,
  },
};

export const moduleCohesionReadContract = schemaFrom(moduleCohesionReadSchema);

export const moduleCohesionPageModuleSchema = {
  type: "object",
  required: ["path", "identity", "symbolCount", "componentCount", "valuation"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    identity: { type: "string", minLength: 1 },
    symbolCount: { type: "integer", minimum: 0 },
    componentCount: { type: "integer", minimum: 0 },
    valuation: moduleCohesionValuationSchema,
    symbols: stringSequenceSchema,
    components: symbolGroupSequenceSchema,
  },
};

export const moduleCohesionPageSchema = {
  $id: "metroplat/monitoring/source-code/module-cohesion-page",
  title: "ModuleCohesionPage",
  description: "A deterministic bounded page over one complete declaration-cohesion observation. The complete source set's faithful evidence Record and Reading shadow remain present while detailed module partitions are paged for a content-addressable readout.",
  type: "object",
  required: ["kind", "operation", "source", "observation", "root", "sourceDirs", "files", "minSymbols", "valuation", "totalModules", "offset", "limit", "returned", "includeSymbols", "modules"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.module-cohesion" },
    operation: { const: "read-module-cohesion" },
    source: { type: "string", minLength: 1 },
    observation: { type: "string", minLength: 1 },
    root: { type: "string", minLength: 1 },
    sourceDirs: stringSequenceSchema,
    files: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    minSymbols: { type: "integer", minimum: 1 },
    valuation: moduleCohesionValuationSchema,
    totalModules: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    returned: { type: "integer", minimum: 0, maximum: 50 },
    nextOffset: { type: "integer", minimum: 0 },
    includeSymbols: { type: "boolean" },
    modules: { type: "array", items: moduleCohesionPageModuleSchema, maxItems: 50 },
  },
};

export const moduleCohesionPageContract = schemaFrom(moduleCohesionPageSchema);

const recordOrderRelationSchema = { enum: ["equal", "ascending", "descending", "incomparable"] };

export const moduleCohesionHistorySchema = {
  $id: "metroplat/monitoring/source-code/module-cohesion-history",
  title: "ModuleCohesionHistory",
  description: "A bounded temporal projection of distinct, content-identified module-cohesion observations over exact content-identified source corpora already admitted as governed RPC outcomes.",
  type: "object",
  required: ["kind", "dates", "rows", "malformed", "observations", "stages", "transitions"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.module-cohesion-history" },
    dates: stringSequenceSchema,
    rows: { type: "integer", minimum: 0 },
    malformed: { type: "integer", minimum: 0 },
    observations: { type: "integer", minimum: 0 },
    stages: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        required: ["source", "observation", "at", "invocation", "receipt", "causes", "valuation"],
        additionalProperties: false,
        properties: {
          source: { type: "string", minLength: 1 },
          observation: { type: "string", minLength: 1 },
          at: { type: "string", minLength: 1 },
          invocation: { type: "string", minLength: 1 },
          receipt: { type: "string", minLength: 1 },
          causes: stringSequenceSchema,
          valuation: moduleCohesionValuationSchema,
        },
      },
    },
    transitions: {
      type: "array",
      maxItems: 99,
      items: {
        type: "object",
        required: ["from", "to", "knowledge", "truth"],
        additionalProperties: false,
        properties: {
          from: { type: "string", minLength: 1 },
          to: { type: "string", minLength: 1 },
          knowledge: recordOrderRelationSchema,
          truth: recordOrderRelationSchema,
        },
      },
    },
  },
};

export const moduleCohesionHistoryContract = schemaFrom(moduleCohesionHistorySchema);


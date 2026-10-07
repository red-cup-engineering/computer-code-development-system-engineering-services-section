
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const jsonValueSchema = {};
const stringSequenceSchema = { type: "array", items: { type: "string", minLength: 1 } };

export const legibilityReadRequestSchema = {
  $id: "metroplat/services/legibility/read-request",
  title: "LegibilityReadRequest",
  description: "A filesystem-bounded request to read one conurbation's whole-tree material-legibility census.",
  type: "object",
  required: ["kind", "root"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.legibility.read-request" },
    root: { type: "string", minLength: 1 },
    darkSampleCap: { type: "integer", minimum: 0 },
    at: jsonValueSchema,
    caller: jsonValueSchema,
  },
};

export const legibilityReadRequestContract = schemaFrom(legibilityReadRequestSchema);

export const legibilityClassCountSchema = {
  type: "object",
  required: ["class", "files", "bytes"],
  additionalProperties: false,
  properties: {
    class: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    bytes: { type: "integer", minimum: 0 },
  },
};

export const legibilityTreeClassCountSchema = {
  type: "object",
  required: ["class", "files"],
  additionalProperties: false,
  properties: {
    class: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
  },
};

export const legibilityTreeSchema = {
  type: "object",
  required: ["path", "files", "darkFiles", "bytes", "darkBytes", "statFailures", "classes"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    darkFiles: { type: "integer", minimum: 0 },
    bytes: { type: "integer", minimum: 0 },
    darkBytes: { type: "integer", minimum: 0 },
    statFailures: { type: "integer", minimum: 0 },
    classes: { type: "array", items: legibilityTreeClassCountSchema },
  },
};

export const legibilityReadSchema = {
  $id: "metroplat/services/legibility/read",
  title: "LegibilityRead",
  description: "One conurbation's whole-tree material-legibility census: every file classified by path structure alone into plate tier, sidecar, carried codec form, host tooling, or dark, bucketed by major tree (matching monitoring/filesystem/file-census's own tree grouping) and by class. File, per-class file, and byte counts are all exhaustive (one stat call per file, no content read); a stat failure (permission, broken symlink, race) is counted per tree and overall in `statFailures` rather than silently dropped from the byte totals.",
  type: "object",
  required: ["kind", "operation", "root", "files", "legibilityRatio", "classes", "trees", "darkTotal", "darkSampleCap", "darkSample", "statFailures"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.legibility.read" },
    operation: { const: "read-legibility" },
    root: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    legibilityRatio: { type: ["number", "null"] },
    classes: { type: "array", items: legibilityClassCountSchema },
    trees: { type: "array", items: legibilityTreeSchema },
    darkTotal: { type: "integer", minimum: 0 },
    darkSampleCap: { type: "integer", minimum: 0 },
    darkSample: stringSequenceSchema,
    statFailures: { type: "integer", minimum: 0 },
  },
};

export const legibilityReadContract = schemaFrom(legibilityReadSchema);


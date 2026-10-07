
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const jsonValueSchema = {};

export const fileCensusReadRequestSchema = {
  $id: "metroplat/services/file-census/read-request",
  title: "FileCensusReadRequest",
  description: "A filesystem-bounded request to read one root's whole file-count and source-line scale.",
  type: "object",
  required: ["kind", "root"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.file-census.read-request" },
    root: { type: "string", minLength: 1 },
    maxContentFilesPerTree: { type: "integer", minimum: 1 },
    maxContentBytesPerTree: { type: "integer", minimum: 1 },
    at: jsonValueSchema,
    caller: jsonValueSchema,
  },
};

export const fileCensusReadRequestContract = schemaFrom(fileCensusReadRequestSchema);

export const fileCensusExtensionSchema = {
  type: "object",
  required: ["extension", "files"],
  additionalProperties: false,
  properties: {
    extension: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
  },
};

export const fileCensusTreeSchema = {
  type: "object",
  required: ["path", "files", "loc", "truncated", "extensions"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    loc: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    extensions: { type: "array", items: fileCensusExtensionSchema },
  },
};

export const fileCensusReadSchema = {
  $id: "metroplat/services/file-census/read",
  title: "FileCensusRead",
  description: "One filesystem root's whole file-count and source-line scale, grouped by major tree (the owner/kind directory prefix under core/, or the top-level directory name elsewhere) and file extension, read directly from the host filesystem rather than pattern-matched from prose. File counts and per-extension counts are exact; source line counts are exact only up to a bounded per-tree content-read sample, reported by that tree's own `truncated` flag.",
  type: "object",
  required: ["kind", "operation", "root", "files", "loc", "truncated", "trees"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.file-census.read" },
    operation: { const: "read-file-census" },
    root: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    loc: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    trees: { type: "array", items: fileCensusTreeSchema },
  },
};

export const fileCensusReadContract = schemaFrom(fileCensusReadSchema);


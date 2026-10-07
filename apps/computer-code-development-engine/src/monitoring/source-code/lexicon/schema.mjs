/**
 * @packageDocumentation
 *
 * Contracts for source-code lexicon observations and rulings.
 *
 * @metroplatSubject source-code
 */

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const jsonValueSchema = {};

export const lexiconEntrySchema = {
  type: "object",
  required: ["word", "ruling"],
  additionalProperties: false,
  properties: {
    word: { type: "string", minLength: 1 },
    ruling: { enum: ["unknown", "held", "denied", "contested"] },
    replacement: { type: "string", minLength: 1 },
    note: { type: "string", minLength: 1 },
  },
};

export const lexiconCensusReadRequestSchema = {
  $id: "metroplat/services/lexicon-census/read-request",
  title: "LexiconCensusReadRequest",
  description: "A request to count each lexicon entry's occurrences across one source root, so vocabulary migration starts and ends against measured divergence rather than intuition.",
  type: "object",
  required: ["kind", "root", "entries"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.lexicon-census.read-request" },
    root: { type: "string", minLength: 1 },
    entries: { type: "array", minItems: 1, items: lexiconEntrySchema },
    extensions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    maxFilesPerWord: { type: "integer", minimum: 1 },
    at: jsonValueSchema,
    caller: jsonValueSchema,
  },
};

export const lexiconCensusReadRequestContract = schemaFrom(lexiconCensusReadRequestSchema);

export const lexiconCensusFileSchema = {
  type: "object",
  required: ["path", "occurrences"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 1 },
    occurrences: { type: "integer", minimum: 1 },
  },
};

export const lexiconCensusEntryReadSchema = {
  type: "object",
  required: ["word", "ruling", "files", "occurrences", "perFile", "truncated"],
  additionalProperties: false,
  properties: {
    word: { type: "string", minLength: 1 },
    ruling: { enum: ["unknown", "held", "denied", "contested"] },
    replacement: { type: "string", minLength: 1 },
    note: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    occurrences: { type: "integer", minimum: 0 },
    perFile: { type: "array", items: lexiconCensusFileSchema },
    truncated: { type: "boolean" },
  },
};

export const lexiconCensusReadSchema = {
  $id: "metroplat/services/lexicon-census/read",
  title: "LexiconCensusRead",
  description: "One source root's lexicon divergence census: for each ruled word, the exact whole-word occurrence and file counts over the scanned extensions, with a bounded per-word file breakdown ordered by occurrence count. Counts are exact; only the per-file detail list is bounded, reported by each entry's own `truncated` flag.",
  type: "object",
  required: ["kind", "operation", "root", "files", "entries"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.lexicon-census.read" },
    operation: { const: "read-lexicon-census" },
    root: { type: "string", minLength: 1 },
    files: { type: "integer", minimum: 0 },
    entries: { type: "array", items: lexiconCensusEntryReadSchema },
  },
};

export const lexiconCensusReadContract = schemaFrom(lexiconCensusReadSchema);

export const lexiconReadSchema = {
  $id: "metroplat/services/lexicon-census/lexicon",
  title: "LexiconRead",
  description: "The current ruled lexicon: every admitted `lexicon:<word>` claim in the store's journal, folded to one entry per word through the FOUR knowledge join, with incompatible replacements retained as contested. The journal is the lexicon's only storage.",
  type: "object",
  required: ["kind", "operation", "root", "logs", "rulings", "entries"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.lexicon-census.lexicon" },
    operation: { const: "read-lexicon" },
    root: { type: "string", minLength: 1 },
    logs: { type: "integer", minimum: 0 },
    rulings: { type: "integer", minimum: 0 },
    entries: { type: "array", items: lexiconEntrySchema },
  },
};

export const lexiconReadContract = schemaFrom(lexiconReadSchema);


import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { readingFamilies } from "@red-cup-engineering/computer-data-services-section/four";

const jsonValueSchema = {};
const nonemptyStringSchema = { type: "string", minLength: 1 };
const stringSequenceSchema = { type: "array", items: nonemptyStringSchema };
const readingNameSchema = { enum: readingFamilies.knowledge };

const groundFileSchema = {
  type: "object",
  required: ["id", "path", "tree", "extension", "language", "role", "evidence"],
  additionalProperties: false,
  properties: {
    id: nonemptyStringSchema,
    path: nonemptyStringSchema,
    tree: nonemptyStringSchema,
    extension: nonemptyStringSchema,
    language: nonemptyStringSchema,
    role: nonemptyStringSchema,
    evidence: stringSequenceSchema,
  },
};

const relationSchema = {
  type: "object",
  required: ["from", "to", "relation", "evidence"],
  additionalProperties: false,
  properties: {
    from: nonemptyStringSchema,
    to: nonemptyStringSchema,
    relation: { enum: ["contains", "imports", "mentions", "witnesses"] },
    evidence: stringSequenceSchema,
  },
};

const groundSchema = {
  type: "object",
  required: ["kind", "root", "files", "relations", "truncated", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.proof-play.ground" },
    root: nonemptyStringSchema,
    files: { type: "array", items: groundFileSchema },
    relations: { type: "array", items: relationSchema },
    truncated: { type: "boolean" },
    evidence: stringSequenceSchema,
  },
};

const fieldSchema = {
  type: "object",
  required: ["kind", "field", "support", "value", "reading", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.proof-play.field" },
    field: { enum: ["language", "claim", "type", "proof", "reading", "evidence"] },
    support: nonemptyStringSchema,
    value: jsonValueSchema,
    reading: readingNameSchema,
    evidence: stringSequenceSchema,
  },
};

const coneLegSchema = {
  type: "object",
  required: ["id", "from", "to", "legKind", "evidence"],
  additionalProperties: false,
  properties: {
    id: nonemptyStringSchema,
    from: nonemptyStringSchema,
    to: nonemptyStringSchema,
    legKind: { enum: ["file", "field", "claim", "boundary"] },
    evidence: stringSequenceSchema,
  },
};

const coneExtremumSchema = {
  type: "object",
  required: ["id", "extremumKind", "support", "evidence"],
  additionalProperties: false,
  properties: {
    id: nonemptyStringSchema,
    extremumKind: { enum: ["domain", "codomain", "incoming", "outgoing"] },
    support: nonemptyStringSchema,
    evidence: stringSequenceSchema,
  },
};

const languageConeSchema = {
  type: "object",
  required: ["kind", "apex", "legs", "extrema", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.proof-play.language-cone" },
    apex: nonemptyStringSchema,
    legs: { type: "array", items: coneLegSchema },
    extrema: { type: "array", items: coneExtremumSchema },
    evidence: stringSequenceSchema,
  },
};

const spaceEventSchema = {
  type: "object",
  required: ["id", "eventKind", "support", "reading", "evidence"],
  additionalProperties: false,
  properties: {
    id: nonemptyStringSchema,
    eventKind: { enum: ["field", "claim", "conjecture", "theorem", "frontier"] },
    support: nonemptyStringSchema,
    reading: readingNameSchema,
    evidence: stringSequenceSchema,
  },
};

const causalLinkSchema = {
  type: "object",
  required: ["from", "to", "evidence"],
  additionalProperties: false,
  properties: {
    from: nonemptyStringSchema,
    to: nonemptyStringSchema,
    evidence: stringSequenceSchema,
  },
};

const conflictSchema = {
  type: "object",
  required: ["left", "right", "evidence"],
  additionalProperties: false,
  properties: {
    left: nonemptyStringSchema,
    right: nonemptyStringSchema,
    evidence: stringSequenceSchema,
  },
};

const spaceSchema = {
  type: "object",
  required: ["kind", "events", "causalLinks", "conflicts", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.proof-play.space" },
    events: { type: "array", items: spaceEventSchema },
    causalLinks: { type: "array", items: causalLinkSchema },
    conflicts: { type: "array", items: conflictSchema },
    evidence: stringSequenceSchema,
  },
};

const claimSchema = {
  type: "object",
  required: ["id", "support", "subject", "predicate", "orientation", "reading", "evidence"],
  additionalProperties: false,
  properties: {
    id: nonemptyStringSchema,
    support: nonemptyStringSchema,
    subject: nonemptyStringSchema,
    predicate: nonemptyStringSchema,
    orientation: { enum: ["assert", "deny", "ask", "repair"] },
    type: { type: "string" },
    proof: { type: "string" },
    reading: readingNameSchema,
    evidence: stringSequenceSchema,
  },
};

export const proofPlayReadoutSchema = {
  $id: "metroplat/monitoring/proof-play/readout",
  title: "ProofPlayReadout",
  description: "A bounded Proof-Play observation of source carriers, language fields, claims, proof status, causal support, and frontier evidence under one filesystem root.",
  type: "object",
  required: ["kind", "operation", "ground", "fields", "languageCone", "space", "claims", "conjectures", "theorems", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.proof-play.readout" },
    operation: { const: "read-proof-play" },
    ground: groundSchema,
    fields: { type: "array", items: fieldSchema },
    languageCone: languageConeSchema,
    space: spaceSchema,
    claims: { type: "array", items: claimSchema },
    conjectures: { type: "array", items: claimSchema },
    theorems: { type: "array", items: claimSchema },
    evidence: stringSequenceSchema,
  },
};

export const proofPlayReadoutContract = schemaFrom(proofPlayReadoutSchema);

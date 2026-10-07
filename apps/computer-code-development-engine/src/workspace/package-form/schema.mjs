
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const stringSchema = { type: "string", minLength: 1 };
const stringSequenceSchema = { type: "array", items: stringSchema };

export const packageFormNormalizationRequestSchema = {
  $id: "metroplat/jsnode/package-form/normalization-request",
  title: "PackageFormNormalizationRequest",
  description: "A request to normalize one package-form carrier region as JSNode package/workspace information.",
  type: "object",
  required: ["kind", "root", "from", "to"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.jsnode.package-form.normalization-request" },
    root: stringSchema,
    from: stringSchema,
    to: stringSchema,
    apply: { type: "boolean" },
    preservePublicSpecifier: {
      type: "boolean",
      description: "Keep the package export key and public package specifier stable while relocating their physical source and emitted targets.",
    },
  },
};

export const packageFormCarrierMoveSchema = {
  type: "object",
  required: ["from", "to", "status"],
  additionalProperties: false,
  properties: {
    from: stringSchema,
    to: stringSchema,
    status: { enum: ["planned", "already-moved", "missing-source", "applied"] },
    files: { type: "integer", minimum: 0 },
  },
};

export const packageFormTextRewriteSchema = {
  type: "object",
  required: ["path", "replacements"],
  additionalProperties: false,
  properties: {
    path: stringSchema,
    replacements: { type: "integer", minimum: 1 },
    reasons: stringSequenceSchema,
  },
};

export const packageFormNormalizationSchema = {
  $id: "metroplat/jsnode/package-form/normalization",
  title: "PackageFormNormalization",
  description: "Measured package-form normalization transaction: carrier moves and source-reference rewrites derived from JSNode package form.",
  type: "object",
  required: ["kind", "root", "from", "to", "applied", "carrierMove", "rewrites", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.jsnode.package-form.normalization" },
    root: stringSchema,
    from: stringSchema,
    to: stringSchema,
    applied: { type: "boolean" },
    carrierMove: packageFormCarrierMoveSchema,
    rewrites: { type: "array", items: packageFormTextRewriteSchema },
    evidence: stringSequenceSchema,
  },
};

export const packageFormNormalizationRequestContract = schemaFrom(packageFormNormalizationRequestSchema);
export const packageFormNormalizationContract = schemaFrom(packageFormNormalizationSchema);

/** Boundary contract for the live schema-conformance monitoring cut. */

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { schemaConformanceVerdictSchema } from "@red-cup-engineering/relating/carriers/schema/conformance";

export const schemaConformanceSampleCountsSchema = {
  type: "object",
  required: ["sampled", "of"],
  properties: {
    sampled: { type: "integer", minimum: 0 },
    of: { type: "integer", minimum: 0 },
  },
  additionalProperties: false,
};

export const schemaConformanceCutSchema = {
  $id: "metroplat/services/schema-conformance/read",
  title: "SchemaConformanceCut",
  description: "A per-schema-contract verdict table over explicitly monitored contracts with provenanced runtime samples: claim-session observation rows and one live glueClaimSessions result.",
  type: "object",
  required: ["kind", "operation", "date", "monitoredSchemas", "conformant", "drifted", "unexercised", "verdicts", "claimSessionRows", "liveGlue", "evidence"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.schema-conformance.read" },
    operation: { const: "read-schema-conformance" },
    date: { type: "string", minLength: 1 },
    monitoredSchemas: { type: "integer", minimum: 0 },
    conformant: { type: "integer", minimum: 0 },
    drifted: { type: "integer", minimum: 0 },
    unexercised: { type: "integer", minimum: 0 },
    verdicts: { type: "array", items: schemaConformanceVerdictSchema },
    claimSessionRows: schemaConformanceSampleCountsSchema,
    liveGlue: {
      type: "object",
      required: ["checked"],
      properties: { checked: { type: "boolean" } },
      additionalProperties: false,
    },
    evidence: { type: "array", items: { type: "string", minLength: 1 } },
  },
};

export const schemaConformanceCutContract = schemaFrom(schemaConformanceCutSchema);

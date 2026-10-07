/**
 * @packageDocumentation
 * Contracts for the checkout-health MAPE-K Monitor/Plan/Execute surface:
 * the composed checker readout, the structured-work-intent it plans, and
 * the ready-duty discharge routing.
 * @metroplatSubject monitoring
 */

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const stringSequenceSchema = { type: "array", items: { type: "string", minLength: 1 } };
const jsonValueSchema = {};

export const checkoutHealthCheckerNames = Object.freeze([
  "data-custody",
  "exact-deps",
  "lockfile-registry",
  "import-stratification",
  "builtin-imports",
  "youtube-channel-repository-form",
  "hand-registered-operations",
]);

const dataCustodyFindingSchema = {
  type: "object",
  required: ["check", "path"],
  additionalProperties: false,
  properties: {
    check: { const: "data-custody" },
    path: { type: "string", minLength: 1 },
    offenders: stringSequenceSchema,
    reason: { type: "string", minLength: 1 },
  },
};
const exactDepsFindingSchema = {
  type: "object",
  required: ["check", "path", "reason"],
  additionalProperties: false,
  properties: {
    check: { const: "exact-deps" },
    path: { type: "string", minLength: 1 },
    field: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    specification: jsonValueSchema,
    reason: { type: "string", minLength: 1 },
  },
};
const lockfileRegistryFindingSchema = {
  type: "object",
  required: ["check", "path", "reason"],
  additionalProperties: false,
  properties: {
    check: { const: "lockfile-registry" },
    path: { type: "string", minLength: 1 },
    location: { type: "string" },
    name: { type: "string" },
    resolved: { type: "string" },
    reason: { type: "string", minLength: 1 },
  },
};
const importStratificationFindingSchema = {
  type: "object",
  required: ["check", "path", "from", "to", "importerStratum", "targetStratum"],
  additionalProperties: false,
  properties: {
    check: { const: "import-stratification" },
    path: { type: "string", minLength: 1 },
    from: { type: "string", minLength: 1 },
    to: { type: "string", minLength: 1 },
    importerStratum: { type: "string", minLength: 1 },
    targetStratum: { type: "string", minLength: 1 },
  },
};
const builtinImportsFindingSchema = {
  type: "object",
  required: ["check", "path", "line", "builtin", "houseService"],
  additionalProperties: false,
  properties: {
    check: { const: "builtin-imports" },
    path: { type: "string", minLength: 1 },
    line: { type: "integer", minimum: 1 },
    builtin: { type: "string", minLength: 1 },
    houseService: { type: "string", minLength: 1 },
  },
};
const youtubeChannelRepositoryFormFindingSchema = {
  type: "object",
  required: ["check", "path", "rule", "message"],
  additionalProperties: false,
  properties: {
    check: { const: "youtube-channel-repository-form" },
    path: { type: "string", minLength: 1 },
    rule: { type: "string", minLength: 1 },
    message: { type: "string", minLength: 1 },
  },
};
const handRegisteredOperationsFindingSchema = {
  type: "object",
  required: ["check", "path", "count", "baseline", "families"],
  additionalProperties: false,
  properties: {
    check: { const: "hand-registered-operations" },
    path: { type: "string", minLength: 1 },
    count: { type: "integer", minimum: 0 },
    baseline: { type: "integer", minimum: 0 },
    families: stringSequenceSchema,
  },
};

export const checkoutHealthFindingSchema = {
  oneOf: [
    dataCustodyFindingSchema,
    exactDepsFindingSchema,
    lockfileRegistryFindingSchema,
    importStratificationFindingSchema,
    builtinImportsFindingSchema,
    youtubeChannelRepositoryFormFindingSchema,
    handRegisteredOperationsFindingSchema,
  ],
};

const checkoutFailedUnitSchema = {
  type: "object",
  required: ["host", "unit"],
  additionalProperties: false,
  properties: {
    host: { type: "string", minLength: 1 },
    unit: { type: "string", minLength: 1 },
    sub: { type: "string" },
    description: { type: "string" },
  },
};

const checkoutBoundUnitSchema = {
  type: "object",
  required: ["host", "unit", "fragmentPath", "workingDirectory", "execStart", "activeState", "subState", "allowed"],
  additionalProperties: false,
  properties: {
    host: { type: "string", minLength: 1 },
    unit: { type: "string", minLength: 1 },
    fragmentPath: { type: "string" },
    workingDirectory: { type: "string" },
    execStart: { type: "string" },
    activeState: { type: "string" },
    subState: { type: "string" },
    allowed: { type: "boolean" },
  },
};

export const checkoutHealthReadRequestSchema = {
  $id: "metroplat/monitoring/checkout-health/read-request",
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.checkout-health.read-request" },
    root: { type: "string", minLength: 1 },
    changedOnly: { type: "boolean" },
    budgetMs: { type: "integer", minimum: 1 },
    hosts: stringSequenceSchema,
    checkoutBoundUnitsAllow: stringSequenceSchema,
  },
};

export const checkoutHealthReadRequestContract = schemaFrom(checkoutHealthReadRequestSchema);

export const checkoutHealthReadSchema = {
  $id: "metroplat/monitoring/checkout-health/read",
  type: "object",
  required: [
    "kind", "checked", "violations", "truncated", "findings",
    "failedUnits", "unitsObserved", "hostsReached", "hostsUnreachable",
    "checkoutBoundUnits",
  ],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.checkout-health.read" },
    checked: { type: "integer", minimum: 0 },
    violations: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    findings: { type: "array", items: checkoutHealthFindingSchema },
    failedUnits: { type: "array", items: checkoutFailedUnitSchema },
    unitsObserved: { type: "integer", minimum: 0 },
    hostsReached: stringSequenceSchema,
    hostsUnreachable: {
      type: "array",
      items: {
        type: "object",
        required: ["host", "error"],
        additionalProperties: false,
        properties: { host: { type: "string", minLength: 1 }, error: { type: "string", minLength: 1 } },
      },
    },
    checkoutBoundUnits: { type: "array", items: checkoutBoundUnitSchema },
  },
};

export const checkoutHealthReadContract = schemaFrom(checkoutHealthReadSchema);

const workIntentChainItemSchema = {
  type: "object",
  required: ["cell", "text"],
  additionalProperties: false,
  properties: {
    cell: { type: "string", minLength: 1 },
    parent: { type: "string", minLength: 1 },
    text: { type: "string", minLength: 1 },
  },
};

export const checkoutHealthWorkIntentRequestSchema = {
  $id: "metroplat/monitoring/checkout-health/work-intent-request",
  type: "object",
  required: ["kind", "chain"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.checkout-health.work-intent-request" },
    root: { type: "string", minLength: 1 },
    changedOnly: { type: "boolean" },
    budgetMs: { type: "integer", minimum: 1 },
    hosts: stringSequenceSchema,
    checkoutBoundUnitsAllow: stringSequenceSchema,
    chain: { type: "array", minItems: 1, items: workIntentChainItemSchema },
    intentId: { type: "string", minLength: 1 },
    // The canonical work/skill every generated task declares, so allocation
    // control can staff it; no office, character or model is accepted here.
    work: { type: "string", minLength: 1 },
    skill: { type: "string", minLength: 1 },
    // A precomputed CheckoutHealthRead a caller already holds; mutually exclusive with root (handler-refused).
    health: checkoutHealthReadSchema,
  },
};

export const checkoutHealthWorkIntentRequestContract = schemaFrom(checkoutHealthWorkIntentRequestSchema);

export const checkoutHealthWorkIntentSummarySchema = {
  $id: "metroplat/monitoring/checkout-health/work-intent-summary",
  type: "object",
  required: ["kind", "checked", "violations", "admitted", "intentId", "rowsAppended", "allocated", "allocationsAppended"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.checkout-health.work-intent-summary" },
    checked: { type: "integer", minimum: 0 },
    violations: { type: "integer", minimum: 0 },
    admitted: { type: "integer", minimum: 0 },
    intentId: { type: ["string", "null"] },
    rowsAppended: { type: ["integer", "null"], minimum: 0 },
    allocated: { type: "integer", minimum: 0 },
    allocationsAppended: { type: "integer", minimum: 0 },
  },
};

export const checkoutHealthWorkIntentSummaryContract = schemaFrom(checkoutHealthWorkIntentSummarySchema);

export const readyDutiesDischargeRequestSchema = {
  $id: "metroplat/monitoring/checkout-health/ready-duties-discharge-request",
  type: "object",
  required: ["kind", "root"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.checkout-health.ready-duties-discharge-request" },
    root: { type: "string", minLength: 1 },
    apply: { type: "boolean" },
    limit: { type: "integer", minimum: 1 },
    scope: { type: "string", minLength: 1 },
    repairKind: { enum: ["exact-deps", "data-custody"] },
  },
};

export const readyDutiesDischargeRequestContract = schemaFrom(readyDutiesDischargeRequestSchema);

const dischargedDutySchema = {
  type: "object",
  required: ["scope", "status"],
  additionalProperties: false,
  properties: {
    scope: { type: "string", minLength: 1 },
    intent: { type: "string" },
    kind: { type: ["string", "null"] },
    status: { enum: ["no-repair-script", "refused", "planned", "applied", "executed-not-discharged"] },
    subjectPath: { type: "string" },
    operation: { type: "string", minLength: 1 },
    request: jsonValueSchema,
    receipt: jsonValueSchema,
    plan: jsonValueSchema,
    changedPaths: stringSequenceSchema,
    discharge: jsonValueSchema,
    admission: jsonValueSchema,
    refusal: jsonValueSchema,
    datum: jsonValueSchema,
  },
};

export const readyDutiesDischargeResultSchema = {
  $id: "metroplat/monitoring/checkout-health/ready-duties-discharge-result",
  type: "object",
  required: ["kind", "duties", "ok"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.checkout-health.duty-discharge" },
    duties: { type: "array", items: dischargedDutySchema },
    ok: { type: "boolean" },
  },
};

export const readyDutiesDischargeResultContract = schemaFrom(readyDutiesDischargeResultSchema);


import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";

const jsonValueSchema = {};
const nonemptyStringSchema = { type: "string", minLength: 1 };
const stringSequenceSchema = { type: "array", items: nonemptyStringSchema };

export const vsCodeAgentCommandRouteSchema = {
  $id: "metroplat/integrations/vscode/agent-command-route",
  title: "VSCodeAgentCommandRoute",
  description: "A VS Code agent work-surface command route projected from existing MetroPlat actions, resources, prompts, state cuts, or service functions.",
  type: "object",
  required: ["name", "route", "source", "summary", "readOnly", "writesWorkspace", "evidence"],
  properties: {
    name: nonemptyStringSchema,
    route: nonemptyStringSchema,
    source: { enum: ["action", "resource", "prompt", "state-cut", "service", "projection"] },
    packageName: nonemptyStringSchema,
    summary: nonemptyStringSchema,
    readOnly: { type: "boolean" },
    writesWorkspace: { type: "boolean" },
    evidence: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const vsCodeAgentReadinessCheckSchema = {
  $id: "metroplat/integrations/vscode/agent-readiness-check",
  title: "VSCodeAgentReadinessCheck",
  description: "One check proving whether the VS Code agent work surface currently carries a prior cockpit capability.",
  type: "object",
  required: ["id", "label", "required", "passed", "evidence", "missing"],
  properties: {
    id: nonemptyStringSchema,
    label: nonemptyStringSchema,
    required: { type: "boolean" },
    passed: { type: "boolean" },
    evidence: stringSequenceSchema,
    missing: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const vsCodeAgentContextCapsuleSchema = {
  $id: "metroplat/integrations/vscode/agent-context-capsule",
  title: "VSCodeAgentContextCapsule",
  description: "Context text suitable for a VS Code/Codex hook or extension host to inject before an agent turn.",
  type: "object",
  required: ["kind", "subject", "text", "evidence"],
  properties: {
    kind: { const: "metroplat.vscode.agent-context-capsule" },
    subject: nonemptyStringSchema,
    sessionId: nonemptyStringSchema,
    hookEventName: nonemptyStringSchema,
    text: nonemptyStringSchema,
    evidence: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const vsCodeAgentReadoutSchema = {
  $id: "metroplat/integrations/vscode/agent-readout",
  title: "VSCodeAgentReadout",
  description: "A compact readout the VS Code work surface can present as text, JSON, or notebook-style material.",
  type: "object",
  required: ["id", "title", "format", "content", "evidence"],
  properties: {
    id: nonemptyStringSchema,
    title: nonemptyStringSchema,
    format: { enum: ["text", "json", "notebook"] },
    content: nonemptyStringSchema,
    evidence: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const vsCodeAgentWorkSurfaceSchema = {
  $id: "metroplat/integrations/vscode/agent-work-surface",
  title: "VSCodeAgentWorkSurface",
  description: "The VS Code/Codex agent cockpit re-earned as an MetroPlat work surface over readiness, status cuts, hooks, work-locus governance, MCP/LSP, evidence, and readouts.",
  type: "object",
  required: [
    "kind",
    "subject",
    "commands",
    "readinessChecks",
    "context",
    "readouts",
    "priorBaseline",
    "meetsPriorBaseline",
    "missingBaseline",
    "evidence",
  ],
  properties: {
    kind: { const: "metroplat.vscode.agent-work-surface" },
    subject: nonemptyStringSchema,
    sessionId: nonemptyStringSchema,
    commands: { type: "array", items: vsCodeAgentCommandRouteSchema },
    readinessChecks: { type: "array", items: vsCodeAgentReadinessCheckSchema },
    context: vsCodeAgentContextCapsuleSchema,
    readouts: { type: "array", items: vsCodeAgentReadoutSchema },
    readiness: jsonValueSchema,
    status: jsonValueSchema,
    workLocus: jsonValueSchema,
    priorBaseline: stringSequenceSchema,
    meetsPriorBaseline: { type: "boolean" },
    missingBaseline: stringSequenceSchema,
    evidence: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const vsCodeAgentHookResponseSchema = {
  $id: "metroplat/integrations/vscode/agent-hook-response",
  title: "VSCodeAgentHookResponse",
  description: "A Codex/VS Code hook response whose additionalContext is projected from the MetroPlat VS Code agent work surface.",
  type: "object",
  required: ["kind", "hookEventName", "surface", "hookSpecificOutput", "evidence"],
  properties: {
    kind: { const: "metroplat.vscode.agent-hook-response" },
    hookEventName: nonemptyStringSchema,
    surface: vsCodeAgentWorkSurfaceSchema,
    hookSpecificOutput: {
      type: "object",
      required: ["hookEventName", "additionalContext"],
      properties: {
        hookEventName: nonemptyStringSchema,
        additionalContext: nonemptyStringSchema,
      },
      additionalProperties: false,
    },
    evidence: stringSequenceSchema,
  },
  additionalProperties: false,
};

export const vsCodeAgentCommandRouteContract = schemaFrom(vsCodeAgentCommandRouteSchema);
export const vsCodeAgentReadinessCheckContract = schemaFrom(vsCodeAgentReadinessCheckSchema);
export const vsCodeAgentContextCapsuleContract = schemaFrom(vsCodeAgentContextCapsuleSchema);
export const vsCodeAgentReadoutContract = schemaFrom(vsCodeAgentReadoutSchema);
export const vsCodeAgentWorkSurfaceContract = schemaFrom(vsCodeAgentWorkSurfaceSchema);
export const vsCodeAgentHookResponseContract = schemaFrom(vsCodeAgentHookResponseSchema);

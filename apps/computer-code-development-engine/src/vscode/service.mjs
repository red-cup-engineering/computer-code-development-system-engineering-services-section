/**
 * integrations/vscode/service — hook-facing VS Code agent context output.
 *
 * The root hook process is a host boundary. This module keeps its JSON response
 * shape inside the VS Code integration while reusing hook admission and the pure
 * work-surface projection.
 *
 * @packageDocumentation
 */
import { admitHookEnvelope, isHookEnvelope } from "@red-cup-engineering/agent-harness-computer-system-engineering-services-section/hooks/codec";

import {
  vsCodeAgentWorkSurface,

} from "./work-surface.mjs";
import {
  vsCodeAgentHookResponseContract,

} from "@red-cup-engineering/computer-code-development-engine/vscode/schema";

const DEFAULT_CONTEXT_HOOK_EVENTS = Object.freeze(["SessionStart", "UserPromptSubmit"]);
const DEFAULT_MAX_ADDITIONAL_CONTEXT_BYTES = 3500;

function hookEventName(payload) {
  const admitted = admitHookEnvelope(payload);
  if (isHookEnvelope(admitted)) return admitted.hookEventName;
  return undefined;
}

function truncateUtf8(text, maxBytes) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return text;
  let out = text;
  while (Buffer.byteLength(`${out}\n...(truncated)`, "utf8") > maxBytes && out.length > 0) {
    out = out.slice(0, Math.max(0, out.length - 64));
  }
  return `${out}\n...(truncated)`;
}

function surfaceFromEnvelope(envelope, options) {
  return vsCodeAgentWorkSurface({
    ...options,
    subject: options.subject ?? "VS Code Codex agent work surface",
    ...(envelope.sessionId === undefined ? {} : { sessionId: envelope.sessionId }),
    hookEventName: envelope.hookEventName,
    evidence: Object.freeze([
      "src/integrations/vscode/service:vsCodeAgentHookResponse",
      "src/integrations/hooks/codec:admitHookEnvelope",
      ...(options.evidence ?? []),
    ]),
  });
}

/** Project one hook payload into Codex's hookSpecificOutput shape.
 *
 * Returns `undefined` for malformed payloads and for hook events not intended to
 * inject context. Admission failures stay quiet because the hook process should
 * not interrupt the user's editor session.
 */
export function vsCodeAgentHookResponse(
  payload,
  options = {},
) {
  const admitted = admitHookEnvelope(payload);
  if (!isHookEnvelope(admitted)) return undefined;
  const allowed = options.allowedHookEvents ?? DEFAULT_CONTEXT_HOOK_EVENTS;
  if (!allowed.includes(admitted.hookEventName)) return undefined;
  const surface = surfaceFromEnvelope(admitted, options);
  const maxBytes = options.maxAdditionalContextBytes ?? DEFAULT_MAX_ADDITIONAL_CONTEXT_BYTES;
  const additionalContext = truncateUtf8(surface.context.text, maxBytes);
  return vsCodeAgentHookResponseContract.assert(Object.freeze({
    kind: "metroplat.vscode.agent-hook-response",
    hookEventName: admitted.hookEventName,
    surface,
    hookSpecificOutput: Object.freeze({
      hookEventName: admitted.hookEventName,
      additionalContext,
    }),
    evidence: Object.freeze([
      "src/integrations/vscode/service:vsCodeAgentHookResponse",
      "src/integrations/vscode:vsCodeAgentWorkSurface",
    ]),
  }), "VS Code agent hook response");
}

/** JSON text for the hook process. Empty string means "no context injection". */
export function vsCodeAgentHookResponseText(
  payload,
  options = {},
) {
  const response = vsCodeAgentHookResponse(payload, options);
  return response === undefined ? "" : `${JSON.stringify({ hookSpecificOutput: response.hookSpecificOutput })}\n`;
}

export const vsCodeAgentHookEventName = hookEventName;

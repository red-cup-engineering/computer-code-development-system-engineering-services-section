/**
 * knowledge-delivery — composes KE's finding-delivery policy over this node's live findings and
 * this process's memory of which (session, file) pairs it has already gated, to answer a Claude
 * Code PreToolUse Read.
 *
 * The gated-file memory is in-process, bounded, and lost on restart. That is deliberate: the node
 * server answers every hook event for every session, so losing this soft state on restart costs at
 * most one extra gate per (session, file) pair the next time it comes up — never a wrong answer,
 * since the policy itself (KE `readDeliveryOf`) is pure and re-decides from the live findings each
 * time. Nothing here needs to survive a restart to stay correct.
 */
import { findingAddressOf, readFindingsOfFile, textFindingSource } from "./anchored-findings.mjs";
import { readDeliveryOf } from "./finding-delivery.mjs";

const GATED_MEMORY_LIMIT = 50_000;
/** (session, file) pairs this process has already gated, oldest first: a bounded LRU so a long-
 *  lived node never grows this without limit. */
const gated = new Map();

function gatedKey(sessionId, file) {
  return `${sessionId}\u0000${file}`;
}

function wasGatedBefore(sessionId, file) {
  return gated.has(gatedKey(sessionId, file));
}

function rememberGated(sessionId, file) {
  const key = gatedKey(sessionId, file);
  gated.delete(key); // re-insert to mark most-recently-used
  gated.set(key, true);
  if (gated.size > GATED_MEMORY_LIMIT) gated.delete(gated.keys().next().value);
}

/** The fleet's live findings about the house file a Read is about to load, as a PreToolUse answer:
 *  a deny that returns the card(s) in place of a large whole-file Read this session has not been
 *  gated on yet, or nothing when the file should be read directly. */
export function readKnowledgeOf(binding, payload) {
  const file = payload?.tool_input?.file_path;
  if (payload?.tool_name !== "Read" || typeof file !== "string") return undefined;
  const root = binding.root;
  const sessionId = payload.session_id;
  let known;
  let source;
  try {
    source = textFindingSource(root, findingAddressOf(root, file));
    if (source === undefined) return undefined;
    known = readFindingsOfFile({ root, dataRoot: binding.dataRoot }, file);
  } catch {
    return undefined;
  }
  const delivery = readDeliveryOf({
    toolInput: payload.tool_input,
    sessionId,
    characters: source.bytes.length,
    known,
    gatedBefore: typeof sessionId === "string" && wasGatedBefore(sessionId, file),
  });
  if (delivery.kind === "none") return undefined;
  if (typeof sessionId === "string") rememberGated(sessionId, file);
  return Object.freeze({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: delivery.text },
  });
}

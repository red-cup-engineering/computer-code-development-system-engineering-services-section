/**
 * Physical host admission for native source reads. The owning runtime supplies
 * authenticated original-effect context and the installed executor transport.
 * No RPC field grants custody, conformance, capacity or a filesystem fallback.
 */
import { types } from "node:util";
const verbs = new Set(["workspace-file-window", "workspace-file-slice", "workspace-text-search"]);
const keys = new Set(["duty", "scope", "path", "id", "startLine", "lineCount", "query", "pathPrefix", "limit", "maxFileBytes", "byteOffset", "byteCount", "expected"]);
const refusal = reason => Object.freeze({kind:"workspace.read:obstruction", reason});
const fields = ["id", "actor", "session", "office", "subject"];
const scopes = new Set(["repository", "package", "data"]);
function requestOf(input) {
  if (!input || typeof input !== "object" || types.isProxy(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const record = Object.create(null);
  if (Reflect.ownKeys(descriptors).length > keys.size) return undefined;
  for (const key of Reflect.ownKeys(descriptors)) {
    const d = descriptors[key];
    if (typeof key !== "string" || !keys.has(key) || !Object.hasOwn(d, "value")) return undefined;
    const v = d.value;
    if (typeof v === "string") {
      if (v.length > (key === "query" ? 1024 : 512) || v.includes("\0")) return undefined;
    } else if (!Number.isSafeInteger(v) || v < 0) return undefined;
    record[key] = v;
  }
  if (record.scope !== undefined && !scopes.has(record.scope)) return undefined;
  return Object.freeze(record);
}
function resultOf(receipt) {
  if (receipt?.terminated !== true) return undefined;
  if (Object.hasOwn(receipt, "result")) return receipt.result;
  if (receipt.reason !== undefined || receipt.exit?.code !== 0
    || typeof receipt.output !== "string" || Buffer.byteLength(receipt.output) > 65536) return undefined;
  try { return JSON.parse(receipt.output); } catch { return undefined; }
}
export function createWorkspaceSourceResource(binding) {
  const execute = typeof binding?.execute === "function" ? binding.execute.bind(binding) : undefined;
  const context = typeof binding?.context === "function" ? binding.context.bind(binding) : undefined;
  return Object.freeze({async read(operation, input, execution) {
    if (!verbs.has(operation)) return refusal("unknown-source-operation");
    const record = requestOf(input);
    if (!record) return refusal("finite-source-request-required");
    if (!execute || !context) return refusal("physical-host-source-resource-unavailable");
    const identity = await context(operation, record, execution);
    if (!identity || types.isProxy(identity)) return refusal("original-effect-context-unavailable");
    const descriptors = Object.getOwnPropertyDescriptors(identity);
    const original = Object.create(null);
    for (const key of fields) {
      const d = descriptors[key];
      if (!d || !Object.hasOwn(d, "value") || typeof d.value !== "string"
        || !d.value || d.value.length > 2048) return refusal("original-effect-context-unavailable");
      original[key] = d.value;
    }
    const wire = JSON.stringify({...original, operation, input:record});
    if (Buffer.byteLength(wire) > 65536) return refusal("finite-source-request-required");
    const outcome = await execute(wire);
    if (outcome?.kind === "host-resource.received" && outcome.id === original.id
      && outcome.receipt?.id === original.id && outcome.receipt.terminated === true
      && resultOf(outcome.receipt) !== undefined) return resultOf(outcome.receipt);
    if (outcome?.kind === "host-resource.existing" && outcome.effect?.request?.id === original.id
      && outcome.effect.status === "received" && outcome.effect.receipt?.id === original.id
      && outcome.effect.receipt.terminated === true && resultOf(outcome.effect.receipt) !== undefined)
      return resultOf(outcome.effect.receipt);
    return Object.freeze({kind:"workspace.read:obstruction",
      reason:outcome?.reason ?? "source-effect-awaiting-receipt", original:original.id});
  }});
}

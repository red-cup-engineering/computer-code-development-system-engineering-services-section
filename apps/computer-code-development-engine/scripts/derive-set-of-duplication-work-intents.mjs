#!/usr/bin/env node
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

const DEFAULT_LIMIT = 25;
const NOW_CONSUMER_THRESHOLD = 8;
const CHAIN_SOURCE_ID = "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS";

function fingerprintPrefix(fingerprint) {
  return fingerprint.slice(0, 12);
}

function firstStepFor(plan, resolvedOwner) {
  if (plan) {
    const republish = Array.isArray(plan.refusals) ? plan.refusals.find((r) => r.reason === "owner-republish-required") : undefined;
    if (republish) {
      const name = plan.ownerExport?.name ?? "the primitive";
      return `publish \`${plan.owner ?? resolvedOwner}\` exporting \`${name}\`, then apply the plan`;
    }
    if (Array.isArray(plan.refusals) && plan.refusals.length > 0) {
      return plan.refusals.map((r) => `${r.reason}: ${r.detail}`).join("; ");
    }
    return "apply the plan (`jsnode-computer duplication-migration --apply`)";
  }
  if (resolvedOwner) return `seat the migration plan for \`${resolvedOwner}\``;
  return "no owner: seat one in the section that owns the primitive";
}

function chainToItems(chain) {
  return chain.map((item) => ({
    cell: item.cell,
    ...(item.parent ? { parent: item.parent } : {}),
    text: item.text,
    evidence: [`chain item admitted verbatim from CHAIN_ITEMS: ${item.text}`],
    provenance: [{ source: CHAIN_SOURCE_ID, evidence: [item.text] }],
  }));
}

function taskItemFor(candidate, plan, planCell) {
  const fingerprint = candidate.semanticFingerprint;
  const fp = fingerprintPrefix(fingerprint);
  const name = candidate.implementations?.[0]?.name ?? "(unnamed)";
  const resolvedOwner = plan?.owner ?? candidate.owner;
  const ownerText = resolvedOwner ? `\`${resolvedOwner}\`` : "no owner: seat one in the section that owns the primitive";
  const consumerCount = Array.isArray(candidate.consumers) ? candidate.consumers.length : 0;
  const horizon = consumerCount >= NOW_CONSUMER_THRESHOLD ? "now" : "soon";
  const removableBytes = candidate.removableBytes ?? 0;
  const text =
    `${name} copied in ${candidate.packages.join(", ")} with ${consumerCount} consumers, removable ${removableBytes} bytes. ` +
    `owner=${ownerText}. first step: ${firstStepFor(plan, resolvedOwner)}. ` +
    "gate: the plan applies (`jsnode-computer duplication-migration --apply`), the consumers' tests pass, the owner is published, " +
    `and \`jsnode_duplication\` no longer lists \`${fp}\`. ` +
    `modality=MUST force=necessary horizon=${horizon}`;
  const provenance = [{ source: `jsnode_duplication#${fingerprint}`, evidence: [`removableBytes=${removableBytes}`, `consumers=${consumerCount}`] }];
  if (plan) {
    provenance.push({
      source: `jsnode.duplication-migration.plan#${fingerprint}`,
      evidence: (plan.refusals ?? []).map((r) => `${r.reason}: ${r.detail}`).length > 0 ? (plan.refusals ?? []).map((r) => `${r.reason}: ${r.detail}`) : ["applicable"],
    });
  }
  return {
    cell: `task:migrate-consumer-${fp}`,
    parent: planCell,
    text,
    evidence: [`${consumerCount} consumers`, `removableBytes=${removableBytes}`],
    provenance,
  };
}

/**
 * Turns the duplication graph's cross-package, consumer-backed candidates into structured work intents, one per candidate, so consolidation is dispatched by the platform and never by a session's own reading.
 * @param {object} request A record with `candidates` (the `jsnode_duplication` readout's candidates array), `plans` (optional array of `jsnode.duplication-migration.plan` records keyed by `candidate.semanticFingerprint`), `chain` (exactly four admitted chain items: endeavor, campaign, project, plan), `limit` (optional, default 25), and `derivedAt` (optional ISO-8601 string; defaults to the operation's own wall clock, letting a caller pin it for deterministic examples and tests).
 * @returns {object} A `DuplicationWorkIntentSet`: `type`, `version: 1`, `derivedAt`, `considered`, `skippedSinglePackage`, `intents` (array of `metroplat.work.structured-intent` inputs).
 * @throws {TypeError} When `candidates` is not an array, `chain` is not an array of four items, or a `plans` entry lacks `candidate.semanticFingerprint`.
 */
export function deriveSetOfDuplicationWorkIntents(request) {
  if (!Array.isArray(request?.candidates)) throw new TypeError("candidates must be an array");
  if (!Array.isArray(request?.chain) || request.chain.length !== 4) {
    throw new TypeError("chain must carry exactly four items: endeavor, campaign, project, plan");
  }
  const plans = request.plans ?? [];
  if (!Array.isArray(plans)) throw new TypeError("plans must be an array");
  const planByFingerprint = new Map();
  for (const plan of plans) {
    const fingerprint = plan?.candidate?.semanticFingerprint;
    if (typeof fingerprint !== "string" || fingerprint.length === 0) {
      throw new TypeError("a plans entry lacks candidate.semanticFingerprint");
    }
    planByFingerprint.set(fingerprint, plan);
  }

  const limit = Number.isInteger(request.limit) && request.limit > 0 ? request.limit : DEFAULT_LIMIT;
  const derivedAt = typeof request.derivedAt === "string" && request.derivedAt.length > 0 ? request.derivedAt : new Date().toISOString();
  const chainItems = chainToItems(request.chain);
  const planCell = request.chain[3].cell;

  let skippedSinglePackage = 0;
  const intents = [];
  for (const candidate of request.candidates) {
    if (!Array.isArray(candidate?.packages) || candidate.packages.length < 2) {
      skippedSinglePackage += 1;
      continue;
    }
    if (intents.length >= limit) continue;
    const plan = planByFingerprint.get(candidate.semanticFingerprint);
    const fp = fingerprintPrefix(candidate.semanticFingerprint);
    const task = taskItemFor(candidate, plan, planCell);
    const candidateSourceId = `jsnode_duplication#${candidate.semanticFingerprint}`;
    const sources = [
      { id: CHAIN_SOURCE_ID, kind: "chain-items-source", locator: CHAIN_SOURCE_ID },
      { id: candidateSourceId, kind: "jsnode-duplication-candidate", locator: candidateSourceId },
    ];
    if (plan) {
      const planSourceId = `jsnode.duplication-migration.plan#${candidate.semanticFingerprint}`;
      sources.push({ id: planSourceId, kind: "jsnode-duplication-migration-plan", locator: planSourceId });
    }
    intents.push({
      kind: "metroplat.work.structured-intent",
      id: `swi:${derivedAt.slice(0, 10)}:migrate-${fp}`,
      producer: { id: "derive-set-of-duplication-work-intents", revision: "0.1.1" },
      sources,
      items: [...chainItems, task],
    });
  }

  return {
    type: "DuplicationWorkIntentSet",
    version: 1,
    derivedAt,
    considered: request.candidates.length,
    skippedSinglePackage,
    intents,
  };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "derive-set-of-duplication-work-intents", description: "Turns the duplication graph's cross-package, consumer-backed candidates into structured work intents, one per candidate, so consolidation is dispatched by the platform and never by a session's own reading.", operation: deriveSetOfDuplicationWorkIntents }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}

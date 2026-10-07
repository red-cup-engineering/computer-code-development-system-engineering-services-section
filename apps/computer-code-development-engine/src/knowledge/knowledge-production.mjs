/**
 * Knowledge production: the fleet's read demand turned into anchored findings by the inference market's models.
 *
 * Each run folds the harness's own Read events over the last days into demand, takes the files
 * reused across sessions that no live finding describes, and places one
 * finding work order per file with the inference market. A candidate is admitted
 * only past the grounding assay, anchored to the blob it was learned from, with the provider and
 * model as its producer; the market hears the receiver's outcome either way, so routing learns
 * whose findings the fleet accepts. The expensive agents then read findings instead of files.
 */
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { readFileSync } from "node:fs";
import { hookReadDemand } from "@red-cup-engineering/agent-harness-computer-system-engineering-services-section/hooks/read-demand";
import { admitAnchoredFinding, knowledgeDemand } from "@red-cup-engineering/computer-code-development-engine/knowledge/anchored-findings";
import { assayFindingCandidate, findingWorkOf } from "@red-cup-engineering/computer-code-development-engine/knowledge/finding-production";
import { dispatchInference, recordInferenceOutcome } from "@red-cup-engineering/computer-inference-engine/dispatch/inference-dispatch";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import path from "node:path";
import { expectedResolutionPricingRoot, refusedInferenceOffers } from "@red-cup-engineering/computer-inference-engine/dispatch/expected-resolution-pricing-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const DELIVERED = "candidate-pending-customer-acceptance";
/** How many deliveries one address' customer walks the market for before giving up on it for this
 *  run: a refusal names the offer that made it, so the next attempt excludes it and asks the market
 *  for another -- the walk this run report shows -- rather than the run stopping at its first no. */
const MAX_OFFERS_PER_FINDING = 3;
const findingPolicy = artifactId({
  production: readFileSync(new URL("./finding-production.mjs", import.meta.url), "utf8"),
  admission: readFileSync(new URL("./anchored-findings.mjs", import.meta.url), "utf8"),
});
const findingWorkLotId = (work) => `urn:work-lot:inference:${artifactId({ kind: "knowledge-finding-work", request: work.request, findingPolicy }).split(";")[1]}`;

/** The ISO dates of the `days` days ending at `at`. */
const datesBack = (at, days) => Array.from({ length: days }, (_, back) => new Date(Date.parse(at) - back * DAY_MS).toISOString().slice(0, 10));

const reasonOf = (error) => (error instanceof Error ? error.message : String(error));

/** Tell the market how the receiver took one delivery; without a pricing root there is no market book. */
async function recordOutcome(record, pricingRoot, delivered, accepted, evidence) {
  if (!pricingRoot) return false;
  await record({
    workLot: delivered.workLot,
    provider: delivered.provider,
    taskClass: delivered.taskClass,
    selectedOffer: delivered.selectedOffer,
    receipt: delivered.receipt?.id,
    receiver: delivered.receiver,
    outcome: accepted ? "accepted" : "refused",
    evidence,
    ...(delivered.configurationIdentity ? { configurationIdentity: delivered.configurationIdentity } : {}),
    ...(Number.isSafeInteger(delivered.durationMs) ? { durationMs: delivered.durationMs } : {}),
    ...(delivered.measuredResources?.resources ? { resources: delivered.measuredResources.resources } : {}),
  }, { pricingRoot });
  return true;
}

/** `recordOutcome`, its own failure kept as the receipt rather than thrown: a book that cannot be
 *  written must not stop the run from moving on to the next attempt or address. */
async function settleDelivery(record, pricingRoot, delivered, accepted, evidence) {
  try {
    return await recordOutcome(record, pricingRoot, delivered, accepted, evidence);
  } catch (error) {
    return reasonOf(error);
  }
}

/**
 * One production run: at most `limit` findings for the demand of the last `days` days, placed one
 * at a time, since provider quotas are per minute, within `budgetSeconds` of wall time: the clock
 * starts no second run while one holds its schedule, so a run that outlasts its budget aborts the
 * placement in flight and leaves the rest as demand for the next run. Returns what each demanded
 * address came to.
 */
export async function produceKnowledge(binding, { days = 7, limit = 4, budgetSeconds = 60 } = {}, {
  dispatch = dispatchInference,
  record = recordInferenceOutcome,
  environment = process.env,
} = {}) {
  const at = binding.now();
  const root = binding.repositoryRoot ?? environment.CODE_KNOWLEDGE_REPOSITORY_ROOT;
  if (typeof root !== "string" || root.length === 0) throw new TypeError("CODE_KNOWLEDGE_REPOSITORY_ROOT is required");
  const place = { root, dataRoot: binding.dataRoot };
  const reads = hookReadDemand(binding.dataRoot, datesBack(at, days));
  const demand = knowledgeDemand(place, reads, { limit });
  const pricingRoot = environment.EXPECTED_RESOLUTION_PRICING_ROOT ?? expectedResolutionPricingRoot(path.join(binding.dataRoot, "data"));
  const produced = [];
  const deadline = AbortSignal.timeout(budgetSeconds * 1000);
  for (const want of demand) {
    if (deadline.aborted) { produced.push({ ...want, outcome: "deferred", reason: `the run spent its ${budgetSeconds}s budget` }); continue; }
    const work = findingWorkOf(place, want.address);
    if (work === undefined) { produced.push({ ...want, outcome: "not-placeable" }); continue; }
    // A customer that assays a delivery and refuses it walks the market for another offer, naming
    // every offer already tried so the market does not deliver the same refused candidate twice.
    const workLotId = findingWorkLotId(work);
    const excludedOffers = pricingRoot
      ? await refusedInferenceOffers(pricingRoot, workLotId, work.request.taskClass)
      : [];
    const attempts = [];
    let settled;
    for (let attempt = 1; attempt <= MAX_OFFERS_PER_FINDING && !deadline.aborted; attempt += 1) {
      let delivered;
      try {
        delivered = await dispatch({
          ...work.request,
          workLotId,
          ...(excludedOffers.length === 0 ? {} : { workPlacement: { excludedOffers } }),
        }, { ...(pricingRoot ? { pricingRoot } : {}), signal: deadline });
      } catch (error) {
        settled = { outcome: "dispatch-error", reason: reasonOf(error) };
        break;
      }
      if (delivered.outcome !== DELIVERED) {
        // The market already fell through every offer it had for this address; walking further
        // would only repeat the same transport refusal, not reach a stronger model.
        const refusals = (delivered.directLaneRefusals ?? []).map((refusal) => `${String(refusal.provider).split(":").at(-1)}: ${refusal.reason}`);
        settled = { outcome: delivered.outcome, reason: [delivered.reason ?? delivered.disposition, ...refusals].filter(Boolean).join("; ") };
        break;
      }
      const producer = { agent: delivered.provider, model: delivered.model, work: delivered.workLot };
      const assay = assayFindingCandidate(work, delivered.candidate);
      let admission;
      let refusal = assay.reasons.join("; ");
      if (assay.accepted) {
        try {
          admission = admitAnchoredFinding(place, { address: work.address, claim: assay.claim, anchors: [work.anchor], producer }, binding.now());
        } catch (error) {
          refusal = reasonOf(error);
        }
      }
      const accepted = admission !== undefined;
      // Unique per attempt: the book binds each piece of evidence to one outcome, and a walked
      // address makes several refused deliveries that would otherwise share one evidence string.
      const evidence = accepted
        ? `anchored finding ${admission.finding.id}`
        : `${work.address}@${work.blob} attempt ${attempt} (${delivered.selectedOffer}): ${refusal}`;
      const outcomeRecorded = await settleDelivery(record, pricingRoot, delivered, accepted, evidence);
      attempts.push(Object.freeze({
        attempt,
        offer: delivered.selectedOffer,
        producer,
        outcome: accepted ? "admitted" : "refused",
        ...(accepted ? { finding: admission.finding.id } : { reason: refusal, candidate: assay.claim }),
        outcomeRecorded,
      }));
      settled = accepted
        ? { outcome: "admitted", producer, finding: admission.finding.id, outcomeRecorded }
        : { outcome: "refused", producer, reason: refusal, candidate: assay.claim, outcomeRecorded };
      if (accepted) break;
      if (typeof delivered.selectedOffer === "string") excludedOffers.push(delivered.selectedOffer);
    }
    produced.push({ ...want, ...settled, ...(attempts.length === 0 ? {} : { attempts: Object.freeze(attempts) }) });
  }
  return Object.freeze({
    kind: "knowledge.production-run",
    at,
    window: Object.freeze({ days, filesRead: reads.length, sessionsReading: reads.reduce((sum, read) => sum + read.sessions, 0) }),
    demand: demand.length,
    admitted: produced.filter((entry) => entry.outcome === "admitted").length,
    produced: Object.freeze(produced.map((entry) => Object.freeze(entry))),
  });
}

/** The node's knowledge production, run on its clock. */
export function knowledgeProductionOperations(binding) {
  return Object.freeze([operation({
    verb: "knowledge-produce", inputFormat: "json", outputFormat: "json",
    summary: "Produce anchored findings for the files the fleet reads most and knows least.",
    description: "Folds the last days of harness Read events into demand, places one finding work order per undescribed file, admits candidates that pass the grounding assay, and records each outcome with the inference market.",
    reads: ["admit-arrival", "anchored-findings", "CODE_KNOWLEDGE_REPOSITORY_ROOT", "EXPECTED_RESOLUTION_PRICING_ROOT"],
    writes: ["anchored-findings", "inference-outcomes"],
    effects: { class: "journal-write", replay: "idempotency-key", coordination: "coordination-free", deterministic: "unmeasured", totality: "partial" },
    run: (input) => produceKnowledge(binding, input ?? {}),
  })]);
}

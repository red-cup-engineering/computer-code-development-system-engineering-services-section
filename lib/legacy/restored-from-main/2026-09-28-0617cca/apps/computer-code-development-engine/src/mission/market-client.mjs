import { INFERENCE_WORK_CUSTOMER, dispatchInferenceAsConfiguredCustomer } from "@red-cup-engineering/computer-inference-engine/dispatch/inference-dispatch";

const ACTOR = "urn:ame:computer-code-development-engine";
const PROFILE = Object.freeze({
  customer: ACTOR,
  purpose: "Produce the next software-mission transition without mutating customer territory or claiming customer acceptance.",
  desiredUse: "Return one advisory transition for isolated receiver verification.",
});
export const fabricDefaults = Object.freeze({
  customer: ACTOR,
  market: "urn:ame:inference-work-lot-service",
  selectionOwner: "urn:ame:inference-work-lot-service",
  acceptanceOwner: ACTOR,
  carrier: ["semantic-content", "semantic-record-journal"],
});

export function inferenceWorkRequest(job, { customerActor = INFERENCE_WORK_CUSTOMER } = {}) {
  if (!job || typeof job !== "object" || typeof job.id !== "string" || job.id === "") throw new Error("inference job requires one stable id");
  const hasContext = typeof job.context === "string" && job.context.length > 0;
  const hasContextPacket = job.contextPacket !== undefined && job.contextPacket !== null;
  if (hasContext === hasContextPacket) throw new Error("inference job requires exactly one context string or canonical contextPacket");
  const body = {
    workLotId: job.id,
    objective: job.objective ?? [...(job.messages ?? [])].reverse().find(({ role }) => role === "user")?.content ?? `Complete ${job.id}`,
    ...(hasContext ? { context: job.context } : { contextPacket: job.contextPacket }),
    desiredUse: PROFILE.desiredUse,
    workType: job.workType ?? "inquiry",
    taskClass: job.taskClass ?? job.workType ?? "inquiry",
    requiredCapabilities: job.requiredCapabilities ?? [],
    outputSchema: job.outputSchema ?? null,
    excludeProviders: job.excludeProviders ?? [],
    customer: customerActor,
  };
  if (job.considerationPolicy !== undefined) body.considerationPolicy = job.considerationPolicy;
  return Object.freeze(body);
}

export async function dispatchBatch(jobs, { procureInferenceWorkBatch, signal, customerActor = INFERENCE_WORK_CUSTOMER } = {}) {
  if (signal?.aborted) { const error = new Error(typeof signal.reason === "string" ? signal.reason : "inference procurement aborted"); error.name = "AbortError"; throw error; }
  if (!Array.isArray(jobs) || jobs.length === 0) return [];
  const requests = jobs.map((job) => ({ job, request: inferenceWorkRequest(job, { customerActor }) }));
  if (typeof procureInferenceWorkBatch === "function") return procureInferenceWorkBatch(requests.map(({ request }) => request), { signal, customer: customerActor });
  return Promise.all(requests.map(async ({ job, request }) => {
    const result = await dispatchInferenceAsConfiguredCustomer(request, { customerActor, signal });
    const candidate = result.candidate;
    return {
      id: job.id,
      text: typeof candidate === "string" ? candidate : candidate === undefined ? "" : JSON.stringify(candidate),
      attempts: result.attempts ?? [],
      provider: result.provider ?? null,
      endpoint: result.endpoint ?? null,
      model: result.model ?? null,
      cost: result.consideration ?? null,
      procurement: result,
      ...(result.outcome?.startsWith("candidate-pending-") ? {} : { refusal: result }),
    };
  }));
}

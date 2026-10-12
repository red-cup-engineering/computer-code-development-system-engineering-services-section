import assert from "node:assert/strict";
import test from "node:test";
import { admitInferenceWorkRequest } from "@red-cup-engineering/computer-inference-engine/dispatch/carriers";
import { dispatchBatch, fabricDefaults, inferenceWorkRequest } from "../../src/mission/market-client.mjs";

const job = {
  id: "urn:test:fabric:bounded",
  objective: "Return one bounded candidate.",
  context: "Return one bounded candidate with the admitted action schema.",
  workType: "software-engineering",
  taskClass: "software-engineering",
  requiredCapabilities: ["software-engineering", "json-schema-output"],
  outputSchema: { type: "object", required: ["action"] },
};

test("typed procurement dispatch stops before any market act when its circuit is aborted", async () => {
  const controller = new AbortController();
  controller.abort("customer withdrew the bounded grant");
  await assert.rejects(dispatchBatch([job], { signal: controller.signal }), (error) => error.name === "AbortError" && /withdrew/u.test(error.message));
});

test("the mission service keeps customer selection and acceptance separate", () => {
  assert.equal(fabricDefaults.customer, "urn:ame:computer-code-development-engine");
  assert.equal(fabricDefaults.market, "urn:ame:inference-work-lot-service");
  assert.equal(fabricDefaults.selectionOwner, "urn:ame:inference-work-lot-service");
  assert.equal(fabricDefaults.acceptanceOwner, fabricDefaults.customer);
  assert.deepEqual(fabricDefaults.carrier, ["semantic-content", "semantic-record-journal"]);
});

test("one job becomes one context-complete dispatcher request", () => {
  const request = inferenceWorkRequest({ ...job, excludeProviders: ["urn:ame:prior-author"] }, { customerActor: "urn:test:customer" });
  assert.equal(request.workLotId, job.id);
  assert.equal(request.objective, job.objective);
  assert.equal(request.context, job.context);
  assert.deepEqual(request.outputSchema, job.outputSchema);
  assert.deepEqual(request.excludeProviders, ["urn:ame:prior-author"]);
  assert.equal(request.customer, "urn:test:customer");
  assert.deepEqual(admitInferenceWorkRequest(request), request);
});

test("a request refuses without exactly one admitted context representation", () => {
  const { context, ...withoutContext } = job;
  assert.throws(() => inferenceWorkRequest(withoutContext), /exactly one context/u);
  assert.throws(() => inferenceWorkRequest({ ...job, contextPacket: {} }), /exactly one context/u);
});

test("the caller-supplied dispatcher receives the exact current request without acceptance", async () => {
  let received;
  const [result] = await dispatchBatch([job], {
    customerActor: "urn:test:customer",
    procureInferenceWorkBatch: async (requests, options) => {
      received = { requests, options };
      return [{ id: job.id, outcome: "candidate-pending-codex-acceptance" }];
    },
  });
  assert.equal(received.requests.length, 1);
  assert.equal(received.requests[0].context, job.context);
  assert.equal(received.options.customer, received.requests[0].customer);
  assert.equal(result.outcome, "candidate-pending-codex-acceptance");
});

import assert from "node:assert/strict";
import test from "node:test";
import { deriveSetOfDuplicationWorkIntents } from "../scripts/derive-set-of-duplication-work-intents.mjs";

const chain = [
  { cell: "endeavor:ops-561-group", text: "ops.561.group: the ERP/ICS control plane for agents and humans." },
  { cell: "campaign:internal-compute-market", parent: "endeavor:ops-561-group", text: "Sell every compute on the internal market." },
  { cell: "project:core-stability", parent: "campaign:internal-compute-market", text: "Get the core stable." },
  { cell: "plan:2026-09-03-core-stability", parent: "project:core-stability", text: "This week's plan." },
];

test("one cross-package candidate with an owner-republish plan, one single-package candidate skipped", () => {
  const candidates = [
    {
      semanticFingerprint: "c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2",
      implementations: [{ name: "praxisFeedbackInterpretation" }],
      packages: ["@red-cup-engineering/agentic-knowledge-engine", "@red-cup-engineering/metroplat"],
      consumers: ["a", "b", "c", "d", "e", "f", "g", "h"],
      removableBytes: 2119,
      owner: "@red-cup-engineering/agentic-knowledge-engine",
    },
    { semanticFingerprint: "solo", implementations: [{ name: "soloFn" }], packages: ["@red-cup-engineering/solo"], consumers: [], removableBytes: 40 },
  ];
  const plans = [
    {
      candidate: { semanticFingerprint: "c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2" },
      owner: "@red-cup-engineering/agentic-knowledge-engine",
      ownerExport: { name: "praxisFeedbackInterpretation" },
      refusals: [{ reason: "owner-republish-required", detail: "@red-cup-engineering/agentic-knowledge-engine's published 0.1.2 does not yet export \"praxisFeedbackInterpretation\" — publish it, then re-run" }],
    },
  ];
  const result = deriveSetOfDuplicationWorkIntents({ candidates, plans, chain });
  assert.equal(result.considered, 2);
  assert.equal(result.skippedSinglePackage, 1);
  assert.equal(result.intents.length, 1);
  const task = result.intents[0].items.at(-1);
  assert.equal(task.cell, "task:migrate-consumer-c5d74f3ac47b");
  assert.match(task.text, /first step: publish `@red-cup-engineering\/knowing` exporting `praxisFeedbackInterpretation`, then apply the plan/u);
  assert.match(task.text, /horizon=now/u);
  assert.equal(result.intents[0].items.length, 5);
});

test("a cross-package candidate with no owner and no plan names the seating step", () => {
  const candidates = [
    {
      semanticFingerprint: "76e3da02245aeabe5ae7efe2e73e367235373a94c49401901b070ea63a0d224d",
      implementations: [{ name: "usage" }],
      packages: ["@red-cup-engineering/agentic-computation-engine", "@red-cup-engineering/youtube-channel-production-services-section"],
      consumers: ["x", "y", "z"],
      removableBytes: 1214,
      owner: null,
    },
  ];
  const result = deriveSetOfDuplicationWorkIntents({ candidates, plans: [], chain });
  assert.equal(result.intents.length, 1);
  const task = result.intents[0].items.at(-1);
  assert.match(task.text, /owner=no owner: seat one in the section that owns the primitive/u);
  assert.match(task.text, /first step: no owner: seat one in the section that owns the primitive/u);
  assert.match(task.text, /horizon=soon/u);
});

test("refuses a chain of three items", () => {
  const candidates = [{ semanticFingerprint: "fp", implementations: [{ name: "fn" }], packages: ["a", "b"], consumers: [] }];
  assert.throws(() => deriveSetOfDuplicationWorkIntents({ candidates, chain: chain.slice(0, 3) }), /exactly four items/u);
});

test("refuses non-array candidates", () => {
  assert.throws(() => deriveSetOfDuplicationWorkIntents({ candidates: null, chain }), /candidates must be an array/u);
});

test("refuses a plans entry lacking candidate.semanticFingerprint", () => {
  const candidates = [{ semanticFingerprint: "fp", implementations: [{ name: "fn" }], packages: ["a", "b"], consumers: [] }];
  assert.throws(() => deriveSetOfDuplicationWorkIntents({ candidates, chain, plans: [{ owner: "x" }] }), /lacks candidate.semanticFingerprint/u);
});

test("respects the limit and still reports considered/skippedSinglePackage over the whole input", () => {
  const cross = (n) => ({ semanticFingerprint: `fp${n}`, implementations: [{ name: `fn${n}` }], packages: ["a", "b"], consumers: [] });
  const candidates = [cross(1), cross(2), cross(3), { semanticFingerprint: "solo", implementations: [{ name: "s" }], packages: ["a"], consumers: [] }];
  const result = deriveSetOfDuplicationWorkIntents({ candidates, chain, limit: 2 });
  assert.equal(result.considered, 4);
  assert.equal(result.skippedSinglePackage, 1);
  assert.equal(result.intents.length, 2);
});

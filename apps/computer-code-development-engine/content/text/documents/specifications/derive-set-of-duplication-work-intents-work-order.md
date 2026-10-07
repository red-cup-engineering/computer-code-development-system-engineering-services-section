# derive-set-of-duplication-work-intents
## Requirements
- `cross-package-only`: The operation considers only cross-package candidates: a candidate whose `packages` array carries fewer than two entries is skipped and counted in `skippedSinglePackage` rather than turned into an intent.
- `one-intent-per-candidate`: The operation returns a `DuplicationWorkIntentSet` (`type`, `version: 1`, `derivedAt`, `considered`, `skippedSinglePackage`, `intents`) with exactly one `metroplat.work.structured-intent` in `intents` per remaining cross-package candidate, up to `request.limit` (default 25); `considered` is the total candidates given, regardless of the limit.
- `chain-carried-verbatim`: Every intent's `items` array opens with the four given `chain` items (endeavor, campaign, project, plan), each carried into a structured item verbatim (`cell`, `parent` when given, `text` unchanged) with the operation's own synthesized `evidence`/`provenance` added so each item satisfies `structured-work-intent-admit`'s item shape.
- `sources-cover-every-provenance-source`: Every intent's top-level `sources` array carries one entry (`id`, `kind`, `locator`) for every distinct `provenance[].source` value used anywhere in that intent's `items` (the chain-items source plus the candidate's `jsnode_duplication` source and, when a plan exists, its `jsnode.duplication-migration.plan` source) — `structured-work-intent-admit`'s own `assertStructuredWorkIntent` rejects an item whose provenance names a source absent from `sources`, so this is load-bearing for admission, not decorative.
- `one-task-per-intent`: Each intent's `items` array closes with one task item whose `cell` is `task:migrate-consumer-<fingerprint-prefix>` (the candidate's `semanticFingerprint`, first 12 characters), parented to the given chain's plan cell, stating the copied function's name, the packages it is copied in, and its consumer count.
- `refusal-first-step`: When a `jsnode.duplication-migration.plan` exists for the candidate (looked up by `candidate.semanticFingerprint` against `plans[].candidate.semanticFingerprint`), its `refusals` appear verbatim as the task's first step; an `owner-republish-required` refusal is rendered as "publish `<owner>` exporting `<name>`, then apply the plan" naming the plan's own `owner` and `ownerExport.name`.
- `no-plan-no-owner-step`: When no plan exists and the candidate carries no `existingUpstreamOwner`, the task's first step names "no owner: seat one in the section that owns the primitive" instead of a publish step.
- `horizon-by-consumer-count`: Every task carries modality MUST, force `necessary`, and horizon `soon`, except a candidate with 8 or more consumers, whose horizon is `now`; all three are stated in the task's own text (`modality=... force=... horizon=...`), following the precedent set by the 2026-09-04 owner-finance-asks-intent's embedded `force=... modality=... horizon=...` items.
- `gate-stated-per-task`: Every task's text closes with its gate: "the plan applies (`jsnode-computer duplication-migration --apply`), the consumers' tests pass, the owner is published, and `jsnode_duplication` no longer lists `<fingerprint-prefix>`".
- `pure-derivation`: The operation performs no filesystem or network access; it transforms only the `candidates`, `plans`, `chain`, and optional `derivedAt` it is given, defaulting `derivedAt` to its own wall clock when omitted so a caller can pass a fixed value for deterministic examples and tests. Admission is a separate script's job — this operation admits nothing itself.
## Prohibitions
- `candidates-must-be-array`: The operation must refuse (throw `TypeError`) a request whose `candidates` is not an array.
- `chain-must-be-four-items`: The operation must refuse a request whose `chain` is not an array of exactly four items.
- `plan-must-carry-fingerprint`: The operation must refuse a request carrying a `plans` entry whose `candidate.semanticFingerprint` is missing or empty.
## Laws
- `admitted-example-face-equivalence` | JSNode operation face-equivalence law | v1 | lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-code-fabrication-services-section/services/javascript-node-code-fabrication-services-section/services/jsnode-package-services-section/README.md | Applies to the shared example projected to the JSNode import and command faces. | Every admitted example has equivalent import and command outputs under the downstream JSNode face assay.
- `primitives-exist-once` | 561 Group working discipline | 2026-08-30 | CLAUDE.md | Applies to every candidate this operation turns into a migrate-consumer duty. | Primitives exist once, on the registry, interdependent — never copied; a rendered duty is one more copy this operation dispatches toward retirement.
- `platform-dispatches-consolidation` | Consolidation requirement | 2026-09-05 | this specification | Applies to the whole operation's reason for existing. | Consolidation is dispatched by the platform as duties on the work rail: consumers must be cut over, and YouTube channels must be refabricated automatically. A session must not infer these duties from its own reading of the duplication graph.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation, its import.meta.main guard, and downstream package-birth assays. | The package uses one executable ESM operation source file that is eligible for downstream staged package-birth assays.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/derive-set-of-duplication-work-intents-service","packageVersion":"0.1.1","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/derive-set-of-duplication-work-intents.mjs
#!/usr/bin/env node

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
  const resolvedOwner = plan?.owner ?? candidate.existingUpstreamOwner ?? null;
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
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "deriveSetOfDuplicationWorkIntents — Turns the duplication graph's cross-package, consumer-backed candidates into structured work intents, one per candidate, so consolidation is dispatched by the platform and never by a session's own reading.\n",
    );
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(deriveSetOfDuplicationWorkIntents(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/derive-set-of-duplication-work-intents.test.mjs
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
      packages: ["@red-cup-engineering/knowing", "@red-cup-engineering/metroplat"],
      consumers: ["a", "b", "c", "d", "e", "f", "g", "h"],
      removableBytes: 2119,
      existingUpstreamOwner: "@red-cup-engineering/knowing",
    },
    { semanticFingerprint: "solo", implementations: [{ name: "soloFn" }], packages: ["@red-cup-engineering/solo"], consumers: [], removableBytes: 40 },
  ];
  const plans = [
    {
      candidate: { semanticFingerprint: "c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2" },
      owner: "@red-cup-engineering/knowing",
      ownerExport: { name: "praxisFeedbackInterpretation" },
      refusals: [{ reason: "owner-republish-required", detail: "@red-cup-engineering/knowing's published 0.1.2 does not yet export \"praxisFeedbackInterpretation\" — publish it, then re-run" }],
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
      packages: ["@red-cup-engineering/computing", "@red-cup-engineering/youtube-channel-production-services-section"],
      consumers: ["x", "y", "z"],
      removableBytes: 1214,
      existingUpstreamOwner: null,
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
```
## Examples
```json name="one cross-package candidate with an owner-republish plan"
{"input":{"candidates":[{"semanticFingerprint":"c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2","implementations":[{"name":"praxisFeedbackInterpretation"}],"packages":["@red-cup-engineering/knowing","@red-cup-engineering/metroplat"],"consumers":["a","b","c","d","e","f","g","h"],"removableBytes":2119,"existingUpstreamOwner":"@red-cup-engineering/knowing"}],"plans":[{"candidate":{"semanticFingerprint":"c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2"},"owner":"@red-cup-engineering/knowing","ownerExport":{"name":"praxisFeedbackInterpretation"},"refusals":[{"reason":"owner-republish-required","detail":"@red-cup-engineering/knowing's published 0.1.2 does not yet export \"praxisFeedbackInterpretation\" — publish it, then re-run"}]}],"chain":[{"cell":"endeavor:ops-561-group","text":"ops.561.group: the ERP/ICS control plane for agents and humans."},{"cell":"campaign:internal-compute-market","parent":"endeavor:ops-561-group","text":"Sell every compute on the internal market."},{"cell":"project:core-stability","parent":"campaign:internal-compute-market","text":"Get the core stable."},{"cell":"plan:2026-09-03-core-stability","parent":"project:core-stability","text":"This week's plan."}],"derivedAt":"2026-09-05T00:00:00.000Z"},"output":{"type":"DuplicationWorkIntentSet","version":1,"derivedAt":"2026-09-05T00:00:00.000Z","considered":1,"skippedSinglePackage":0,"intents":[{"kind":"metroplat.work.structured-intent","id":"swi:2026-09-05:migrate-c5d74f3ac47b","producer":{"id":"derive-set-of-duplication-work-intents","revision":"0.1.1"},"sources":[{"id":"admit-set-of-health-work-intents.mjs#CHAIN_ITEMS","kind":"chain-items-source","locator":"admit-set-of-health-work-intents.mjs#CHAIN_ITEMS"},{"id":"jsnode_duplication#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2","kind":"jsnode-duplication-candidate","locator":"jsnode_duplication#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2"},{"id":"jsnode.duplication-migration.plan#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2","kind":"jsnode-duplication-migration-plan","locator":"jsnode.duplication-migration.plan#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2"}],"items":[{"cell":"endeavor:ops-561-group","text":"ops.561.group: the ERP/ICS control plane for agents and humans.","evidence":["chain item admitted verbatim from CHAIN_ITEMS: ops.561.group: the ERP/ICS control plane for agents and humans."],"provenance":[{"source":"admit-set-of-health-work-intents.mjs#CHAIN_ITEMS","evidence":["ops.561.group: the ERP/ICS control plane for agents and humans."]}]},{"cell":"campaign:internal-compute-market","parent":"endeavor:ops-561-group","text":"Sell every compute on the internal market.","evidence":["chain item admitted verbatim from CHAIN_ITEMS: Sell every compute on the internal market."],"provenance":[{"source":"admit-set-of-health-work-intents.mjs#CHAIN_ITEMS","evidence":["Sell every compute on the internal market."]}]},{"cell":"project:core-stability","parent":"campaign:internal-compute-market","text":"Get the core stable.","evidence":["chain item admitted verbatim from CHAIN_ITEMS: Get the core stable."],"provenance":[{"source":"admit-set-of-health-work-intents.mjs#CHAIN_ITEMS","evidence":["Get the core stable."]}]},{"cell":"plan:2026-09-03-core-stability","parent":"project:core-stability","text":"This week's plan.","evidence":["chain item admitted verbatim from CHAIN_ITEMS: This week's plan."],"provenance":[{"source":"admit-set-of-health-work-intents.mjs#CHAIN_ITEMS","evidence":["This week's plan."]}]},{"cell":"task:migrate-consumer-c5d74f3ac47b","parent":"plan:2026-09-03-core-stability","text":"praxisFeedbackInterpretation copied in @red-cup-engineering/knowing, @red-cup-engineering/metroplat with 8 consumers, removable 2119 bytes. owner=`@red-cup-engineering/knowing`. first step: publish `@red-cup-engineering/knowing` exporting `praxisFeedbackInterpretation`, then apply the plan. gate: the plan applies (`jsnode-computer duplication-migration --apply`), the consumers' tests pass, the owner is published, and `jsnode_duplication` no longer lists `c5d74f3ac47b`. modality=MUST force=necessary horizon=now","evidence":["8 consumers","removableBytes=2119"],"provenance":[{"source":"jsnode_duplication#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2","evidence":["removableBytes=2119","consumers=8"]},{"source":"jsnode.duplication-migration.plan#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2","evidence":["owner-republish-required: @red-cup-engineering/knowing's published 0.1.2 does not yet export \"praxisFeedbackInterpretation\" — publish it, then re-run"]}]}]}]}}
```
## Traceability
- `cross-package-only` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `node-esm-operation`
- `one-intent-per-candidate` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `platform-dispatches-consolidation`, `node-esm-operation`
- `chain-carried-verbatim` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`
- `sources-cover-every-provenance-source` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`
- `one-task-per-intent` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `platform-dispatches-consolidation`
- `refusal-first-step` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `platform-dispatches-consolidation`
- `no-plan-no-owner-step` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`
- `horizon-by-consumer-count` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `platform-dispatches-consolidation`
- `gate-stated-per-task` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `platform-dispatches-consolidation`
- `pure-derivation` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `candidates-must-be-array` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`, `node-esm-operation`
- `chain-must-be-four-items` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`, `node-esm-operation`
- `plan-must-carry-fingerprint` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`, `node-esm-operation`

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { defaultFilesystemBinding } from "@red-cup-engineering/computer-system-engine/rpc/binding";
import { readCheckoutHealth } from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/checks";
import {
  checkoutHealthOperations,
  checkoutHealthWorkIntentAdmitOperations,
  readyDutiesDischargeOperations,
} from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/service";
import { modelCharacterResolverFromProviderAdmissions } from "@red-cup-engineering/organizing/work/model-character";

function run(operation, input) {
  return operation.execute(input, {});
}

const DATE = "2026-09-03";
const ACTOR = "actor:test-checkout-health";
const CHAIN = Object.freeze([
  Object.freeze({ cell: "endeavor:ops-561-group", text: "test endeavor" }),
  Object.freeze({ cell: "campaign:test-checkout-health-campaign", parent: "endeavor:ops-561-group", text: "test campaign" }),
  Object.freeze({ cell: "project:test-checkout-health-project", parent: "campaign:test-checkout-health-campaign", text: "test project" }),
  Object.freeze({ cell: "plan:test-checkout-health-plan", parent: "project:test-checkout-health-project", text: "test plan" }),
]);

// The office-service allocation triple a caller must declare for every
// checkout-health-work-intent-admit request (monitoring never invents one).
const DUTY = "emsenn/duty/checkout-health-repair";
const WORK = "checkout-health-repair";
const SKILL = "checkout-health-repair";
const CHARACTER = Object.freeze({ model: "fixture-model", id: ACTOR, capabilities: Object.freeze([WORK]) });
const OFFICE_SERVICE = Object.freeze({ id: DUTY, requiredCapabilities: Object.freeze([WORK]) });
const AUTHORITY_REQUEST_FIELDS = Object.freeze({ duty: DUTY, character: CHARACTER, officeService: OFFICE_SERVICE });
const ALLOCATING_REQUEST_FIELDS = Object.freeze({ ...AUTHORITY_REQUEST_FIELDS, work: WORK, skill: SKILL });

// A fixture office-authority resolver, matching test/agency-work-allocation.test.mjs's
// own pattern: it verifies the same office/duty/officeService the caller declared and
// grants exactly the WORK/SKILL every checkout-health task now carries.
function resolveAgencyWorkAuthority(allocation) {
  return Object.freeze({
    office: Object.freeze({ id: allocation.office.id, bearsDuty: Object.freeze([allocation.duty]), deonticProfile: Object.freeze({ [WORK]: "duty" }) }),
    duty: Object.freeze({ id: allocation.duty, work: WORK, claim: "founder:561-group", skills: Object.freeze([SKILL]), delegation: false }),
    work: Object.freeze({ id: WORK, needs: Object.freeze([SKILL]), receiverCondition: "checkout-health-repair-accepted" }),
    skill: Object.freeze({ id: SKILL, closureKind: "procedure", requiresCapabilities: Object.freeze([]), method: "checkout-health-repair" }),
    officeService: Object.freeze({ id: allocation.officeService.id, requiredCapabilities: allocation.officeService.requiredCapabilities }),
  });
}
const resolveModelCharacter = modelCharacterResolverFromProviderAdmissions([{ model: "fixture-model", capabilities: [WORK] }]);
const ALLOCATE_OPTIONS = Object.freeze({ resolveAgencyWorkAuthority, resolveModelCharacter });

function scratchDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

test("checkout-health operation reports zero violations for an empty scope (no root, no hosts)", async () => {
  const binding = defaultFilesystemBinding(scratchDir("checkout-health-empty-"), { now: () => `${DATE}T12:00:00.000Z` });
  const [operation] = checkoutHealthOperations(binding);
  const outcome = await run(operation, { hosts: [] });
  assert.equal(outcome.value.violations, 0);
  assert.deepEqual(outcome.value.findings, []);
  assert.deepEqual(outcome.value.failedUnits, []);
});

test("checkout-health operation finds a real exact-deps violation under a scratch checkout root", async () => {
  const root = scratchDir("checkout-health-root-");
  try {
    const pkgDir = path.join(root, "pkg-a");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-a", version: "1.0.0", dependencies: { "left-pad": "^1.0.0" } }));
    const binding = defaultFilesystemBinding(scratchDir("checkout-health-data-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [operation] = checkoutHealthOperations(binding);
    const outcome = await run(operation, { root, changedOnly: false, hosts: [] });
    const finding = outcome.value.findings.find((f) => f.check === "exact-deps");
    assert.ok(finding, "expected an exact-deps finding");
    assert.equal(finding.name, "left-pad");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkout-health-work-intent-admit admits nothing when there are zero violations", async () => {
  const root = scratchDir("checkout-health-work-intent-empty-root-");
  try {
    const binding = defaultFilesystemBinding(scratchDir("checkout-health-work-intent-empty-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [operation] = checkoutHealthWorkIntentAdmitOperations(binding);
    const outcome = await run(operation, { kind: "metroplat.monitoring.checkout-health.work-intent-request", chain: CHAIN, root, hosts: [], intentId: "checkout-health-work-intents-test-empty", ...AUTHORITY_REQUEST_FIELDS });
    assert.equal(outcome.value.violations, 0);
    assert.equal(outcome.value.admitted, 0);
    assert.equal(outcome.value.intentId, null);
    assert.equal(outcome.value.rowsAppended, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkout-health-work-intent-admit refuses a request naming both root and health", async () => {
  const root = scratchDir("checkout-health-work-intent-both-root-");
  try {
    const binding = defaultFilesystemBinding(scratchDir("checkout-health-work-intent-both-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [operation] = checkoutHealthWorkIntentAdmitOperations(binding);
    const health = readCheckoutHealth({ root, hosts: [] });
    await assert.rejects(
      async () => run(operation, { kind: "metroplat.monitoring.checkout-health.work-intent-request", chain: CHAIN, root, health, hosts: [], ...AUTHORITY_REQUEST_FIELDS }),
      /mutually exclusive/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkout-health-work-intent-admit admits the same task/summary from a precomputed health as from root", async () => {
  const root = scratchDir("checkout-health-work-intent-precomputed-root-");
  try {
    const pkgDir = path.join(root, "pkg-a");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-a", version: "1.0.0", dependencies: { "left-pad": "^1.0.0" } }));
    const health = readCheckoutHealth({ root, changedOnly: false, hosts: [] });

    const rootBinding = defaultFilesystemBinding(scratchDir("checkout-health-work-intent-precomputed-root-data-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [rootOperation] = checkoutHealthWorkIntentAdmitOperations(rootBinding, ALLOCATE_OPTIONS);
    const rootOutcome = await run(rootOperation, { kind: "metroplat.monitoring.checkout-health.work-intent-request", chain: CHAIN, root, changedOnly: false, hosts: [], intentId: "checkout-health-work-intents-test-precomputed-root", ...ALLOCATING_REQUEST_FIELDS });

    const healthBinding = defaultFilesystemBinding(scratchDir("checkout-health-work-intent-precomputed-health-data-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [healthOperation] = checkoutHealthWorkIntentAdmitOperations(healthBinding, ALLOCATE_OPTIONS);
    const healthOutcome = await run(healthOperation, { kind: "metroplat.monitoring.checkout-health.work-intent-request", chain: CHAIN, health, intentId: "checkout-health-work-intents-test-precomputed-health", ...ALLOCATING_REQUEST_FIELDS });

    assert.equal(healthOutcome.value.checked, rootOutcome.value.checked);
    assert.equal(healthOutcome.value.violations, rootOutcome.value.violations);
    assert.equal(healthOutcome.value.admitted, rootOutcome.value.admitted);
    assert.equal(healthOutcome.value.allocated, rootOutcome.value.allocated);
    assert.ok(healthOutcome.value.rowsAppended > 0);
    assert.ok(healthOutcome.value.allocationsAppended > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkout-health-work-intent-admit admits a task and allocation for a real finding, and a second run appends zero rows (idempotent)", async () => {
  const root = scratchDir("checkout-health-work-intent-root-");
  try {
    const pkgDir = path.join(root, "pkg-a");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-a", version: "1.0.0", dependencies: { "left-pad": "^1.0.0" } }));
    const binding = defaultFilesystemBinding(scratchDir("checkout-health-work-intent-data-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [operation] = checkoutHealthWorkIntentAdmitOperations(binding, ALLOCATE_OPTIONS);
    const request = { kind: "metroplat.monitoring.checkout-health.work-intent-request", chain: CHAIN, root, changedOnly: false, hosts: [], intentId: "checkout-health-work-intents-test-idempotent", ...ALLOCATING_REQUEST_FIELDS };

    const first = await run(operation, request);
    assert.equal(first.value.admitted, 1);
    assert.equal(first.value.allocated, 1);
    assert.ok(first.value.rowsAppended > 0);
    assert.ok(first.value.allocationsAppended > 0);

    const second = await run(operation, request);
    assert.equal(second.value.admitted, 1, "the same violation is found again");
    assert.equal(second.value.rowsAppended, 0, "the intent is already admitted");
    assert.equal(second.value.allocationsAppended, 0, "the allocation is already admitted");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ready-duties-discharge reports zero duties against an empty data root", async () => {
  const binding = defaultFilesystemBinding(scratchDir("checkout-health-discharge-empty-"), { now: () => `${DATE}T12:00:00.000Z` });
  const [operation] = readyDutiesDischargeOperations(binding);
  const outcome = await run(operation, { kind: "metroplat.monitoring.checkout-health.ready-duties-discharge-request", root: "/repo" });
  assert.deepEqual(outcome.value.duties, []);
  assert.equal(outcome.value.ok, true);
});

test("ready-duties-discharge routes a real admitted exact-deps duty to no-op plan mode without applying", async () => {
  const root = scratchDir("checkout-health-e2e-root-");
  try {
    const pkgDir = path.join(root, "pkg-a");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-a", version: "1.0.0", dependencies: { "left-pad": "^1.0.0" } }));
    const binding = defaultFilesystemBinding(scratchDir("checkout-health-e2e-data-"), { now: () => `${DATE}T12:00:00.000Z` });
    const [admitOperation] = checkoutHealthWorkIntentAdmitOperations(binding, ALLOCATE_OPTIONS);
    await run(admitOperation, { kind: "metroplat.monitoring.checkout-health.work-intent-request", chain: CHAIN, root, changedOnly: false, hosts: [], intentId: "checkout-health-work-intents-test-e2e", ...ALLOCATING_REQUEST_FIELDS });

    const [dischargeOperation] = readyDutiesDischargeOperations(binding);
    const outcome = await run(dischargeOperation, { kind: "metroplat.monitoring.checkout-health.ready-duties-discharge-request", root, apply: false });
    assert.equal(outcome.value.ok, true);
    const duty = outcome.value.duties.find((d) => d.scope === "task:exact-deps-pkg-a");
    assert.ok(duty, "expected the admitted exact-deps duty to be ready and routed");
    assert.equal(duty.status, "planned");
    assert.equal(duty.kind, "exact-deps");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

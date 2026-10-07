/**
 * @packageDocumentation
 * RPC adapters for checkout-health: `checkout-health` (projection),
 * `checkout-health-work-intent-admit` (journal-write), `ready-duties-
 * discharge` (gated external effect). Callers pass parameters only.
 *
 * `binding.readCheckoutHealth`/`binding.handRegisteredOperationsFindings` (the sibling
 * `./checks.mjs`'s exports of the same names) are the irreducible checker engine this
 * adapter composes -- real filesystem, subprocess, and systemd reads -- so this module
 * never imports `./checks.mjs` itself; its caller at the kernel edge supplies them on
 * `binding`, the same way it supplies `binding.now` and the filesystem effects.
 * @metroplatSubject monitoring
 */
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { operationHandlerResult } from "@red-cup-engineering/computer-system-engine/rpc/execution-context";
import { journal } from "@red-cup-engineering/computer-system-engine/journal/journal";
import { agentWorkReadoutCollector } from "@red-cup-engineering/organizing/work/readout";
import { agentWorkDispatchReadoutOfWork } from "@red-cup-engineering/organizing/work/dispatch";
import { signedActionsOfRoadmap } from "@red-cup-engineering/feltos/work/dispatch-readout";
import { readSignRoadmap } from "@red-cup-engineering/feltos/work/sign-roadmap-journal";
import { admitStructuredWorkIntent } from "@red-cup-engineering/feltos/work/structured-intent";
import { admitWorkDischarge } from "@red-cup-engineering/feltos/work/work-discharge";

import { healthWorkIntent } from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/work-intent";
import { dischargeReadyDuties } from "@red-cup-engineering/feltos/work/duty-discharge";
import {
  checkoutHealthReadContract,
  checkoutHealthWorkIntentRequestContract,
  checkoutHealthWorkIntentSummaryContract,
  readyDutiesDischargeRequestContract,
  readyDutiesDischargeResultContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/schema";

/** Process/application configuration for checkout-health adapters. */

/**
 * Optional office-authority wiring for `checkout-health-work-intent-admit`.
 * Monitoring never manufactures office authority itself (it does not invent
 * a default resolver): absent these, the operation admits only the
 * structured-intent tasks and leaves `allocated`/`allocationsAppended` at
 * zero, exactly as it does today with no caller-supplied wiring. A caller
 * that owns the lawful firm pool (the same shape `workCoordinationOptions`
 * accepts at the work boundary) may supply them to admit one
 * `agency-work-allocation` per task through the same canonical
 * `admitAgencyWorkAllocation` gate every other allocator uses.
 */

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function resolvedRoot(record, binding) {
  return typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.packageRoot;
}

function optionalStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0)
    ? Object.freeze([...value])
    : undefined;
}

/**
 * Folds the whole causal territory (never one calendar date -- a duty
 * admitted on an earlier day must still be found) into the same duty
 * readout/dispatch math every other MetroPlat work-coordination consumer
 * uses.
 */
function collectAgentWorkDispatchReadout(binding, subject, date) {
  const collector = agentWorkReadoutCollector();
  journal.scanCausalTerritory(binding.dataRoot, undefined, (_accumulator, row) => {
    collector.push(row);
    return undefined;
  });
  const workReadout = collector.read({ subject, date, feed: "daily-claim-sessions" });
  let signedActions = new Map();
  try { signedActions = signedActionsOfRoadmap(readSignRoadmap(binding, date)); } catch { /* no valid roadmap means no executable Actions */ }
  return agentWorkDispatchReadoutOfWork(workReadout, { signedActions });
}

function todayIso(binding) {
  return binding.now().slice(0, 10);
}

/** The `checkout-health` projection: reads the composed checker findings. */
export function checkoutHealthOperations(binding) {
  return Object.freeze([operation({
    verb: "checkout-health",
    relation: "projection",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Read the composed checkout-health checker findings.",
    description: "Domain: { root?, changedOnly?, budgetMs?, hosts?, checkoutBoundUnitsAllow? } (loose; every field optional, no kind tag required, matching module-topology/source-code-policy's own read conventions). Composes the data-custody trio, exact-pin manifests, lockfile registry, import-stratification (via evaluateSourceCodePolicies), builtin-imports (via auditNodeBuiltinImports over scripts/ and src/ .mjs/.mts files), systemd failed units, and checkout-bound units into one bounded read. root defaults to the binding package root; omitted, the checkout-scoped checkers do not run.",
    codomain: checkoutHealthReadContract,
    run: async (input) => {
      const record = inputRecord(input);
      const root = resolvedRoot(record, binding);
      const handRegisteredOperations = await binding.handRegisteredOperationsFindings(root);
      const read = binding.readCheckoutHealth({
        root,
        changedOnly: record["changedOnly"] === true,
        budgetMs: typeof record["budgetMs"] === "number" ? record["budgetMs"] : undefined,
        hosts: optionalStringArray(record["hosts"]),
        checkoutBoundUnitsAllow: optionalStringArray(record["checkoutBoundUnitsAllow"]),
        handRegisteredOperations,
      });
      return operationHandlerResult(read, []);
    },
  })]);
}

/** Admits checkout-health findings as structured intent. Monitoring does not
 * manufacture office authority and never staffs a task: allocation control
 * reconciles the admitted intent's tasks against the house's staffing posterior. */
export function checkoutHealthWorkIntentAdmitOperations(
  binding,
) {
  return Object.freeze([operation({
    verb: "checkout-health-work-intent-admit",
    relation: "boundary",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Admit the checkout-health findings as a structured work intent.",
    description: "Domain: { chain, root?, health?, changedOnly?, budgetMs?, hosts?, checkoutBoundUnitsAllow?, intentId?, work?, skill? }. chain is the caller's own admitted endeavor->...->plan cell chain (harness sections carry this parameter; metroplat carries no hardcoded plan). The checkout findings come from exactly one of: root (this operation runs readCheckoutHealth itself, for a caller that holds the checkout), or health (a CheckoutHealthRead a caller already computed and hands over, e.g. checkout-health run on a GitHub Actions runner and admitted here on a production host with no checkout); naming both is refused; naming neither reads host-only (no checkout-scoped checks), as checkout-health does. Groups the findings into task items under the chain's plan cell, and admits the structured intent. It names no office, character or model: allocation control derives staffing for each task from the house's outcomes.",
    domain: checkoutHealthWorkIntentRequestContract,
    codomain: checkoutHealthWorkIntentSummaryContract,
    effects: {
      class: "journal-write",
      replay: "idempotency-key",
      coordination: "coordination-free",
      deterministic: "unmeasured",
      totality: "unmeasured",
    },
    run: async (input) => {
      const request = checkoutHealthWorkIntentRequestContract.assert(input, "checkout-health-work-intent-admit input");
      const record = request;
      const requestHealth = (request).health;
      const rootGiven = typeof record["root"] === "string" && record["root"].length > 0;
      if (rootGiven && requestHealth !== undefined) {
        throw new TypeError("checkout-health-work-intent-admit: root and health are mutually exclusive; name one");
      }
      const root = requestHealth === undefined ? resolvedRoot(record, binding) : undefined;
      const handRegisteredOperations = requestHealth === undefined ? await binding.handRegisteredOperationsFindings(root) : undefined;
      const health = requestHealth ?? binding.readCheckoutHealth({
        root,
        changedOnly: request.changedOnly === true,
        budgetMs: request.budgetMs,
        hosts: request.hosts,
        checkoutBoundUnitsAllow: request.checkoutBoundUnitsAllow,
        ...(handRegisteredOperations === undefined ? {} : { handRegisteredOperations }),
      });
      const nowIso = binding.now();
      const intentId = request.intentId ?? `checkout-health-work-intents-${nowIso.slice(0, 10)}`;
      if (health.violations === 0) {
        return operationHandlerResult(checkoutHealthWorkIntentSummaryContract.assert(Object.freeze({
          kind: "metroplat.monitoring.checkout-health.work-intent-summary",
          checked: health.checked,
          violations: 0,
          admitted: 0,
          intentId: null,
          rowsAppended: 0,
          allocated: 0,
          allocationsAppended: 0,
        }), "checkout health work intent summary"), []);
      }
      const plan = healthWorkIntent(health, {
        id: intentId,
        chain: request.chain,
        work: request.work,
        skill: request.skill,
        root,
      });
      const subject = `structured-work-intent-${intentId}`;
      const admission = admitStructuredWorkIntent(binding, plan.intent, { at: nowIso, subject });
      const summary = checkoutHealthWorkIntentSummaryContract.assert(Object.freeze({
        kind: "metroplat.monitoring.checkout-health.work-intent-summary",
        checked: health.checked,
        violations: health.violations,
        admitted: plan.tasks.length,
        intentId,
        rowsAppended: admission.appended,
        allocated: 0,
        allocationsAppended: 0,
      }), "checkout health work intent summary");
      return operationHandlerResult(summary, []);
    },
  })]);
}

/** Reads ready duties off the live agent-work-dispatch readout and routes/applies them. */
export function readyDutiesDischargeOperations(binding) {
  return Object.freeze([operation({
    verb: "ready-duties-discharge",
    relation: "boundary",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Run ready bound commands or checkout-health repairs, then discharge only accepted results.",
    description: "Domain: { root, apply?, limit?, scope?, repairKind? }. Reads ready task duties from the causal territory. A duty carrying deterministicExecution runs its admitted JavascriptNodeCommandExecutionRequest@1 before scope repair heuristics; apply:false plans without running, while apply:true performs at most limit attempts and discharges only when its named acceptance gate accepts the command receipt and work-discharge admission accepts the same intent and scope. Other task:exact-deps-* and task:data-custody-* duties use their existing repairs; recognized no-hand scopes remain observations. Command effects and replay behavior remain unmeasured.",
    domain: readyDutiesDischargeRequestContract,
    codomain: readyDutiesDischargeResultContract,
    effects: {
      class: "external",
      replay: "coordinated",
      coordination: "coordination-required",
      deterministic: "unmeasured",
      totality: "partial",
    },
    run: async (input) => {
      const request = readyDutiesDischargeRequestContract.assert(input, "ready-duties-discharge input");
      const date = todayIso(binding);
      const readout = collectAgentWorkDispatchReadout(binding, "checkout-health-duty-discharge", date);
      const dischargeReadout = Object.freeze({
        frontier: Object.freeze(readout.frontier.map(({ deterministicExecution, ...duty }) => deterministicExecution === undefined
          ? Object.freeze(duty)
          : Object.freeze({ ...duty, deterministicExecution }))),
      });
      const result = await dischargeReadyDuties({
        readout: dischargeReadout,
        root: request.root,
        binding,
        apply: request.apply === true,
        limit: request.limit,
        scope: request.scope,
        kind: request.repairKind,
        admitDischargeFn: (_binding, discharge) => admitWorkDischarge(binding, discharge, { at: date }),
        // `duty-discharge.mjs`'s own directory/presence/read/write and clock defaults were
        // removed for the same reason `./checks.mjs`'s were never imported here: they are real
        // filesystem and clock effects, so they arrive on `binding` from the kernel edge rather
        // than living in this module or in `duty-discharge.mjs` itself.
        now: binding.now,
        existsFn: binding.pathExists,
        listDirFn: binding.readDirectoryEntries,
        readFileImpl: binding.readFile,
        writeFileImpl: binding.writeFile,
      });
      return operationHandlerResult(readyDutiesDischargeResultContract.assert(result, "ready duties discharge result"), []);
    },
  })]);
}

/** Every checkout-health operation, for callers that mount the whole family at once. */
export function checkoutHealthFamilyOperations(
  binding,
) {
  return Object.freeze([
    ...checkoutHealthOperations(binding),
    ...checkoutHealthWorkIntentAdmitOperations(binding),
    ...readyDutiesDischargeOperations(binding),
  ]);
}

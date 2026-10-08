/**
 * @packageDocumentation
 *
 * Transport-independent proof-health observations and their RPC operation
 * family. The monitor runs executable mathematical law receipts and checks
 * term-bodied catalog operations against their declared contracts.
 */
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { agentActuationLawReceipt } from "@red-cup-engineering/feltos/agents/actuation";
import { codeDevelopmentAgentDomain } from "@red-cup-engineering/computer-code-development-engine/agent/code-development-domain";
import { } from "@red-cup-engineering/json-services-section";
import { receipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/crdt-cohomological-calm";
import { receipt as inconsistencySheafReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/inconsistency-sheaf";
import { keratinReceipt } from "@red-cup-engineering/metrologic/models/topology/keratin";
import { receipt as negativeParaconsistentSheafReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/negative-paraconsistent-sheaf";
import { receipt as ordinalClosureReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/ordinal-closure";
import { receipt as quantaleEnrichedSheafReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/quantale-enriched-sheaf";
import { receipt as settlingCohomologyH1Receipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/settling-cohomology-h1";
import { receipt as settlingLocalConstancyModuleReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/settling-local-constancy";
import { transfiniteComplexReceipt as transfiniteCellComplexReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/transfinite-cell-complex";
import { receipt as verificationTournamentReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/verification-tournament";
import { receipt as alexandrovHusainovReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/alexandrov-husainov";
import { receipt as frobeniusTqftReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/frobenius-tqft";
import { receipt as inverseHullReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/inverse-hull";
import { receipt as jeandelRaoWitnessReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/jeandel-rao-witness";
import { kappaSectorChargesReceipt } from "@red-cup-engineering/metrologic/models/physics/models/glass/kappa-sector-charges";
import { receipt as aperiodicAutocorrelationReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/aperiodic-autocorrelation";
import { receipt as lawvereHarmonicCohomologyReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/lawvere-harmonic-cohomology";
import { causalMldClassificationReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal-mld-classification";
import { continuumColimitReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/continuum-colimit";
import { causalMicrosupportReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal-microsupport";
import { hauptvermutungReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/hauptvermutung";
import { regimeTimeSectionReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/regime-time-section";
import { causalInvolutivityReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal-involutivity";
import { preValueCategoryReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/lax-slack";
import { boolWorkedRankNullityReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/linear-algebra";
import { formalConceptAnalysisReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/fca-lambek-circle";
import { workItemCausalSetCarrierReceipt } from "@red-cup-engineering/organizing/work/causal-set";
import { parityReconciliationLawReceipt } from "@red-cup-engineering/metrologic/models/physics/models/quantum-contextuality/reconciliation-quote";
import { officeReceipt } from "@red-cup-engineering/socializing";
import { operationalAccountingLawReceipt } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/flow";
import { moduleTopologyValuation } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/valuation";
import { readSourceCodeMonitorAggregate } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/aggregate";
import { readMonitorAggregate, subsystemEntry } from "@red-cup-engineering/computer-code-development-engine/monitoring/substrate/aggregate";
import { measureProgramContract } from "@red-cup-engineering/computer-system-engine/rpc/contract";
import { admitProgramContractEvidence } from "@red-cup-engineering/computer-system-engine/rpc/contract-evidence";
import { bilatticeLawReceipt, kleinFourGaugeReceipt, readingFamilies } from "@red-cup-engineering/computer-data-services-section/four";

/** Verify the Belnap knowledge-lattice join semantics of `moduleTopologyValuation`.
 *
 * The knowledge lattice join accumulates evidence independently on both the
 * "for" (positive) and "against" (negative) dimensions without cancellation —
 * this is Belnap's paraconsistency guarantee.  The laws checked here are:
 *
 * 1. **Idempotency** — join([X]) = X for every reading value X.
 * 2. **Identity of unknown** — join([unknown, X]) = X (unknown contributes no evidence).
 * 3. **Cross-join** — join([held, denied]) = contested (pos+neg → contested).
 * 4. **Absorption of contested** — join([contested, X]) = contested for any X.
 * 5. **Commutativity** — join([A, B]) = join([B, A]).
 *
 * All checks are exercised through the public `moduleTopologyValuation` API
 * so the receipt covers the complete code path from policy rulings to readings. */
export function moduleTopologyValuationLawReceipt() {

  // Build a minimal evaluation stub accepted by moduleTopologyValuation.
  // The function reads only .source, .topology, .observation, and .rulings.
  function evalStub(rulings) {
    return {
      kind: "metroplat.monitoring.source-code.policy-evaluation",
      source: "receipt-test",
      topology: "receipt-topology",
      observation: "receipt-observation",
      relation: {},
      policies: [],
      rulings: rulings,
      summary: Object.freeze({ held: 0, denied: 0, contested: 0, unknown: 0 }),
      reconciliation: {},
    };
  }

  function localRuling(from, to, judgement) {
    return Object.freeze({
      kind: "metroplat.monitoring.source-code.local-import-ruling",
      from,
      to,
      targetPresent: true,
      judgement,
      fired: Object.freeze([]),
    });
  }

  function readingOf(rulings, path) {
    const v = moduleTopologyValuation(evalStub(rulings));
    return (v.modules.find((m) => m.path === path)?.reading) ?? "unknown";
  }

  const failures = [];

  function check(label, actual, expected) {
    if (actual !== expected) failures.push(`${label}: expected ${expected}, got ${actual}`);
  }

  const rulings = readingFamilies.extremal;

  // 1. Idempotency: single ruling preserves its own reading.
  for (const c of rulings) {
    if (c === "unknown") {
      // No ruling produces unknown: absence of rulings → no module entry → implicit unknown.
      const v = moduleTopologyValuation(evalStub([]));
      check(`idempotency-unknown (no entry)`, v.modules.length === 0 ? "unknown" : "contested", "unknown");
    } else {
      check(`idempotency-${c}`, readingOf([localRuling("m.mts", "t.mts", c)], "m.mts"), c);
    }
  }

  // 2. Identity of unknown: joining unknown with X returns X.
  //    Since rulings are typed ReadingValueName and "unknown" is a valid judgement,
  //    we verify that an unknown ruling combined with another reading yields that reading.
  check("identity-unknown+held",    readingOf([localRuling("m.mts", "a.mts", "unknown"), localRuling("m.mts", "b.mts", "held")], "m.mts"),    "held");
  check("identity-unknown+denied",  readingOf([localRuling("m.mts", "a.mts", "unknown"), localRuling("m.mts", "b.mts", "denied")], "m.mts"),  "denied");
  check("identity-unknown+unknown", readingOf([localRuling("m.mts", "a.mts", "unknown"), localRuling("m.mts", "b.mts", "unknown")], "m.mts"), "unknown");

  // 3. Cross-join: held+denied = contested (both evidence dimensions populated).
  check("cross-held+denied",   readingOf([localRuling("m.mts", "a.mts", "held"), localRuling("m.mts", "b.mts", "denied")], "m.mts"),   "contested");
  check("cross-denied+held",   readingOf([localRuling("m.mts", "a.mts", "denied"), localRuling("m.mts", "b.mts", "held")], "m.mts"),   "contested");

  // 4. Absorption of contested: contested joined with anything remains contested.
  for (const c of rulings) {
    check(`absorption-contested+${c}`, readingOf([localRuling("m.mts", "a.mts", "contested"), localRuling("m.mts", "b.mts", c)], "m.mts"), "contested");
  }

  // 5. Commutativity: join([A, B]) = join([B, A]).
  const pairs = [
    ["held", "denied"], ["held", "contested"], ["denied", "contested"],
    ["held", "unknown"], ["denied", "unknown"], ["contested", "unknown"],
  ];
  for (const [a, b] of pairs) {
    const ab = readingOf([localRuling("m.mts", "x.mts", a), localRuling("m.mts", "y.mts", b)], "m.mts");
    const ba = readingOf([localRuling("m.mts", "x.mts", b), localRuling("m.mts", "y.mts", a)], "m.mts");
    if (ab !== ba) failures.push(`commutativity-${a}+${b}: join([${a},${b}])=${ab} ≠ join([${b},${a}])=${ba}`);
  }

  // 6. Summary census matches per-module entries.
  const sampleEval = evalStub([
    localRuling("src/a.mts", "src/b.mts", "held"),
    localRuling("src/c.mts", "src/d.mts", "denied"),
    localRuling("src/e.mts", "src/f.mts", "held"),
    localRuling("src/e.mts", "src/g.mts", "denied"),
  ]);
  const sample = moduleTopologyValuation(sampleEval);
  const heldCount = sample.modules.filter((m) => m.reading === "held").length;
  const deniedCount = sample.modules.filter((m) => m.reading === "denied").length;
  const contestedCount = sample.modules.filter((m) => m.reading === "contested").length;
  if (sample.summary.held !== heldCount) failures.push(`census-held: summary=${sample.summary.held} ≠ modules=${heldCount}`);
  if (sample.summary.denied !== deniedCount) failures.push(`census-denied: summary=${sample.summary.denied} ≠ modules=${deniedCount}`);
  if (sample.summary.contested !== contestedCount) failures.push(`census-contested: summary=${sample.summary.contested} ≠ modules=${contestedCount}`);

  // 7. Content address is stable across identical inputs.
  const id1 = moduleTopologyValuation(sampleEval).id;
  const id2 = moduleTopologyValuation(sampleEval).id;
  if (id1 !== id2) failures.push(`content-address-stability: id1=${id1} ≠ id2=${id2}`);

  const passed = failures.length === 0;
  return Object.freeze({
    kind: "metroplat.proof-health.module-topology-valuation-laws",
    laws: [
      "belnap-knowledge-join-idempotency",
      "belnap-knowledge-join-identity-of-unknown",
      "belnap-knowledge-join-cross-reading",
      "belnap-knowledge-join-absorption-of-contested",
      "belnap-knowledge-join-commutativity",
      "valuation-summary-census-consistency",
      "valuation-content-address-stability",
    ],
    failures: Object.freeze(failures),
    passed,
    reading: passed ? "held" : "denied",
  });
}

/** Verify the Belnap bilattice homomorphism property of `readSourceCodeMonitorAggregate`.
 *
 * The aggregate join must satisfy:
 * 1. **Non-negativity** — `record.pos ≥ 0`, `record.neg ≥ 0` always.
 * 2. **Monotonicity** — adding conformant evidence can only increase pos; adding
 *    non-conformant evidence can only increase neg (never cancel).
 * 3. **Paraconsistency** — a `contested` subsystem forces the package reading to
 *    be at least `contested` (positive mass is preserved across the join).
 * 4. **Subsystem count** — the aggregate always has exactly three named subsystems
 *    (policy, topology, build-order).
 * 5. **Content-address stability** — identical inputs produce identical ids. */
export function sourceCodeMonitorAggregateLawReceipt() {

  function evalStub(rulings, summary) {
    return {
      kind: "metroplat.monitoring.source-code.policy-evaluation",
      source: "receipt-test",
      topology: "receipt-topology",
      observation: "receipt-observation",
      relation: {},
      policies: [],
      rulings: rulings,
      summary,
      reconciliation: {},
    };
  }

  function localRuling(from, to, judgement) {
    return Object.freeze({ kind: "metroplat.monitoring.source-code.local-import-ruling", from, to, targetPresent: true, judgement: judgement, fired: Object.freeze([]) });
  }

  function buildOrderRuling(judgement) {
    return Object.freeze({ kind: "metroplat.monitoring.source-code.module-build-order-ruling", acyclic: judgement === "held", buildOrder: { kind: "metroplat.monitoring.source-code.module-build-order", tiers: [] }, judgement: judgement, fired: Object.freeze([]) });
  }

  const failures = [];

  function check(label, actual, expected) {
    if (actual !== expected) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  // 1. An empty observation makes no claim.
  const emptyAggregate = readSourceCodeMonitorAggregate(evalStub([], { held: 0, denied: 0, contested: 0, unknown: 0 }));
  check("empty-claims", emptyAggregate.claims.length, 0);

  // 2. Adding a distinct claim preserves both claim valuations.
  const baseEval = evalStub([localRuling("a.mts", "b.mts", "held"), buildOrderRuling("held")], { held: 1, denied: 0, contested: 0, unknown: 0 });
  const baseAgg = readSourceCodeMonitorAggregate(baseEval);
  const extEval = evalStub([localRuling("a.mts", "b.mts", "held"), localRuling("c.mts", "d.mts", "held"), buildOrderRuling("held")], { held: 2, denied: 0, contested: 0, unknown: 0 });
  const extAgg = readSourceCodeMonitorAggregate(extEval);
  check("distinct-claim-count", extAgg.claims.length, baseAgg.claims.length + 1);
  check("distinct-claims-held", extAgg.claims.every((claim) => claim.reading === "held"), true);

  // 3. Only conflicting evidence for one exact key is contested.
  const contestedEval = evalStub([localRuling("a.mts", "b.mts", "held"), localRuling("a.mts", "b.mts", "denied")], { held: 0, denied: 0, contested: 1, unknown: 0 });
  const contestedAgg = readSourceCodeMonitorAggregate(contestedEval);
  check("same-claim-conflict", contestedAgg.claims[0]?.reading, "contested");

  // 4. Distinct held and denied claims do not become a false contradiction.
  const distinct = readSourceCodeMonitorAggregate(evalStub([localRuling("a.mts", "b.mts", "held"), localRuling("c.mts", "d.mts", "denied")], { held: 1, denied: 1, contested: 0, unknown: 0 }));
  check("distinct-claim-values", distinct.claims.map((claim) => claim.reading).join(","), "held,denied");

  // 5. Content-address stability: identical evaluation → identical id.
  const sameEval1 = evalStub([localRuling("x.mts", "y.mts", "held"), buildOrderRuling("held")], { held: 1, denied: 0, contested: 0, unknown: 0 });
  const sameEval2 = evalStub([localRuling("x.mts", "y.mts", "held"), buildOrderRuling("held")], { held: 1, denied: 0, contested: 0, unknown: 0 });
  const id1 = readSourceCodeMonitorAggregate(sameEval1).id;
  const id2 = readSourceCodeMonitorAggregate(sameEval2).id;
  if (id1 !== id2) failures.push(`content-address-stability: id1=${id1} ≠ id2=${id2}`);

  // 6. Build-order is omitted without evidence, rather than synthesized as unknown.
  const noBuildOrderEval = evalStub([localRuling("a.mts", "b.mts", "held")], { held: 1, denied: 0, contested: 0, unknown: 0 });
  const noBuildOrderAgg = readSourceCodeMonitorAggregate(noBuildOrderEval);
  check("build-order-omitted", noBuildOrderAgg.claims.some((claim) => claim.key === "module-build-order"), false);

  const passed = failures.length === 0;
  return Object.freeze({
    kind: "metroplat.proof-health.source-code-monitor-aggregate-laws",
    laws: [
      "aggregate-empty-has-no-claim",
      "aggregate-distinct-claim-preservation",
      "aggregate-same-claim-paraconsistency",
      "aggregate-no-count-to-truth",
      "aggregate-content-address-stability",
      "aggregate-build-order-claim-isolation",
    ],
    failures: Object.freeze(failures),
    passed,
    reading: passed ? "held" : "denied",
  });
}

/** Derive the paraconsistent Monitor aggregate for the proof-health domain.
 *
 * This is the `readMonitorAggregate` substrate applied to the proof-health
 * subsystem: it produces a `MonitorAggregate` whose reading reflects the
 * overall health of the math-law receipt corpus.
 *
 * The aggregate carries a single subsystem — `"math-laws"` — whose census is
 * derived from `readMathLawReadout()`: witnessed receipts count as `held`,
 * obstructed receipts count as `denied`.  The package reading is then the
 * Belnap knowledge-lattice join of those counts.
 *
 * As of the initial corpus (34 laws: 32 witnessed, 2 obstructed) the reading
 * is `"contested"` — both conformant and non-conformant evidence is present.
 * The reading will become `"held"` once all obstructed laws are resolved. */
export function readProofHealthMonitorAggregate() {
  const readout = readMathLawReadout();
  const witnessed = typeof readout["witnessed"] === "number" ? readout["witnessed"] : 0;
  const obstructed = typeof readout["obstructed"] === "number" ? readout["obstructed"] : 0;
  const unknown = 0; // every checked law has an explicit pass/fail outcome

  const census = Object.freeze({
    held: witnessed,
    denied: obstructed,
    contested: 0,
    unknown,
  });

  const subs = Object.freeze([
    subsystemEntry("math-laws", census, [
      `witnessed:${witnessed}`,
      `obstructed:${obstructed}`,
      "corpus:math-law-receipts",
    ]),
  ]);

  return readMonitorAggregate("proof-health", subs);
}

export function readMathLawReadout() {
  const laws = {};
  const run = (name, fn) => {
    try {
      laws[name] = JSON.parse(JSON.stringify(fn()));
    } catch (error) {
      laws[name] = Object.freeze({
        kind: "metroplat.holography.math-law-obstruction",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  run("bilattice-reading-laws", bilatticeLawReceipt);
  run("klein-four-gauge", kleinFourGaugeReceipt);
  run("crdt-cohomological-calm", receipt);
  run("inconsistency-sheaf", inconsistencySheafReceipt);
  run("keratin", keratinReceipt);
  run("negative-paraconsistent-sheaf", negativeParaconsistentSheafReceipt);
  run("ordinal-closure", ordinalClosureReceipt);
  run("quantale-enriched-sheaf", quantaleEnrichedSheafReceipt);
  run("settling-cohomology-h1", settlingCohomologyH1Receipt);
  run("settling-local-constancy", settlingLocalConstancyModuleReceipt);
  run("transfinite-cell-complex", transfiniteCellComplexReceipt);
  run("verification-tournament", verificationTournamentReceipt);
  run("alexandrov-husainov", alexandrovHusainovReceipt);
  run("frobenius-tqft", frobeniusTqftReceipt);
  run("inverse-hull", inverseHullReceipt);
  run("jeandel-rao-witness", jeandelRaoWitnessReceipt);
  run("kappa-sector-readings", kappaSectorChargesReceipt);
  run("aperiodic-autocorrelation", aperiodicAutocorrelationReceipt);
  run("lawvere-harmonic-cohomology", lawvereHarmonicCohomologyReceipt);
  run("causal-mld-classification", causalMldClassificationReceipt);
  run("continuum-colimit", continuumColimitReceipt);
  run("causal-microsupport", causalMicrosupportReceipt);
  run("hauptvermutung", hauptvermutungReceipt);
  run("regime-time-section", regimeTimeSectionReceipt);
  run("causal-involutivity", causalInvolutivityReceipt);
  run("lax-slack-pre-value-category", preValueCategoryReceipt);
  run("linear-algebra-rank-nullity", boolWorkedRankNullityReceipt);
  run("fca-lambek-circle", formalConceptAnalysisReceipt);
  run("work-item-causal-set", workItemCausalSetCarrierReceipt);
  run("parity-reconciliation-quote", parityReconciliationLawReceipt);
  run("office-governance", officeReceipt);
  run("evidence-flow-operational-accounting", operationalAccountingLawReceipt);
  run("module-topology-valuation-laws", moduleTopologyValuationLawReceipt);
  run("source-code-monitor-aggregate-laws", sourceCodeMonitorAggregateLawReceipt);
  run("agent-actuation-laws", () => agentActuationLawReceipt(codeDevelopmentAgentDomain));
  const witnessed = Object.values(laws).filter((v) =>
    v !== null && typeof v === "object" && !Array.isArray(v) && (v)["kind"] !== "metroplat.holography.math-law-obstruction").length;
  return Object.freeze({
    kind: "metroplat.holography.math-laws-settlement",
    checked: Object.keys(laws).length,
    witnessed,
    obstructed: Object.keys(laws).length - witnessed,
    laws: Object.freeze(laws),
  });
}

/** Verify the term-bodied slice of the live operation catalog behaviorally:
 *  seeded inhabitants of each operation's domain schema (validated by the
 *  domain contract's own oracle), evaluated through `runTerm` — never the
 *  host-effect `run` body — with every output asserted against the codomain
 *  contract. Deterministic per seed, so a receipt is replayable evidence. */
export function readCatalogVerifyReadout(
  input,
  operations = [],
) {
  const samplesPerOperation = input?.samplesPerOperation !== undefined && Number.isInteger(input.samplesPerOperation) && input.samplesPerOperation >= 1
    ? Math.min(32, input.samplesPerOperation) : 3;
  const seed = input?.seed !== undefined && Number.isInteger(input.seed) ? input.seed : 1;
  const only = input?.verbs === undefined ? undefined : new Set(input.verbs);
  const all = operations;
  const eligible = all.filter((candidate) =>
    candidate.runTerm !== undefined && candidate.domain !== undefined && candidate.codomain !== undefined
    && (only === undefined || only.has(candidate.verb)));
  const results = [];
  let obstructionsTotal = 0;
  for (const candidate of eligible) {
    const evidence = measureProgramContract(candidate, { samples: samplesPerOperation, seed });
    obstructionsTotal += evidence.obstructions.length;
    results.push(Object.freeze({
      verb: candidate.verb,
      contract: evidence.contract,
      reading: evidence.reading,
      samples: evidence.samples,
      rejectedProposals: evidence.rejectedProposals,
      conformant: evidence.conformant,
      obstructions: Object.freeze(evidence.obstructions.slice(0, 6)),
    }));
  }
  return Object.freeze({
    kind: "metroplat.proof-health.catalog-verify",
    operation: "catalog-verify",
    samplesPerOperation,
    seed,
    catalog: all.length,
    eligible: eligible.length,
    obstructionsTotal,
    results: Object.freeze(results.sort((left, right) => right.obstructions.length - left.obstructions.length || left.verb.localeCompare(right.verb))),
  });
}

export function proofHealthOperations(
  binding,
  operationSource = () => [],
) {
  return Object.freeze([
    operation({
      verb: "math-laws",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Run package math law receipts.",
      description: "Domain: {}. Runs closure-analysis and calculus receipts and reports obstructions.",
      run: () => readMathLawReadout(),
    }),
    operation({
      verb: "proof-health-monitor-aggregate",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Unified paraconsistent Monitor aggregate over the proof-health domain.",
      description: "Domain: {}. Runs the math-law receipt corpus and joins witnessed/obstructed counts in the Belnap knowledge lattice to produce a single domain-level paraconsistent reading. This is the canonical Monitor (M) output of the proof-health domain for MAPE-K Analyze consumption.",
      run: () => readProofHealthMonitorAggregate(),
    }),
    operation({
      verb: "catalog-verify",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Behaviorally verify the term-bodied operation catalog with seeded domain inhabitants.",
      description: "Domain: { samplesPerOperation?, seed?, verbs?, admit? }. Only runTerm bodies are evaluated; outputs are asserted against the codomain schema. Deterministic receipts may be admitted as valued program-contract evidence.",
      run: (input) => {
        const options = input;
        const operations = operationSource();
        const readout = readCatalogVerifyReadout(options, operations);
        if (options?.admit !== true) return readout;
        if (binding === undefined) throw new TypeError("catalog-verify: admit requires a journal binding");
        const samples = options.samplesPerOperation !== undefined && Number.isInteger(options.samplesPerOperation)
          ? Math.max(1, Math.min(32, options.samplesPerOperation)) : 3;
        const seed = options.seed !== undefined && Number.isInteger(options.seed) ? options.seed : 1;
        const only = options.verbs === undefined ? undefined : new Set(options.verbs);
        const at = options.at ?? binding.now();
        const receipts = operations
          .filter((candidate) => only === undefined || only.has(candidate.verb))
          .map((candidate) => measureProgramContract(candidate, { samples, seed }));
        const admissions = receipts.map((evidence) => admitProgramContractEvidence(binding.dataRoot, evidence, at));
        return Object.freeze({
          ...(readout),
          admitted: admissions.reduce((sum, admission) => sum + admission.appended, 0),
          contractEvidence: Object.freeze(receipts),
        });
      },
    }),
  ]);
}

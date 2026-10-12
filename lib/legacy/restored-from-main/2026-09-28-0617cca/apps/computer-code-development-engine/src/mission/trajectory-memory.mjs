import { fileURLToPath } from "node:url";
import { EMPTY_WITNESS_ROOT, identifyJsonSemanticContent } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/runtime";
import { createSemanticRecordJournal } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-eavt/record-semantic-record";

export const TRAJECTORY_MEMORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const DEFAULT_TRAJECTORY_MEMORY_DATA_ROOT = fileURLToPath(new URL("../../data", import.meta.url));
export const TRAJECTORY_CATEGORY = "software-trajectory-memory.transition";
export const MISSION_EXECUTION_ACTOR = "urn:ame:computer-code-development-engine";
const RECORD_KIND = "software-trajectory-memory.record";

function senId(value) { return identifyJsonSemanticContent({ objectKind: RECORD_KIND, value, witnessRoot: EMPTY_WITNESS_ROOT }).id; }
function typedRecord(body) { return Object.freeze({ id: senId(body), ...body }); }

function tokens(text) {
  return new Set(String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) || []);
}

function score(a, b) {
  const left = tokens(a), right = tokens(b);
  if (!left.size || !right.size) return { numerator: "0", denominator: "1" };
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return {
    numerator: String(overlap * overlap),
    denominator: String(left.size * right.size),
  };
}

function compareFractions(left, right) {
  const lhs = BigInt(left.numerator) * BigInt(right.denominator);
  const rhs = BigInt(right.numerator) * BigInt(left.denominator);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

async function allRows({ dataRoot = DEFAULT_TRAJECTORY_MEMORY_DATA_ROOT, journal } = {}) {
  const records = (journal ?? createSemanticRecordJournal({ root: dataRoot, objectKind: RECORD_KIND })).query({ category: TRAJECTORY_CATEGORY });
  return records.map(({ record }) => record);
}
function projectedRecord(record) {
  if (record?.type === "SoftwareMissionCheckpoint") return record;
  if (record?.type === "SoftwareMissionCustomerAcceptedTrajectoryFoldback") return record;
  if (record?.type !== "SoftwareMissionTrajectory") return null;
  return {
    type: record.type, id: record.id, objective: record.objective,
    taskClass: record.taskClass ?? null, finishedAt: record.finishedAt ?? null,
    outcome: {
      verified: record.outcome?.verified === true,
      promotable: record.outcome?.promotable === true,
      changedPaths: record.outcome?.changedPaths ?? [],
      selectedActions: record.outcome?.selectedActions ?? [],
      summary: record.outcome?.summary ?? "",
      trajectoryFingerprint: record.outcome?.trajectoryFingerprint ?? null,
      trajectoryRecipeFingerprint: record.outcome?.trajectoryRecipeFingerprint ?? null,
      proposal: record.outcome?.proposal == null ? null : {
        proposalOnly: record.outcome.proposal.proposalOnly === true,
        customerMutation: record.outcome.proposal.customerMutation === true,
        trajectoryFingerprint: record.outcome.proposal.trajectoryFingerprint ?? null,
        trajectoryRecipeFingerprint: record.outcome.proposal.trajectoryRecipeFingerprint ?? null,
      },
    },
    metrics: {
      inferenceContacts: record.metrics?.inferenceContacts ?? null,
      usefulCompletions: record.metrics?.usefulCompletions ?? null,
    },
    processNode: record.processNode == null ? null : {
      refusal: record.processNode.refusal ?? null,
      providers: record.processNode.providers ?? [],
    },
  };
}
async function projectedRows(options = {}) {
  return (await allRows(options)).map(projectedRecord).filter((record) => record !== null);
}

export function trajectoryFingerprint(actions = []) {
  const shape = actions.map((action) => ({ action: action.action, args: Object.keys(action.args || {}).filter((key) => action.args[key] !== null).sort() }));
  return senId({ type: "SoftwareTrajectoryShape", actions: shape });
}

function replayActions(actions = []) {
  return actions.filter((action) => action && typeof action.action === "string" && action.args && typeof action.args === "object")
    .map(({ action, args }) => ({ action, args }));
}

export function trajectoryRecipeFingerprint(actions = []) {
  return senId({ type: "SoftwareTrajectoryRecipe", actions: replayActions(actions) });
}

export function deriveInducedTrajectoryResolver(rows, taskClass) {
  if (!taskClass) return { eligible: false, reason: "task-class-absent", attempts: 0, verified: 0 };
  const customerAccepted = new Set(rows.filter((row) => row?.type === "SoftwareMissionCustomerAcceptedTrajectoryFoldback").map((row) => row.trajectory));
  const attempts = rows.filter((row) => row?.type === "SoftwareMissionTrajectory" && row.taskClass === taskClass);
  const verified = attempts.filter((row) => row.outcome?.verified === true && (row.outcome?.promotable === true || customerAccepted.has(row.id)) && replayActions(row.outcome?.selectedActions).some(({ action }) => action === "edit"));
  const clusters = new Map();
  for (const row of verified) {
    const actions = replayActions(row.outcome.selectedActions), fingerprint = trajectoryRecipeFingerprint(actions);
    const cluster = clusters.get(fingerprint) ?? { fingerprint, actions, count: 0, witnesses: [] };
    cluster.count += 1;
    cluster.witnesses.push(row.id);
    clusters.set(fingerprint, cluster);
  }
  const dominant = [...clusters.values()].sort((left, right) => right.count - left.count || left.fingerprint.localeCompare(right.fingerprint))[0] ?? null;
  const eligible = clusters.size === 1 && Boolean(dominant);
  const verifiedFraction = {
    numerator: String(verified.length),
    denominator: String(attempts.length || 1),
  };
  return {
    eligible,
    reason: eligible ? "exact-customer-accepted-recipe-without-accepted-contradiction" : "no-unique-customer-accepted-recipe",
    taskClass,
    attempts: attempts.length,
    verified: verified.length,
    verifiedFraction,
    dominantFingerprint: dominant?.fingerprint ?? null,
    dominantCount: dominant?.count ?? 0,
    actions: eligible ? dominant.actions : [],
    witnesses: eligible ? dominant.witnesses : [],
    resolverId: eligible ? dominant.fingerprint : null,
  };
}

export async function inducedTrajectoryResolver(taskClass, { rows: suppliedRows, ...options } = {}) {
  return deriveInducedTrajectoryResolver(suppliedRows ?? await projectedRows(options), taskClass);
}

export async function recallTrajectories(objective, { taskClass = null, rows: suppliedRows, ...options } = {}) {
  const rows = (suppliedRows ?? await projectedRows(options))
    .filter((row) => row?.type === "SoftwareMissionTrajectory")
    .filter((row) => !taskClass || row.taskClass === taskClass)
    .map((row) => ({ row, similarity: score(objective, row.objective) }))
    .filter((entry) => entry.similarity.numerator !== "0");
  const verified = rows.filter(({ row }) => row.outcome?.verified === true && row.outcome?.promotable === true)
    .sort((a, b) => compareFractions(b.similarity, a.similarity))
    .map(({ row, similarity }) => ({
      similarity,
      objective: row.objective,
      changedPaths: row.outcome.changedPaths ?? [],
      inferenceContacts: row.metrics?.inferenceContacts ?? null,
      usefulCompletions: row.metrics?.usefulCompletions ?? null,
      summary: row.outcome.summary ?? "",
      taskClass: row.taskClass ?? null,
      trajectoryFingerprint: row.outcome.trajectoryFingerprint ?? null,
      verifiedActions: row.outcome.selectedActions || [],
    }));
  const failed = rows.filter(({ row }) => row.outcome?.verified !== true);
  const refusals = new Map();
  for (const { row } of failed) {
    const refusal = row.processNode?.refusal;
    const type = refusal?.type;
    if (typeof type !== "string" || !type) continue;
    const entry = refusals.get(type) ?? { type, count: 0, providers: new Set(), schemaAssays: new Set(), problems: new Set(), reasons: new Set(), witnesses: [], latest: null };
    entry.count += 1;
    if (typeof refusal.provider === "string" && refusal.provider) entry.providers.add(refusal.provider);
    for (const provider of row.processNode.providers ?? []) if (typeof provider === "string" && provider) entry.providers.add(provider);
    if (typeof refusal.schemaAssay === "string" && refusal.schemaAssay) entry.schemaAssays.add(refusal.schemaAssay);
    for (const problem of refusal.problems ?? []) if (typeof problem === "string" && problem) entry.problems.add(problem);
    if (typeof refusal.reason === "string" && refusal.reason) entry.reasons.add(refusal.reason);
    for (const residue of refusal.settlementResidues ?? []) {
      if (typeof residue?.provider === "string" && residue.provider) entry.providers.add(residue.provider);
      if (typeof residue?.reason === "string" && residue.reason) entry.reasons.add(residue.reason);
    }
    for (const marketResidue of refusal.market ?? []) {
      if (typeof marketResidue?.actor === "string" && marketResidue.actor) entry.providers.add(marketResidue.actor);
      if (typeof marketResidue?.reason === "string" && marketResidue.reason) entry.reasons.add(marketResidue.reason);
    }
    entry.witnesses.push(row.id);
    const latest = {
      at: typeof row.finishedAt === "string" ? row.finishedAt : "",
      witness: row.id,
      schemaAssay: typeof refusal.schemaAssay === "string" ? refusal.schemaAssay : null,
      problems: (refusal.problems ?? []).filter((problem) => typeof problem === "string" && problem),
      reasons: typeof refusal.reason === "string" && refusal.reason ? [refusal.reason] : [],
    };
    if (!entry.latest || latest.at > entry.latest.at || (latest.at === entry.latest.at && String(latest.witness).localeCompare(String(entry.latest.witness)) > 0)) entry.latest = latest;
    refusals.set(type, entry);
  }
  const clusters = [...refusals.values()];
  const latestCluster = clusters
    .filter((cluster) => cluster.latest)
    .sort((left, right) => right.latest.at.localeCompare(left.latest.at) || right.latest.witness.localeCompare(left.latest.witness))[0] ?? null;
  const selectedClusters = [
    ...(latestCluster ? [latestCluster] : []),
    ...clusters.sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
  ].filter((cluster, index, all) => all.findIndex((candidate) => candidate.type === cluster.type) === index);
  const residueKnowledge = selectedClusters
    .map((cluster) => {
      const strategy = /timeout|capacity|bound|oversiz|transport/u.test(cluster.type)
        ? "decompose-context-and-output"
        : /schema|invalid-action|malformed/u.test(cluster.type)
          ? "induce-deterministic-validator-or-translator"
          : /capability|no-feasible|unavailable/u.test(cluster.type)
            ? "induce-smaller-capability-enterprise"
            : "form-one-smaller-proof-obligation";
      return {
        type: "SoftwareTrajectoryResidueKnowledge",
        objective,
        dominantRefusal: cluster.type,
        occurrences: cluster.count,
        providers: [...cluster.providers].sort(),
        schemaAssays: [...cluster.schemaAssays].sort(),
        problems: [...cluster.problems].sort(),
        latestSchemaAssay: cluster.latest?.schemaAssay ?? null,
        latestProblems: cluster.latest?.problems ?? [],
        latestReasons: cluster.latest?.reasons ?? [],
        latestWitness: cluster.latest?.witness ?? null,
        reasons: [...cluster.reasons].sort(),
        witnesses: [...new Set(cluster.witnesses)].sort(),
        strategy,
        capabilityFormationRequired: true,
        nextAct: "advertise-capability-formation-demand",
      };
    });
  return [...verified, ...residueKnowledge];
}

export async function promotionReadout(taskClass, { rows: suppliedRows, ...options } = {}) {
  return deriveInducedTrajectoryResolver(suppliedRows ?? await projectedRows(options), taskClass);
}

/** Project every memory face needed to start one mission from one immutable
 * category snapshot.  This is a query projection, not a new aggregate owner:
 * checkpoint, recall, resolver, and promotion retain their existing laws while
 * the carrier is hydrated exactly once. */
export async function missionMemoryContext(objective, taskClass, missionId, sourceIdentity, { rows: suppliedRows, ...options } = {}) {
  const rows = suppliedRows ?? await projectedRows(options);
  return Object.freeze({
    checkpoint: await latestMissionCheckpoint(missionId, sourceIdentity, { rows }),
    memories: await recallTrajectories(objective, { taskClass, rows }),
    resolver: deriveInducedTrajectoryResolver(rows, taskClass),
    promotion: deriveInducedTrajectoryResolver(rows, taskClass),
  });
}

export async function appendMissionCheckpoint(checkpoint, options = {}) {
  if (checkpoint?.type !== "SoftwareMissionCheckpoint" || typeof checkpoint.missionId !== "string"
      || !checkpoint.missionId || typeof checkpoint.sourceIdentity !== "string" || !checkpoint.sourceIdentity) {
    throw new Error("software mission checkpoint requires one mission and immutable source identity");
  }
  const prior = await latestMissionCheckpoint(checkpoint.missionId, checkpoint.sourceIdentity, options);
  const expectedOrdinal = (BigInt(prior?.ordinal ?? 0) + 1n).toString();
  if (checkpoint.ordinal !== expectedOrdinal || checkpoint.parentCheckpoint !== (prior?.id ?? null)) {
    throw new Error("software mission checkpoint does not extend the current causal head");
  }
  return appendTrajectoryRecord(checkpoint, checkpoint.recordedAt, options);
}

export async function latestMissionCheckpoint(missionId, sourceIdentity, { rows: suppliedRows, ...options } = {}) {
  if (typeof missionId !== "string" || !missionId || typeof sourceIdentity !== "string" || !sourceIdentity) {
    throw new Error("checkpoint lookup requires one mission and immutable source identity");
  }
  return (suppliedRows ?? await projectedRows(options))
    .filter((row) => row?.type === "SoftwareMissionCheckpoint"
      && row.missionId === missionId && row.sourceIdentity === sourceIdentity)
    .sort((left, right) => {
      const leftOrdinal = BigInt(left.ordinal ?? 0), rightOrdinal = BigInt(right.ordinal ?? 0);
      return leftOrdinal < rightOrdinal ? 1 : leftOrdinal > rightOrdinal ? -1
        : String(right.id ?? "").localeCompare(String(left.id ?? ""));
    })[0] ?? null;
}

export async function appendTrajectory(record, options = {}) {
  return appendTrajectoryRecord(record, record.finishedAt, options);
}

export async function appendTrajectoryRecord(record, recordedAt, {
  dataRoot = DEFAULT_TRAJECTORY_MEMORY_DATA_ROOT,
  journal,
} = {}) {
  const verified = record?.type !== "SoftwareMissionTrajectory" || record.outcome?.verified === true;
  const receipt = (journal ?? createSemanticRecordJournal({ root: dataRoot, objectKind: RECORD_KIND })).record({
    category: TRAJECTORY_CATEGORY,
    recordedAt,
    record,
    told: { for: verified, against: !verified },
    relation: {
      subject: record?.missionId ?? record?.id ?? MISSION_EXECUTION_ACTOR,
      predicate: record?.type ?? "records",
      object: MISSION_EXECUTION_ACTOR,
    },
  });
  return Object.freeze({ ...receipt, documentNi: receipt.id, reference: null });
}

export async function admitCustomerTrajectoryFoldback(activity, {
  expectedCustomer,
  expectedSupplier,
  rows: suppliedRows,
  dataRoot = DEFAULT_TRAJECTORY_MEMORY_DATA_ROOT,
  journal,
  append = (value, at) => appendTrajectoryRecord(value, at, { dataRoot, journal }),
} = {}) {
  const rows = suppliedRows ?? await projectedRows({ dataRoot, journal });
  const decision = activity?.object, foldback = decision?.foldbackSnapshot;
  const exact = (value) => value?.id === senId(Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => key !== "id")));
  if (typeof expectedSupplier !== "string" || !expectedSupplier || activity?.["@context"] !== "https://www.w3.org/ns/activitystreams" || activity.type !== "Accept" || activity.actor !== expectedCustomer || activity.target !== expectedSupplier || !exact(decision) || decision.type !== "ImprovementCustomerDecision" || decision.accepted !== true || decision.customer !== expectedCustomer || decision.supplier !== expectedSupplier) throw new Error("exact customer-authored accepted improvement decision is required");
  if (!exact(foldback) || decision.foldback !== foldback.id || foldback.type !== "ImprovementFoldback" || foldback.customer !== expectedCustomer || foldback.supplier !== expectedSupplier || foldback.candidate !== decision.candidate || foldback.route?.executionProvider !== MISSION_EXECUTION_ACTOR || foldback.routePolicy !== "enterprise-memory-pulse-only") throw new Error("customer decision requires one exact execution-provider-bound foldback snapshot");
  const trajectory = rows.find((row) => row?.type === "SoftwareMissionTrajectory" && row.id === foldback.route?.supplierTrajectory);
  const proposal = trajectory?.outcome?.proposal;
  if (!trajectory || trajectory.outcome?.verified !== true || proposal?.proposalOnly !== true || proposal.customerMutation !== false || foldback.route?.trajectoryFingerprint !== proposal.trajectoryFingerprint || foldback.route?.trajectoryRecipeFingerprint !== proposal.trajectoryRecipeFingerprint) throw new Error("customer foldback does not bind one exact verified proposal-only supplier trajectory");
  const body = {
    type: "SoftwareMissionCustomerAcceptedTrajectoryFoldback", executionProvider: MISSION_EXECUTION_ACTOR, supplier: expectedSupplier, customer: expectedCustomer,
    trajectory: trajectory.id, taskClass: trajectory.taskClass, customerDecision: decision.id, customerFoldback: foldback.id,
    candidate: decision.candidate, acceptedAt: foldback.acceptedAt, trajectoryFingerprint: proposal.trajectoryFingerprint,
    trajectoryRecipeFingerprint: proposal.trajectoryRecipeFingerprint, customerReplay: foldback.customerReplay,
    routePolicy: "enterprise-memory-pulse-only", customerTerritoryMutation: false,
  };
  const admitted = typedRecord(body), prior = rows.find((row) => row?.id === admitted.id);
  if (prior) return Object.freeze({ status: "replayed", record: prior });
  await append(admitted, foldback.acceptedAt);
  return Object.freeze({ status: "admitted", record: admitted });
}

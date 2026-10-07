/** Agent operations application service. */
import path from "node:path";

import { recurringVerbSequences } from "@red-cup-engineering/metrologic/number-theory/sequence-recurrence";

import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { rpcAdmittedStepCollector, rpcStepRowOf } from "@red-cup-engineering/computer-system-engine/journal/reading/rpc-sequence";

import { parse } from "@red-cup-engineering/json-services-section";
import { dataDatePartition } from "@red-cup-engineering/eavt/data-artifact-address";

import { journal } from "@red-cup-engineering/computer-system-engine/journal/journal";
import { readFeedProjection } from "@red-cup-engineering/feltos/agents/feed-readout";
import { sessionPresenceReadout } from "@red-cup-engineering/agent-harness-computer-system-engineering-services-section/session-presence";
import { readClaudeAgentFleetReadout } from "@red-cup-engineering/feltos/agents/sessions/claude-code/fleet/service";
import {
  readAgentSessionTokenUsageReadout,
  tokenCostRateTableOf,
  tokenCostRatesOf,
} from "@red-cup-engineering/feltos/agents/sessions/token-usage/service";
import { readCodexLatestTranscriptStatus, readCodexSessionToolStudyCorpus } from "@red-cup-engineering/feltos/agents/sessions/codex/service";
import { readCodexMemoryPriorContext } from "@red-cup-engineering/feltos/agents/sessions/codex/memory-substrate";
import { readInferenceCostReadout } from "@red-cup-engineering/computer-inference-engine/openai/pricing/operations";
import { readAgentWorkDispatchReadout, readDutiesView, workCoordinationOperations } from "@red-cup-engineering/feltos/work/service";
import { createOperationCatalog } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { authorizationFromStanding } from "@red-cup-engineering/computer-system-engine/rpc/dispatch";
import { journalRpcWitness } from "@red-cup-engineering/computer-system-engine/rpc/journal-witness";
import { sourceCodePolicyOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/operations";
import { proofHealthOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/proof-health";
import {
  agentActuationDossier,
  agentActuationPlan,
  executeAgentActuationPlan,

} from "@red-cup-engineering/feltos/agents/actuation";
import { agentContextImage, agentContextPageMaterial, diagnoseAgentContext } from "@red-cup-engineering/feltos/agents/context-image";
import { agentDoctrineSuit } from "./doctrine.mjs";
import { agentHeartbeatDossier } from "@red-cup-engineering/feltos/agents/heartbeat";
import { agentOperationsDossier } from "./operations.mjs";
import { agentOrientationReadout } from "./orientation.mjs";
import { agentSkillProposalDossier } from "./skill-proposals.mjs";
import { agentStrategyDossier } from "@red-cup-engineering/feltos/agents/strategy";
import { agentTurnDossier } from "@red-cup-engineering/feltos/agents/turn";
import { eavtRecord } from "@red-cup-engineering/eavt/row";
import { codeDevelopmentAgentDomain as domain } from "./code-development-domain.mjs";

/** Keep one synchronous autonomic actuation inside an interactive turn. A
 * truncated result is explicitly marked and diagnoses as unknown, never as a
 * whole-codebase verdict. */
const AGENT_ACTUATION_SOURCE_FILE_LIMIT = 64;

function todayIso(binding) {
  return binding.now().slice(0, 10);
}

function agentCoordinationInputOf(input, binding) {
  const record = input !== null && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  const date = typeof record["date"] === "string" ? record["date"] : todayIso(binding);
  const id = typeof record["id"] === "string" ? record["id"] : undefined;
  const query = typeof record["query"] === "string" ? record["query"] : undefined;
  const observation = record["observation"];
  const diagnosis = record["diagnosis"];
  const tokenCostRates = tokenCostRatesOf(record["tokenCostRates"]);
  const tokenCostRateTable = tokenCostRateTableOf(record["tokenCostRateTable"]);
  return Object.freeze({
    date,
    ...(id === undefined ? {} : { id }),
    ...(query === undefined ? {} : { query }),
    ...(observation === undefined ? {} : { observation }),
    ...(diagnosis === undefined ? {} : { diagnosis }),
    ...(tokenCostRates === undefined ? {} : { tokenCostRates }),
    ...(tokenCostRateTable === undefined ? {} : { tokenCostRateTable }),
  });
}

function artifactByToken(binding, date, token) {
  for (let back = 0; back < 2; back += 1) {
    const at = new Date(new Date(`${date}T00:00:00Z`).getTime() - back * 86_400_000).toISOString().slice(0, 10);
    const { year, month, day } = dataDatePartition(at);
    const artifactPath = path.join(binding.dataRoot, "data", "state", year, month, day, `${at}-settle-${token}.json`);
    if (!binding.pathExists(artifactPath)) continue;
    const parsed = parse(binding.readFileUtf8(artifactPath));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function noteFailure(failures, token) {
  return (reason) => { failures.push(`${token}: ${reason}`); };
}

function inferenceCostOf(input, binding, onError) {
  try {
    return readInferenceCostReadout(binding, input.date);
  } catch (error) {
    onError(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function workDispatchOf(input, binding, onError) {
  try {
    return readAgentWorkDispatchReadout(binding, input.date, input.id);
  } catch (error) {
    onError(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function doctrineDateOf(head) {
  const match = /^(date-created|date):\s*"?([^"\n]+)"?\s*$/mu.exec(head);
  return match?.[2]?.trim();
}

function doctrineReadingOf(head, sourceRoot) {
  if (sourceRoot.endsWith("orientation")) return "denied";
  const match = /^status:\s*"?([^"\n]+)"?\s*$/imu.exec(head);
  const status = match?.[1]?.toLowerCase() ?? "";
  return status.includes("operating doctrine") ? "denied" : undefined;
}

function doctrineMaterialOfFile(binding, filePath, sourceRoot, corpusRoot) {
  const stat = binding.statPathOrNull(filePath);
  if (stat === null || stat.size === 0) return undefined;
  const text = binding.readFileHeadUtf8(filePath, 4096);
  const relative = path.relative(corpusRoot, filePath).split(path.sep).join("/");
  const at = doctrineDateOf(text);
  const reading = doctrineReadingOf(text, sourceRoot);
  return Object.freeze({
    path: `${sourceRoot}/${relative.length === 0 ? path.basename(filePath) : relative}`,
    text,
    sourceRoot,
    bytes: stat.size,
    ...(at === undefined ? {} : { at }),
    ...(reading === undefined ? {} : { reading }),
  });
}

function doctrineMaterials(binding) {
  const materials = [];
  const seen = new Set();
  const addFile = (filePath, sourceRoot, corpusRoot) => {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved) || !binding.pathExists(resolved)) return;
    seen.add(resolved);
    let material;
    try {
      material = doctrineMaterialOfFile(binding, resolved, sourceRoot, corpusRoot);
    } catch {
      return;
    }
    if (material !== undefined) materials.push(material);
  };
  const packageRoot = binding.packageRoot === undefined ? undefined : path.resolve(binding.packageRoot);
  for (const fileName of ["README.md", "AGENTS.md"]) {
    addFile(path.join(binding.dataRoot, fileName), "data-root-orientation", binding.dataRoot);
    if (packageRoot !== undefined) addFile(path.join(packageRoot, fileName), "package-orientation", packageRoot);
  }
  const addNotesRoot = (root, sourceRoot) => {
    if (!binding.pathExists(root)) return;
    for (const filePath of binding.walkFiles(root, {
      includeFile: (name) => name.endsWith(".md"),
      skipSymbolicLinks: true,
    })) {
      addFile(filePath, sourceRoot, root);
    }
  };
  if (packageRoot !== undefined) {
    addNotesRoot(path.join(packageRoot, "dev", "content", "notes"), "metroplat-notes");
    addNotesRoot(path.resolve(packageRoot, "..", "..", "..", "services", "561-group", "services", "lenticule-science", "src", "dev", "content", "notes"), "obsmetrologia-notes");
  }
  addNotesRoot(path.join(binding.dataRoot, "dev", "content", "notes"), "data-root-notes");
  return Object.freeze(materials);
}

/** One date's admitted RPC steps, in time order, and how many rows were read. A day of RPC
 * evidence outgrows the heap, so rows are reduced to their steps as they are scanned. */
function admittedRpcSteps(binding, date) {
  const logPath = journal.feed(binding.dataRoot, "rpc", date, { subject: "rpc" });
  if (!journal.sourceStatus(logPath).exists) return undefined;
  const collector = rpcAdmittedStepCollector();
  let rows = 0;
  try {
    const stepRows = [];
    const folded = journal.scan(logPath, undefined, (_accum, row) => {
      const stepRow = rpcStepRowOf(row);
      if (stepRow !== undefined) stepRows.push(stepRow);
      return undefined;
    });
    rows = folded.rows;
    for (const row of stepRows.sort((left, right) => String(left[3]).localeCompare(String(right[3])))) {
      collector.push(row);
    }
  } catch {
    return undefined;
  }
  return Object.freeze({ steps: collector.read(), rows });
}

export function readAgentSkillCandidatesReadout(binding, date) {
  const admitted = admittedRpcSteps(binding, date);
  if (admitted === undefined) return undefined;
  const { steps, rows } = admitted;
  const reading = recurringVerbSequences(steps);
  const actors = new Set(steps.map((step) => step.actor));
  return Object.freeze({
    kind: "metroplat.holography.skill-candidates-settlement",
    date,
    source: "rpc-journal",
    note: "Candidates are recurring verb chains derived from canonical RPC attempt/outcome evidence, not skills. Promotion to an executable procedure is a separate, operator-ruled step, never taken automatically here.",
    minLength: reading.minLength,
    maxLength: reading.maxLength,
    rowsConsidered: rows,
    actorsConsidered: actors.size,
    candidates: reading.candidates,
  });
}

export function readAgentSkillProposalsReadout(binding, date) {
  const admitted = admittedRpcSteps(binding, date);
  if (admitted === undefined) return undefined;
  const { steps, rows } = admitted;
  const reading = recurringVerbSequences(steps);
  const actors = new Set(steps.map((step) => step.actor));
  return Object.freeze({
    ...agentSkillProposalDossier(reading, {
      date,
      source: "rpc-journal",
    }),
    rowsConsidered: rows,
    actorsConsidered: actors.size,
  });
}

export async function readAgentOrientationReadout(binding, input) {
  const failures = [];
  const topology = record(artifactByToken(binding, input.date, "module-topology"));
  let fleet;
  try {
    fleet = record(await readClaudeAgentFleetReadout(binding, input.date));
  } catch (error) {
    noteFailure(failures, "claude-fleet")(error instanceof Error ? error.message : String(error));
  }
  let hookState;
  try {
    hookState = record(readFeedProjection(binding.dataRoot, input.date, "hook-event"));
  } catch (error) {
    noteFailure(failures, "settlement-hook-event")(error instanceof Error ? error.message : String(error));
  }
  const fileCensus = record(artifactByToken(binding, input.date, "file-census"));
  let codex;
  if (binding.codexSessionRoot !== undefined) {
    try {
      codex = record(readCodexLatestTranscriptStatus(binding.codexSessionRoot, input.date, binding));
    } catch (error) {
      noteFailure(failures, "codex-latest")(error instanceof Error ? error.message : String(error));
    }
  }
  let presence;
  try {
    presence = record(sessionPresenceReadout(binding, input.date));
  } catch (error) {
    noteFailure(failures, "session-presence")(error instanceof Error ? error.message : String(error));
  }
  let doctrine;
  try {
    doctrine = agentDoctrineSuit(doctrineMaterials(binding), {
      ...(input.query === undefined ? {} : { query: input.query }),
    });
  } catch (error) {
    noteFailure(failures, "doctrine-suit")(error instanceof Error ? error.message : String(error));
  }
  const dutiesCountOf = async (sessionId) => {
    if (typeof sessionId !== "string") return 0;
    let dutiesRead;
    try {
      dutiesRead = readDutiesView(binding, input.date, sessionId);
    } catch (error) {
      noteFailure(failures, "duties")(error instanceof Error ? error.message : String(error));
    }
    const duties = record(dutiesRead)?.["duties"];
    return Array.isArray(duties) ? duties.length : 0;
  };
  return await agentOrientationReadout({
    date: input.date,
    ...(topology === undefined ? {} : { topology }),
    ...(fleet === undefined ? {} : { fleet }),
    ...(hookState === undefined ? {} : { hookState }),
    ...(fileCensus === undefined ? {} : { fileCensus }),
    ...(codex === undefined ? {} : { codex }),
    ...(presence === undefined ? {} : { presence }),
    ...(doctrine === undefined ? {} : { doctrine }),
    failures,
    dutiesCountOf,
  });
}

export async function readAgentStrategyReadout(binding, input) {
  const failures = [];
  const suppliedObservation = record(input.observation);
  if (suppliedObservation !== undefined && suppliedObservation["kind"] !== "metroplat.agent.context-image") {
    throw new TypeError("agent-strategy observation must be an metroplat.agent.context-image");
  }
  const observation = suppliedObservation
    ?? await readAgentContextImageReadout(binding, input);
  if (observation === undefined) return undefined;
  const suppliedDiagnosis = record(input.diagnosis);
  if (suppliedDiagnosis !== undefined && suppliedDiagnosis["kind"] !== "metroplat.agent.context-diagnosis") {
    throw new TypeError("agent-strategy diagnosis must be an metroplat.agent.context-diagnosis");
  }
  const diagnosis = suppliedDiagnosis ?? diagnoseAgentContext(observation, domain);
  const orientation = agentContextPageMaterial(observation, "page:orientation");
  const dispatch = agentContextPageMaterial(observation, "page:work-dispatch");
  const skillProposals = agentContextPageMaterial(observation, "page:skill-proposals");
  return agentStrategyDossier({
    domain,
    date: input.date,
    actor: input.id ?? domain.actor,
    goal: input.query ?? domain.goal,
    ...(orientation === undefined ? {} : { orientation }),
    diagnosis: diagnosis,
    ...(dispatch === undefined ? {} : { dispatch }),
    ...(skillProposals === undefined ? {} : { skillProposals }),
    failures,
  });
}

export async function readAgentDiagnosisReadout(binding, input) {
  const suppliedObservation = record(input.observation);
  if (suppliedObservation !== undefined && suppliedObservation["kind"] !== "metroplat.agent.context-image") {
    throw new TypeError("agent-diagnosis observation must be an metroplat.agent.context-image");
  }
  const observation = suppliedObservation
    ?? await readAgentContextImageReadout(binding, input);
  return observation === undefined ? undefined : diagnoseAgentContext(observation, domain);
}

export async function readAgentHeartbeatReadout(binding, input) {
  const failures = [];
  const strategy = await readAgentStrategyReadout(binding, input);
  let presence;
  try {
    presence = sessionPresenceReadout(binding, input.date);
  } catch (error) {
    noteFailure(failures, "session-presence")(error instanceof Error ? error.message : String(error));
  }
  const inferenceCost = inferenceCostOf(input, binding, noteFailure(failures, "inference-cost"));
  return agentHeartbeatDossier({
    date: input.date,
    actor: input.id ?? domain.actor,
    goal: input.query ?? domain.goal,
    ...(strategy === undefined ? {} : { strategy }),
    ...(presence === undefined ? {} : { presence }),
    ...(inferenceCost === undefined ? {} : { inferenceCost }),
    failures,
  });
}

export async function readAgentTurnReadout(binding, input) {
  const failures = [];
  const heartbeat = await readAgentHeartbeatReadout(binding, input);
  const orientation = await readAgentOrientationReadout(binding, input);
  const strategy = await readAgentStrategyReadout(binding, input);
  const dispatch = workDispatchOf(input, binding, noteFailure(failures, "agent-work-dispatch"));
  const skillProposals = readAgentSkillProposalsReadout(binding, input.date);
  const inferenceCost = inferenceCostOf(input, binding, noteFailure(failures, "inference-cost"));
  return agentTurnDossier({
    date: input.date,
    actor: input.id ?? domain.actor,
    goal: input.query ?? domain.goal,
    ...(heartbeat === undefined ? {} : { heartbeat }),
    ...(orientation === undefined ? {} : { orientation }),
    ...(strategy === undefined ? {} : { strategy }),
    ...(dispatch === undefined ? {} : { dispatch }),
    ...(skillProposals === undefined ? {} : { skillProposals }),
    ...(inferenceCost === undefined ? {} : { inferenceCost }),
    failures,
  });
}

export async function readAgentOperationsReadout(binding, input) {
  const failures = [];
  const orientation = await readAgentOrientationReadout(binding, input);
  const strategy = await readAgentStrategyReadout(binding, input);
  const heartbeat = await readAgentHeartbeatReadout(binding, input);
  const turn = await readAgentTurnReadout(binding, input);
  const dispatch = workDispatchOf(input, binding, noteFailure(failures, "agent-work-dispatch"));
  const skillProposals = readAgentSkillProposalsReadout(binding, input.date);
  const inferenceCost = inferenceCostOf(input, binding, noteFailure(failures, "inference-cost"));
  let toolStudy;
  if (binding.codexSessionRoot !== undefined) {
    try {
      toolStudy = readCodexSessionToolStudyCorpus(binding.codexSessionRoot, {
        ...binding,
        date: input.date,
        sessionLimit: 12,
      });
    } catch (error) {
      noteFailure(failures, "codex-tool-study")(error instanceof Error ? error.message : String(error));
    }
  }
  return agentOperationsDossier({
    date: input.date,
    actor: input.id ?? domain.actor,
    goal: input.query ?? domain.goal,
    ...(orientation === undefined ? {} : { orientation }),
    ...(strategy === undefined ? {} : { strategy }),
    ...(heartbeat === undefined ? {} : { heartbeat }),
    ...(turn === undefined ? {} : { turn }),
    ...(dispatch === undefined ? {} : { dispatch }),
    ...(skillProposals === undefined ? {} : { skillProposals }),
    ...(inferenceCost === undefined ? {} : { inferenceCost }),
    ...(toolStudy === undefined ? {} : { toolStudy }),
    failures,
  });
}

/** A row's value dereferenced past one packet indirection. Rows heavier than
 * `STATEMENT_ROW_MAX_BYTES` (`src/journal/filesystem/index.mts`) are admitted
 * with their value replaced by a `metroplat.witness-packet-reference`
 * pointer — the real content-addressed monitor-aggregate outcomes this reads
 * back land well past that threshold. Reading the reference's `kind` in
 * place of the outcome silently found no `receipt.invocation.request` on
 * every packetized row, so every turn re-planned the same already-executed
 * move (the source of the "second actuation ... must not fire" regression). */
function dereferencedValue(feed, value, options) {
  const outer = record(value);
  if (outer?.["kind"] !== "metroplat.witness-packet-reference") return value;
  const path = outer["path"];
  if (typeof path !== "string") return value;
  try {
    return journal.readPacket(feed, path, options);
  } catch {
    return value;
  }
}

function executedActuationRequests(root, date, options) {
  const feed = journal.feed(root, "rpc", date, { subject: "rpc" });
  if (!journal.sourceStatus(feed).exists) return Object.freeze([]);
  const requests = [];
  try {
    journal.scan(feed, requests, (accumulator, row) => {
      const { a, v } = eavtRecord(row);
      const attribute = record(a);
      if (attribute?.["kind"] !== "metroplat.rpc.outcome") return accumulator;
      const outcome = record(dereferencedValue(feed, v, options));
      const receipt = record(outcome?.["receipt"]);
      const invoked = record(receipt?.["invocation"]);
      const request = invoked?.["request"];
      if (typeof request === "string" && request.startsWith("agent-actuation:")) accumulator.push(request);
      return accumulator;
    });
  } catch {
    return Object.freeze([]);
  }
  return Object.freeze(requests);
}

/** MAPE-K Execute + Knowledge: dispatch ready monitoring strategy moves to
 *  their mapped RPC operations through the catalog, journal the outcomes, and
 *  refresh the context-image monitoring page from the fresh aggregate so the
 *  post-execution diagnosis reflects the verified state on the same turn. */
export async function readAgentActuationReadout(binding, input) {
  const failures = [];
  const suppliedObservation = record(input.observation);
  if (suppliedObservation !== undefined && suppliedObservation["kind"] !== "metroplat.agent.context-image") {
    throw new TypeError("agent-actuation observation must be an metroplat.agent.context-image");
  }
  const observation = suppliedObservation
    ?? await readAgentContextImageReadout(binding, input);
  if (observation === undefined) return undefined;
  const suppliedDiagnosis = record(input.diagnosis);
  if (suppliedDiagnosis !== undefined && suppliedDiagnosis["kind"] !== "metroplat.agent.context-diagnosis") {
    throw new TypeError("agent-actuation diagnosis must be an metroplat.agent.context-diagnosis");
  }
  const diagnosis = suppliedDiagnosis ?? record(diagnoseAgentContext(observation, domain));
  const diagnosisId = typeof diagnosis?.["id"] === "string" ? diagnosis["id"] : undefined;
  const monitoringClaimsOfDiagnosis = (value) =>
    Array.isArray(value?.["monitoringClaims"])
      ? Object.freeze(value["monitoringClaims"].map(record).flatMap((claim) =>
        typeof claim?.["key"] === "string" && typeof claim?.["reading"] === "string"
          ? [`${claim["key"]}:${claim["reading"]}`] : []))
      : Object.freeze([]);
  const monitoringClaimsBefore = monitoringClaimsOfDiagnosis(diagnosis);
  const strategy = record(await readAgentStrategyReadout(binding, Object.freeze({
    ...input,
    observation: observation,
    ...(diagnosis === undefined ? {} : { diagnosis: diagnosis }),
  })));
  const moves = Array.isArray(strategy?.["nextMoves"]) ? strategy["nextMoves"] : [];
  const plan = agentActuationPlan({
    domain,
    date: input.date,
    ...(diagnosisId === undefined ? {} : { diagnosis: diagnosisId }),
    moves,
    executedRequests: executedActuationRequests(binding.dataRoot, input.date, binding),
  });

  // The RPC catalog is the mux: monitoring operations execute through it directly.
  const catalog = createOperationCatalog([
    // The monitors reach the host through the binding's own effects, as infograph's catalog does.
    ...sourceCodePolicyOperations(binding),
    ...proofHealthOperations(binding),
  ]);
  const mappedVerbs = new Set(Object.values(domain.operations));
  const standing = new Map(catalog.operations
    .filter((candidate) => mappedVerbs.has(candidate.verb))
    .map((candidate) => [candidate.ref, "held"]));
  const authorize = authorizationFromStanding(standing, "agent-actuation-standing");
  const witness = journalRpcWitness(binding.dataRoot, {
    ...(binding.rootName === undefined ? {} : { namespace: binding.rootName }),
  });
  const now = binding.now;
  const actor = input.id ?? domain.actor;

  const executions = await executeAgentActuationPlan({
    plan, catalog, witness, authorize, now, actor, diagnosis: diagnosisId,
    inputFor: (planned) => planned.operation === "source-code-monitor-aggregate" ? { maxFiles: AGENT_ACTUATION_SOURCE_FILE_LIMIT } : {},
    resourceFor: (planned) => planned.operation === "proof-health-monitor-aggregate"
      ? "metroplat:monitoring:proof-health"
      : "metroplat:monitoring:source-code",
    onFailure: (reason) => { failures.push(reason); },
  });
  let refreshedMonitoring;
  let refreshedProofHealth;
  for (const execution of executions) {
    const outcome = record(execution.ok ? execution.outcome : undefined);
    if (outcome?.["kind"] === "metroplat.monitoring.source-code.aggregate") refreshedMonitoring = execution.outcome;
    if (outcome?.["kind"] === "metroplat.monitoring.aggregate" && outcome["name"] === "proof-health") refreshedProofHealth = execution.outcome;
  }

  // Knowledge writeback: refresh the monitoring page from the fresh aggregate
  // and re-diagnose, so the post-execution reading is visible this turn.
  let monitoringClaimsAfter = monitoringClaimsBefore;
  let contextImageId;
  if (refreshedMonitoring !== undefined || refreshedProofHealth !== undefined) {
    const priorMonitoring = refreshedMonitoring ?? agentContextPageMaterial(observation, "page:monitoring");
    const priorProofHealth = refreshedProofHealth ?? agentContextPageMaterial(observation, "page:proof-health");
    const priorOrientation = agentContextPageMaterial(observation, "page:orientation");
    const priorWorkDispatch = agentContextPageMaterial(observation, "page:work-dispatch");
    const priorSkillProposals = agentContextPageMaterial(observation, "page:skill-proposals");
    const priorTokenUsage = agentContextPageMaterial(observation, "page:token-window");
    const priorToolSurface = agentContextPageMaterial(observation, "page:tool-surface");
    const refreshedImage = agentContextImage({
    domain,
      date: input.date,
      actor,
      goal: input.query ?? domain.goal,
      ...(priorMonitoring === undefined ? {} : { monitoring: priorMonitoring }),
      ...(priorProofHealth === undefined ? {} : { proofHealth: priorProofHealth }),
      ...(priorOrientation === undefined ? {} : { orientation: priorOrientation }),
      ...(priorWorkDispatch === undefined ? {} : { workDispatch: priorWorkDispatch }),
      ...(priorSkillProposals === undefined ? {} : { skillProposals: priorSkillProposals }),
      ...(priorTokenUsage === undefined ? {} : { tokenUsage: priorTokenUsage }),
      ...(priorToolSurface === undefined ? {} : { toolSurface: priorToolSurface }),
      failures,
    });
    contextImageId = refreshedImage.id;
    const refreshedDiagnosis = record(diagnoseAgentContext(refreshedImage, domain));
    monitoringClaimsAfter = monitoringClaimsOfDiagnosis(refreshedDiagnosis);
  }

  return agentActuationDossier({
    date: input.date,
    actor,
    goal: input.query ?? domain.goal,
    ...(diagnosisId === undefined ? {} : { diagnosis: diagnosisId }),
    plan,
    executions,
    monitoringClaimsBefore,
    monitoringClaimsAfter,
    ...(contextImageId === undefined ? {} : { contextImage: contextImageId }),
    failures,
  });
}

export async function readAgentContextImageReadout(binding, input) {
  const failures = [];
  const orientation = await readAgentOrientationReadout(binding, input);
  const workDispatch = workDispatchOf(input, binding, noteFailure(failures, "agent-work-dispatch"));
  const skillProposals = readAgentSkillProposalsReadout(binding, input.date);
  const tokenUsage = readAgentSessionTokenUsageReadout(binding, {
    date: input.date,
    ...(input.tokenCostRates === undefined ? {} : { tokenCostRates: input.tokenCostRates }),
    ...(input.tokenCostRateTable === undefined ? {} : { tokenCostRateTable: input.tokenCostRateTable }),
  });
  const priorContext = binding.codexMemoryRoot === undefined
    ? undefined
    : readCodexMemoryPriorContext(binding.codexMemoryRoot, {
        ...binding,
        query: input.query ?? domain.goal,
      });
  const toolSurface = Object.freeze({
    kind: "metroplat.agent.tool-surface",
    source: "src/agents/service",
    actions: Object.freeze([
      ...agentCoordinationOperations(binding).map((act) => Object.freeze({
        verb: act.verb,
        transport: "agent-coordination",
        inputFormat: "json",
        outputFormat: "json",
      })),
      ...workCoordinationOperations(binding).map((act) => Object.freeze({
        verb: act.verb,
        transport: "work-coordination",
        inputFormat: "json",
        outputFormat: "json",
      })),
    ]),
    evidence: Object.freeze(["source:agent-coordination-actions"]),
  });
  return agentContextImage({
    domain,
    date: input.date,
    actor: input.id ?? domain.actor,
    goal: input.query ?? domain.goal,
    ...(orientation === undefined ? {} : { orientation }),
    ...(workDispatch === undefined ? {} : { workDispatch }),
    ...(skillProposals === undefined ? {} : { skillProposals }),
    ...(priorContext === undefined ? {} : { priorContext }),
    ...(tokenUsage === undefined ? {} : { tokenUsage }),
    toolSurface,
    failures,
  });
}

function readAgentCoordination(
  verb,
  binding,
  input,
) {
  if (verb === "orientation") return readAgentOrientationReadout(binding, input);
  if (verb === "skill-candidates") return readAgentSkillCandidatesReadout(binding, input.date);
  if (verb === "skill-proposals") return readAgentSkillProposalsReadout(binding, input.date);
  if (verb === "agent-diagnosis") return readAgentDiagnosisReadout(binding, input);
  if (verb === "agent-strategy") return readAgentStrategyReadout(binding, input);
  if (verb === "agent-heartbeat") return readAgentHeartbeatReadout(binding, input);
  if (verb === "agent-turn") return readAgentTurnReadout(binding, input);
  if (verb === "agent-operations") return readAgentOperationsReadout(binding, input);
  if (verb === "agent-actuation") return readAgentActuationReadout(binding, input);
  return readAgentContextImageReadout(binding, input);
}

export function agentCoordinationOperations(binding) {
  const operationOf = (verb) => operation({
    verb,
    inputFormat: "json",
    outputFormat: "json",
    summary: `Read ${verb} agent coordination material.`,
    description: "Domain: { date?, id?, query?, observation?, diagnosis?, tokenCostRates?, tokenCostRateTable? }. date defaults to the binding clock day; id selects the actor; query names the agent goal. agent-diagnosis may analyze a carried context-image observation; agent-strategy may plan from carried context-image and context-diagnosis predecessors.",
    run: async (input) => {
      const readInput = agentCoordinationInputOf(input, binding);
      return await readAgentCoordination(verb, binding, readInput) ?? null;
    },
  });
  return Object.freeze([
    operationOf("orientation"),
    operationOf("skill-candidates"),
    operationOf("skill-proposals"),
    operationOf("agent-diagnosis"),
    operationOf("agent-strategy"),
    operationOf("agent-heartbeat"),
    operationOf("agent-turn"),
    operationOf("agent-operations"),
    operationOf("agent-actuation"),
    operationOf("agent-context-image"),
  ]);
}

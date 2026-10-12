import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { semanticId } from "@red-cup-engineering/computer-content-engineering-services-section/semiotic-content-address";
import { createAgentTools, territorySnapshot } from "./agent-tools.mjs";
import { dispatchBatch as defaultDispatch } from "./market-client.mjs";
import { runTestsCommand } from "@red-cup-engineering/javascript-node-services-section/run-sandboxed-command";
import { appendMissionCheckpoint, appendTrajectory, inducedTrajectoryResolver, latestMissionCheckpoint, missionMemoryContext, promotionReadout, recallTrajectories, trajectoryFingerprint, trajectoryRecipeFingerprint } from "./trajectory-memory.mjs";
import { buildCodingContextPacket } from "../coding-context/coding-context.mjs";
import { resolutionCreditPolicy, validateConsiderationPolicy } from "./consideration.mjs";
import { executeAcceptanceCapsule, loadAcceptanceCapsule, materializeAcceptanceCapsule, validateAcceptanceCapsule } from "./acceptance-capsule.mjs";
import { githubApi } from "@red-cup-engineering/github-services-section";
import { actionBlocks, parseSoftwareMissionActionRecord } from "./action-record-parser.mjs";
import { sha256Hex } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/integrity";

export const ACTION_SCHEMA = {
  type: "object",
  required: ["action", "args", "reason"],
  properties: {
    action: { type: "string", enum: ["list_files", "search", "read", "edit", "create", "command", "test", "finish"] },
    args: { type: "object", additionalProperties: true },
    reason: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};

function workspaceWritableEvidence(workspace, writablePaths = []) {
  return [...new Set(writablePaths.filter((path) => typeof path === "string" && path.length > 0))]
    .sort()
    .map((path) => {
      const absolute = resolve(workspace, path);
      if (absolute !== resolve(workspace) && !absolute.startsWith(`${resolve(workspace)}${sep}`)) {
        return { path, exists: false, confined: false, byteLength: 0, text: "", truncated: false };
      }
      if (!existsSync(absolute) || !statSync(absolute).isFile()) {
        return { path, exists: false, confined: true, byteLength: 0, text: "", truncated: false };
      }
      const bytes = readFileSync(absolute);
      return {
        path,
        exists: true,
        confined: true,
        byteLength: bytes.byteLength,
        digest: sha256Hex(bytes),
        text: bytes.toString("utf8"),
        truncated: false,
      };
    });
}

const SYSTEM = `You are one hired inference interior of a durable software process node operating an isolated copy of one admitted territory. Return exactly one JSON object that satisfies the host-provided output schema; do not wrap it in Markdown or add prose. The host deterministically validates the JSON action. Available actions:
list_files {path?,max?}; search {query,path?}; read {path,startLine?,endLine?}; edit {path,blocks}; create {path,content}; command {name}; test {}; finish {summary?}.
Include only the arguments used by the selected action. For edit, blocks are one {search,replace} object or a nonempty ordered array of exact blocks; do not put marker text inside either field. Search is an exact nonempty current substring. For a target marked absent, use create with nonempty content. The host presents current writable bytes again on every contact; work from those bytes, not an earlier packet. A readout is one transition and the next contact receives its observation. You have no shell. Do not explore operational data records unless the objective names them. Make the complete coherent change required by the objective. The host automatically runs the declared verification after every edit. Never claim success without a passing verification result.`;

function validateCurrentEdit(action, processNode, writablePaths) {
  if (action?.action !== "edit") return null;
  const path = action.args?.path;
  if (typeof path !== "string" || !writablePaths.includes(path)) return `edit path is outside declared writable paths: ${path || "(missing)"}`;
  const blocks = actionBlocks(action);
  if (!blocks?.length) return "edit requires one or more exact blocks";
  const evidence = workspaceWritableEvidence(processNode.workspace, [path])[0];
  if (!evidence?.confined) return "edit path escapes the process-node workspace";
  let current = evidence.exists ? readFileSync(resolve(processNode.workspace, path), "utf8") : "";
  if (!evidence.exists) return "edit requires an existing current target; use the distinct create action for an absent target";
  for (const block of blocks) {
    if (!block || typeof block.search !== "string" || typeof block.replace !== "string") return "each edit block requires string replacement and string search";
    if (block.search === "") return "edit search must be a nonempty exact current substring";
    const at = current.indexOf(block.search);
    if (at < 0) return "edit search is not present in the evolving current source";
    if (current.indexOf(block.search, at + block.search.length) >= 0) return "edit search is ambiguous in the evolving current source";
    current = `${current.slice(0, at)}${block.replace}${current.slice(at + block.search.length)}`;
  }
  return null;
}

function validateCurrentCreate(action, processNode, writablePaths) {
  if (action?.action !== "create") return null;
  const path = action.args?.path;
  if (typeof path !== "string" || !writablePaths.includes(path)) return `create path is outside declared writable paths: ${path || "(missing)"}`;
  if (typeof action.args?.content !== "string" || !action.args.content.length) return "create requires nonempty string content";
  const evidence = workspaceWritableEvidence(processNode.workspace, [path])[0];
  if (!evidence?.confined) return "create path escapes the process-node workspace";
  if (evidence.exists) return "create requires a target absent from the current process-node workspace";
  return null;
}

function validateCurrentAction(action, processNode, writablePaths) {
  return validateCurrentEdit(action, processNode, writablePaths) ?? validateCurrentCreate(action, processNode, writablePaths);
}

/** The content address of one proposed transition: the action's meaning and
 * the writable workspace's bytes, independent of key or path order. */
export function transitionFingerprint(processNode, action) {
  const writableWorkspace = workspaceWritableEvidence(processNode.workspace, processNode.writablePaths)
    .map(({ path, exists, byteLength, digest }) => ({ path, exists, byteLength, digest: digest ?? null }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return semanticId({ kind: "transition", value: { action, writableWorkspace } });
}

function providerNativeReceipt(record) {
  const receipt = record?.providerNativeReceipt;
  return receipt && typeof receipt === "object" && !Array.isArray(receipt) && typeof receipt.type === "string" && receipt.type.length > 0
    ? receipt
    : null;
}

/** The content address of one mission record of a kind; the kind is data. */
export function stableIdentity(kind, value) {
  return semanticId({ kind, value });
}

function checkpointChanges(tools) {
  return tools.changes().map((change) => ({
    path: change.path,
    beforeExisted: change.before.existed,
    beforeDigest: `sha256:${change.before.digest}`,
    afterDigest: `sha256:${change.afterDigest}`,
    afterBytesBase64: change.after.toString("base64"),
  }));
}

function copyTerritory(source) {
  const parent = mkdtempSync(join(tmpdir(), "union-dev-process-node-")), workspace = join(parent, "territory");
  cpSync(source, workspace, { recursive: true, filter: (path) => !path.split(/[\\/]/).some((part) => [".git", "node_modules", ".lake", "dist", "coverage"].includes(part)) });
  const installedDependencies = join(source, "node_modules");
  if (existsSync(installedDependencies)) cpSync(installedDependencies, join(workspace, "node_modules"), { recursive: true, dereference: true });
  return { parent, workspace };
}

async function materializeMissionSource(input, { github = githubApi() } = {}) {
  const source = input.source;
  if (source?.kind === "local-territory") {
    const territory = resolve(source.path ?? input.territory ?? "");
    if (!existsSync(territory) || !statSync(territory).isDirectory()) {
      throw new Error("local mission source requires one existing territory directory");
    }
    return { territory, descriptor: { kind: source.kind, path: territory }, cleanup: null };
  }
  if (source?.kind !== "github-repository" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(source.repository ?? "") || !/^[0-9a-f]{40}$/u.test(source.commit ?? "")) {
    throw new Error("mission source must be a local-territory or github-repository with owner/name repository and immutable 40-hex commit");
  }
  const parent = mkdtempSync(join(tmpdir(), "union-mission-source-"));
  const territory = join(parent, "territory"), archive = join(parent, "source.tar.gz");
  mkdirSync(territory);
  try {
    await github.downloadRepositoryTarball(source.repository, source.commit, archive);
    execFileSync("tar", ["-xzf", archive, "-C", territory, "--strip-components=1"], { stdio: "pipe" });
    return { territory, descriptor: { kind: source.kind, repository: source.repository, commit: source.commit }, cleanup: parent };
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
}

export function inferenceContextProjection(contextPacket) {
  // The host retains the complete packet and its digest. The inference die
  // needs exact source, purpose, lane and oracle bytes, not a second copy of
  // host-only schemas, metrology, inventories, or quality attestations.
  return {
    type: contextPacket.type,
    identity: contextPacket.identity,
    objective: contextPacket.objective,
    machineChecks: {
      verifyCommand: contextPacket.machineChecks?.verifyCommand,
      acceptanceCommand: contextPacket.machineChecks?.acceptanceCommand,
      baselineVerification: contextPacket.machineChecks?.baselineVerification && {
        passed: contextPacket.machineChecks.baselineVerification.passed,
        output: String(contextPacket.machineChecks.baselineVerification.output ?? ""),
      },
      baselineAcceptance: contextPacket.machineChecks?.acceptanceCommand === contextPacket.machineChecks?.verifyCommand
        ? { passed: contextPacket.machineChecks?.baselineAcceptance?.passed, sameAsBaselineVerification: true }
        : contextPacket.machineChecks?.baselineAcceptance && {
            passed: contextPacket.machineChecks.baselineAcceptance.passed,
            output: String(contextPacket.machineChecks.baselineAcceptance.output ?? ""),
          },
    },
    acceptanceTestVectors: contextPacket.acceptanceTestVectors,
    acceptanceAuthority: contextPacket.acceptanceAuthority,
    lane: contextPacket.lane,
    targetArtifacts: contextPacket.targetArtifacts,
    evidenceArtifacts: contextPacket.evidenceArtifacts,
    omittedArtifacts: contextPacket.omittedArtifacts,
    priorVerifiedKnowledge: (contextPacket.priorVerifiedKnowledge ?? [])
      .filter((memory) => memory.taskClass && memory.taskClass === contextPacket.identity?.taskClass),
    priorResidueKnowledge: contextPacket.priorResidueKnowledge ?? [],
    constraints: contextPacket.constraints,
    firstMoves: contextPacket.firstMoves,
    packetQuality: contextPacket.packetQuality,
  };
}

function outputContractLearning(outputSchema, residueKnowledge = []) {
  const properties = outputSchema?.properties && typeof outputSchema.properties === "object" ? outputSchema.properties : {};
  const args = properties.args ?? {};
  const argsAlternatives = Array.isArray(args.oneOf) ? args.oneOf : [args];
  const priorAssayProblems = [...new Set(residueKnowledge
    .flatMap((residue) => Array.isArray(residue?.latestProblems) && residue.latestProblems.length ? residue.latestProblems : Array.isArray(residue?.problems) ? residue.problems : [])
    .filter((problem) => typeof problem === "string" && problem))];
  return {
    type: "CurrentOutputContractLearning",
    currentContract: {
      requiredRootFields: Array.isArray(outputSchema?.required) ? outputSchema.required : [],
      allowedRootFields: Object.keys(properties),
      additionalRootFieldsAllowed: outputSchema?.additionalProperties !== false,
      action: properties.action?.const ?? properties.action?.enum ?? null,
      requiredArgumentFields: [...new Set(argsAlternatives.flatMap((alternative) => alternative?.required ?? []))].sort(),
    },
    priorAssayProblems,
    rule: "Prior assay problems describe rejected earlier outputs; they are not the current task and must not be answered as content. Return only the current contracted object, with every current required field and no forbidden field.",
  };
}

function actionContractLearning(residueKnowledge = []) {
  const priorActionRefusals = [...new Set(residueKnowledge
    .filter((residue) => /invalid-action|malformed-action/u.test(residue?.dominantRefusal ?? ""))
    .flatMap((residue) => Array.isArray(residue?.latestReasons) && residue.latestReasons.length ? residue.latestReasons : Array.isArray(residue?.reasons) ? residue.reasons : [])
    .filter((reason) => typeof reason === "string" && reason))];
  return {
    type: "CurrentActionContractLearning",
    priorActionRefusals,
    editGrounding: [
      "args.path names the artifact being edited.",
      "blocks.search must be one exact current substring of the selected artifact.",
      "Objective, constraint, routing, rationale, residue, observation, and metadata prose are never source bytes.",
      "blocks.replace must directly implement the objective at the selected source location; it is not a paraphrase or copied instruction.",
    ],
  };
}

export function processNodePrompt(processNode, contextPacket, outputSchema = ACTION_SCHEMA) {
  const recent = processNode.observations.map((x, i) => `Observation ${i + 1}: ${x}`).join("\n");
  const writablePaths = contextPacket.lane?.writablePaths ?? [];
  const hasWorkspace = typeof processNode.workspace === "string";
  const writableWorkspace = hasWorkspace ? workspaceWritableEvidence(processNode.workspace, writablePaths) : [];
  const projection = inferenceContextProjection(contextPacket);
  if (hasWorkspace) projection.evidenceArtifacts = projection.evidenceArtifacts.filter((artifact) => !writablePaths.includes(artifact.path));
  return [
    "CODING CONTEXT PACKET (host-compiled; initial evidence is retained for purpose and oracle context):",
    JSON.stringify(projection),
    "CURRENT ADMITTED WRITABLE WORKSPACE (refreshed at this contact):",
    JSON.stringify({
      artifacts: writableWorkspace,
      law: "Return one exact action under the output schema. For edits, blocks carry exact current search and replacement strings. Every replacement must differ and the resulting workspace must satisfy the stated objective and acceptance test vectors.",
    }),
    "LEARNED OUTPUT CORRECTIONS (host-compiled from prior customer schema assays and the current contract):",
    JSON.stringify(outputContractLearning(outputSchema, projection.priorResidueKnowledge)),
    "LEARNED ACTION CORRECTIONS (host-compiled from prior host refusals and the current writable bytes):",
    JSON.stringify(actionContractLearning(projection.priorResidueKnowledge)),
    "CURRENT PROCESS-NODE TRAJECTORY:",
    recent || "No tool observations yet. Follow the packet's firstMoves before requesting more evidence.",
  ].join("\n\n");
}

function jobFor(manifest, processNode, contextPacket, considerationPolicy = manifest.considerationPolicy) {
  const outputSchema = ACTION_SCHEMA;
  return {
    id: `${manifest.id}:${processNode.contacts + 1}`,
    objective: manifest.objective,
    context: `${SYSTEM}\n\n${processNodePrompt(processNode, contextPacket, outputSchema)}`,
    workType: manifest.inferenceWorkType,
    requiredCapabilities: manifest.inferenceRequiredCapabilities,
    ...(manifest.difficulty !== undefined ? { difficulty: manifest.difficulty } : {}),
    considerationPolicy,
    ...(manifest.supplierExclusions.length ? { excludeProviders: manifest.supplierExclusions } : {}),
    outputSchema,
  };
}

function normalizeTestVectors(input) {
  if (!Array.isArray(input)) return [];
  return input.map((vector, index) => {
    if (!vector || typeof vector !== "object" || Array.isArray(vector)) throw new Error(`test vector ${index + 1} must be an object`);
    const id = typeof vector.id === "string" ? vector.id.trim() : "";
    const given = Array.isArray(vector.given) ? vector.given.filter((value) => typeof value === "string" && value.trim()) : [];
    const when = typeof vector.when === "string" ? vector.when.trim() : "";
    const then = Array.isArray(vector.then) ? vector.then.filter((value) => typeof value === "string" && value.trim()) : [];
    const forbidden = Array.isArray(vector.forbidden) ? vector.forbidden.filter((value) => typeof value === "string" && value.trim()) : [];
    if (!/^[a-z][a-z0-9-]+$/.test(id) || given.length === 0 || !when || then.length === 0) {
      throw new Error(`test vector ${index + 1} requires a lowercase id, nonempty given, when, and then fields`);
    }
    return { id, given, when, then, forbidden };
  });
}

function replayInducedTrajectory(manifest, resolver, acceptanceCapsule) {
  const isolated = copyTerritory(manifest.territory);
  if (acceptanceCapsule) materializeAcceptanceCapsule(isolated.workspace, acceptanceCapsule);
  const tools = createAgentTools({ root: isolated.workspace, verifyCommand: manifest.verifyCommand, acceptanceCommand: manifest.acceptanceCommand, commands: manifest.commands, writablePaths: manifest.writablePaths, readablePaths: manifest.readablePaths });
  const observations = [];
  for (const action of resolver.actions) {
    const editError = validateCurrentAction(action, { workspace: isolated.workspace }, manifest.writablePaths);
    if (editError) {
      observations.push(JSON.stringify({ terminal: true, error: editError }));
      break;
    }
    try { observations.push(tools.execute(action)); }
    catch (error) { observations.push(JSON.stringify({ error: error.message })); break; }
  }
  const checks = tools.verify();
  const verified = tools.changed.size > 0 && checks.verification.passed && checks.acceptance.passed;
  return {
    id: `resolver:${resolver.resolverId}`,
    ...isolated,
    tools,
    observations,
    actions: resolver.actions,
    providers: [],
    procurements: [],
    status: verified ? "verified" : "resolver-miss",
    completions: 0,
    deterministicResolver: { id: resolver.resolverId, fingerprint: resolver.dominantFingerprint, witnesses: resolver.witnesses, replayVerified: verified },
  };
}

async function runMaterializedMission(input, {
  dispatch = defaultDispatch,
  dataRoot,
  witnessJournalAgentUrl = process.env.WITNESS_JOURNAL_RDF_AGENT,
  custody,
  categoryIndex,
  keepWorkspaces = false,
  onEvent = () => {},
  appendTrajectory = appendSoftwareTrajectory,
  appendCheckpoint = null,
  readCheckpoint = null,
  recallTrajectories = recallSoftwareTrajectories,
  resolveInducedTrajectory = resolveInducedSoftwareTrajectory,
  promotionReadout = readSoftwareTrajectoryPromotion,
  readMemoryContext = readSoftwareMissionMemoryContext,
  signal,
  customerActor,
} = {}) {
  const checkpointAppend = appendCheckpoint ?? (appendTrajectory === appendSoftwareTrajectory
    ? appendSoftwareMissionCheckpoint
    : async (checkpoint) => ({ id: stableIdentity("test-checkpoint", checkpoint) }));
  const checkpointRead = readCheckpoint ?? (recallTrajectories === recallSoftwareTrajectories
    ? readSoftwareMissionCheckpoint
    : async () => null);
  const territory = resolve(input.territory);
  const writablePaths = Array.isArray(input.writablePaths)
    ? [...new Set(input.writablePaths.filter((value) => typeof value === "string" && value))]
    : [];
  const explicitFocusPaths = Array.isArray(input.focusPaths)
    ? [...new Set(input.focusPaths.filter((value) => typeof value === "string" && value))]
    : [];
  if (input.acceptanceCapsule && input.acceptanceCapsulePath) throw new Error("mission must carry an acceptance capsule by value or path, not both");
  const acceptanceCapsule = input.acceptanceCapsule
    ? validateAcceptanceCapsule(input.acceptanceCapsule, { territory })
    : input.acceptanceCapsulePath ? loadAcceptanceCapsule(input.acceptanceCapsulePath, { territory }) : null;
  if (acceptanceCapsule && input.acceptanceCommand && input.acceptanceCommand !== acceptanceCapsule.command) throw new Error("mission acceptance command conflicts with protected acceptance capsule");
  if (acceptanceCapsule && Array.isArray(input.testVectors) && JSON.stringify(normalizeTestVectors(input.testVectors)) !== JSON.stringify(acceptanceCapsule.testVectors)) throw new Error("mission test vectors conflict with protected acceptance capsule");
  const manifest = {
    id: input.id || stableIdentity("mission", {
      source: input.sourceDescriptor ?? { kind: "local-territory", path: territory },
      objective: input.objective,
      taskClass: input.taskClass ?? null,
      writablePaths: [...writablePaths].sort(),
      verifyCommand: input.verifyCommand,
      acceptanceCommand: acceptanceCapsule?.command || input.acceptanceCommand || input.verifyCommand,
    }),
    objective: input.objective,
    taskClass: input.taskClass || null,
    // A fabrication demand already names every authorized product locus in its
    // writable lane.  Requiring a second, redundant focus list made empty
    // sovereign packages fail context compilation before their must-create
    // targets could be projected.  An explicit focus remains authoritative.
    focusPaths: explicitFocusPaths.length > 0 ? explicitFocusPaths : writablePaths,
    writablePaths,
    readablePaths: Array.isArray(input.readablePaths) ? [...new Set(input.readablePaths.filter((value) => typeof value === "string" && value))] : [],
    workType: typeof input.workType === "string" && input.workType ? input.workType : (writablePaths.length ? "software-engineering" : "inquiry"),
    requiredCapabilities: Array.isArray(input.requiredCapabilities) && input.requiredCapabilities.length
      ? [...new Set(input.requiredCapabilities.filter((value) => typeof value === "string" && value))]
      : [writablePaths.length ? "software-engineering" : "inquiry"],
    inferenceWorkType: typeof input.inferenceWorkType === "string" && input.inferenceWorkType
      ? input.inferenceWorkType
      : "inquiry",
    inferenceRequiredCapabilities: Array.isArray(input.inferenceRequiredCapabilities) && input.inferenceRequiredCapabilities.length
      ? [...new Set(input.inferenceRequiredCapabilities.filter((value) => typeof value === "string" && value))]
      : ["inquiry"],
    territory,
    verifyCommand: input.verifyCommand,
    acceptanceCommand: acceptanceCapsule?.command || input.acceptanceCommand || input.verifyCommand,
    commands: input.commands || {},
    constraints: input.constraints || [],
    testVectors: acceptanceCapsule?.testVectors || normalizeTestVectors(input.testVectors),
    acceptanceCapsule,
    acceptanceCapsulePath: input.acceptanceCapsulePath || null,
    difficulty: input.difficulty,
    considerationPolicy: validateConsiderationPolicy(input.considerationPolicy ?? resolutionCreditPolicy(31)),
    enforceProviderSchema: input.enforceProviderSchema === true,
    supplierExclusions: Array.isArray(input.supplierExclusions) ? [...new Set(input.supplierExclusions.filter((value) => typeof value === "string" && value))] : [],
  };
  if (!manifest.objective || !existsSync(manifest.territory)) throw new Error("mission requires objective and an existing territory");
  if (manifest.workType === "software-engineering" && !manifest.verifyCommand) throw new Error("software-engineering missions require verifyCommand");
  if (manifest.workType === "software-engineering" && manifest.writablePaths.length === 0) throw new Error("software-engineering missions require an explicit nonempty writable lane");
  if (acceptanceCapsule) {
    if (manifest.writablePaths.length === 0) throw new Error("protected acceptance missions require an explicit nonempty writable lane");
    const conflicts = acceptanceCapsule.artifacts.filter((artifact) => manifest.writablePaths.some((path) => artifact.path === path || artifact.path.startsWith(`${path}/`) || path.startsWith(`${artifact.path}/`)));
    if (conflicts.length) throw new Error(`protected acceptance artifacts overlap the writable lane: ${conflicts.map((artifact) => artifact.path).join(", ")}`);
  }
  const startedAt = new Date().toISOString(), snapshot = territorySnapshot(manifest.territory);
  const baselineVerification = manifest.verifyCommand
    ? runTestsCommand(manifest.territory, manifest.verifyCommand)
    : { passed: true, output: "not-applicable: inquiry has no mutation acceptance command" };
  const baselineAcceptance = acceptanceCapsule
    ? executeAcceptanceCapsule(manifest.territory, acceptanceCapsule, { requireSourceEvidence: true })
    : !manifest.acceptanceCommand || manifest.acceptanceCommand === manifest.verifyCommand ? baselineVerification : runTestsCommand(manifest.territory, manifest.acceptanceCommand);
  const memoryOptions = {
    dataRoot,
    witnessJournalAgentUrl,
    custody,
    categoryIndex,
    agentCardUrl: process.env.SOFTWARE_TRAJECTORY_MEMORY_AGENT_CARD_URL,
    ...(typeof input.causalInvocation === "string" && input.causalInvocation !== ""
      ? { invocation: input.causalInvocation }
      : {}),
  };
  const sourceIdentity = stableIdentity("source", input.sourceDescriptor ?? { kind: "local-territory", path: manifest.territory });
  const useProjectedMemoryContext = readMemoryContext === readSoftwareMissionMemoryContext
    && checkpointRead === readSoftwareMissionCheckpoint
    && recallTrajectories === recallSoftwareTrajectories
    && resolveInducedTrajectory === resolveInducedSoftwareTrajectory
    && promotionReadout === readSoftwareTrajectoryPromotion;
  const memoryContext = signal?.aborted || !useProjectedMemoryContext ? null
    : await readMemoryContext(manifest.objective, manifest.taskClass, manifest.id, sourceIdentity, memoryOptions);
  const priorCheckpoint = signal?.aborted ? null : memoryContext
    ? memoryContext.checkpoint
    : await checkpointRead(manifest.id, sourceIdentity, memoryOptions);
  const memories = signal?.aborted ? [] : memoryContext?.memories
    ?? await recallTrajectories(manifest.objective, { ...memoryOptions, taskClass: manifest.taskClass });
  const contextPacket = buildCodingContextPacket({ manifest, snapshot, baselineVerification, baselineAcceptance, memories, actionSchema: ACTION_SCHEMA });
  const contextDeficiencies = Object.entries(contextPacket.packetQuality)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  const induced = signal?.aborted || input.useInducedResolver === false || contextPacket.acceptanceAuthority.protected !== true
    ? null
    : memoryContext?.resolver ?? await resolveInducedTrajectory(manifest.taskClass, memoryOptions);
  const replay = induced?.eligible ? replayInducedTrajectory(manifest, induced, acceptanceCapsule) : null;
  if (replay && replay.status !== "verified") {
    onEvent({ type: "induced-resolver-missed", missionId: manifest.id, resolverId: induced.resolverId });
    rmSync(replay.parent, { recursive: true, force: true });
  }
  onEvent({ type: "mission-started", missionId: manifest.id, startedAt, processNodes: replay?.status === "verified" ? 0 : 1, inducedResolver: replay?.status === "verified" ? induced.resolverId : null, resumedCheckpoint: priorCheckpoint?.id ?? null, filesObserved: snapshot.files.length, baselineVerificationPassed: baselineVerification.passed, contextPacket: { digest: contextPacket.digest, evidenceArtifacts: contextPacket.evidenceArtifacts.length, quality: contextPacket.packetQuality } });
  const processNode = replay?.status === "verified" ? replay : (() => {
    const isolated = copyTerritory(manifest.territory);
    if (acceptanceCapsule) materializeAcceptanceCapsule(isolated.workspace, acceptanceCapsule);
    const tools = createAgentTools({ root: isolated.workspace, verifyCommand: manifest.verifyCommand, acceptanceCommand: manifest.acceptanceCommand, commands: manifest.commands, writablePaths: manifest.writablePaths, readablePaths: manifest.readablePaths });
    if (priorCheckpoint) tools.restoreChanges(priorCheckpoint.changes);
    return {
      id: "process-node",
      ...isolated,
      tools,
      observations: priorCheckpoint?.observations ?? [], actions: priorCheckpoint?.actions ?? [], providers: priorCheckpoint?.providers ?? [], procurements: priorCheckpoint?.procurements ?? [], attempts: priorCheckpoint?.attempts ?? [], transitionFingerprints: new Set(priorCheckpoint?.transitionFingerprints ?? []),
      writablePaths: manifest.writablePaths, contacts: priorCheckpoint?.contacts ?? 0, checkpointOrdinal: priorCheckpoint?.ordinal ?? "0", checkpointId: priorCheckpoint?.id ?? null, status: signal?.aborted ? "stopped" : ["verified", "answered"].includes(priorCheckpoint?.status) ? priorCheckpoint.status : "ready", answer: priorCheckpoint?.answer ?? null, refusal: signal?.aborted ? { type: "aborted" } : null, completions: priorCheckpoint?.completions ?? 0,
    };
  })();
  if (processNode && !processNode.deterministicResolver && contextDeficiencies.length > 0
      && !processNode.observations.some((observation) => String(observation).includes('"type":"ContextQualityObservation"'))) {
    processNode.observations.push(JSON.stringify({
      type: "ContextQualityObservation",
      disposition: "repairable",
      deficiencies: contextDeficiencies,
      rule: "Missing context evidence is analysis work for the process node; customer verification remains the induction boundary.",
    }));
  }
  let inferenceContacts = processNode?.contacts ?? 0, attempts = processNode?.attempts?.length ?? 0;
  const seatCheckpoint = async (stage) => {
    if (!processNode || processNode.deterministicResolver) return null;
    const ordinal = (BigInt(processNode.checkpointOrdinal) + 1n).toString();
    const checkpoint = {
      type: "SoftwareMissionCheckpoint",
      missionId: manifest.id,
      sourceIdentity,
      recordedAt: new Date().toISOString(),
      ordinal,
      parentCheckpoint: processNode.checkpointId,
      stage,
      status: processNode.status,
      changes: checkpointChanges(processNode.tools),
      observations: processNode.observations,
      actions: processNode.actions,
      providers: processNode.providers,
      procurements: processNode.procurements,
      attempts: processNode.attempts,
      transitionFingerprints: [...processNode.transitionFingerprints],
      contacts: processNode.contacts,
      completions: processNode.completions,
      answer: processNode.answer ?? null,
    };
    checkpoint.id = stableIdentity("checkpoint", {
      missionId: checkpoint.missionId,
      sourceIdentity: checkpoint.sourceIdentity,
      ordinal: checkpoint.ordinal,
      parentCheckpoint: checkpoint.parentCheckpoint,
      stage: checkpoint.stage,
      changes: checkpoint.changes,
      actions: checkpoint.actions,
      transitionFingerprints: checkpoint.transitionFingerprints,
    });
    const seated = await checkpointAppend(checkpoint, memoryOptions);
    processNode.checkpointOrdinal = ordinal;
    processNode.checkpointId = checkpoint.id;
    onEvent({ type: "mission-checkpoint-seated", missionId: manifest.id, stage, semanticId: seated.documentNi ?? seated.id ?? null });
    return seated;
  };
  try {
    contactLot: while (processNode && !processNode.deterministicResolver && processNode.status === "ready") {
      if (signal?.aborted) {
        processNode.status = "stopped";
        processNode.refusal = { type: "aborted" };
        await seatCheckpoint("dispatch-aborted");
        break contactLot;
      }
      // Current consideration policies name acceptable denominations and
      // settlement capabilities. Provider-authored offers carry the exact
      // fractional price; maximumAmount and integer aggregate grants are
      // retired. Each additional contact therefore returns to the market and
      // bears its own quoted pressure instead of consuming a fake local cap.
      const job = jobFor(manifest, processNode, contextPacket, manifest.considerationPolicy);
      processNode.contacts += 1;
      inferenceContacts += 1;
      onEvent({ type: "process-node-inference-started", missionId: manifest.id, processNodeId: processNode.id, contact: processNode.contacts, jobId: job.id });
      let records = [];
      let dispatchAbort = null;
      try {
        records = await dispatch([job], { ...(signal ? { signal } : {}), ...(customerActor ? { customerActor } : {}) });
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") {
          dispatchAbort = error;
          records = [];
        } else {
          records = [{ id: job.id, refusal: { type: "dispatch-error", reason: error.message }, attempts: [] }];
        }
      }
      const record = records.find((candidate) => candidate.id === job.id);
      const contactAttempts = Array.isArray(record?.attempts) ? record.attempts : [];
      processNode.attempts.push(...contactAttempts.map((attempt, ordinal) => ({ contact: processNode.contacts, jobId: job.id, ordinal: ordinal + 1, ...attempt })));
      attempts += contactAttempts.length;
      const procurement = record?.procurement ?? {};
      processNode.procurements.push({
        contact: processNode.contacts, jobId: job.id,
        provider: record?.provider || null, endpoint: record?.endpoint || null, model: record?.model || null,
        consideration: record?.cost || null, providerNativeReceipt: providerNativeReceipt(record),
        market: procurement.market ?? null, request: procurement.request ?? null, result: procurement.result ?? null,
        selectedOffer: procurement.selectedOffer ?? null, compact: procurement.compact ?? null,
        providerProposal: procurement.providerProposal ?? null, settlement: procurement.settlement ?? null,
        receipt: procurement.receipt ?? null, schemaAssay: procurement.schemaAssay ?? record?.verification?.schemaAssay ?? null,
        considerationDisposition: procurement.considerationDisposition ?? null, selectionRule: procurement.selectionRule ?? null,
        rankedFeasibleOffers: procurement.rankedFeasibleOffers ?? [],
      });
      onEvent({ type: "process-node-inference-settled", missionId: manifest.id, processNodeId: processNode.id, contact: processNode.contacts, record: record ? { id: record.id, endpoint: record.endpoint || null, refusal: record.refusal?.type || null, attempts: contactAttempts.map((attempt) => ({ endpoint: attempt.endpoint, outcome: attempt.outcome, reason: attempt.reason || null, latencyMs: attempt.latencyMs })) } : null });
      if (dispatchAbort || signal?.aborted) {
        processNode.observations.push(JSON.stringify({
          contacted: true,
          aborted: true,
          contact: processNode.contacts,
          jobId: job.id,
          recordReceived: Boolean(record),
          attemptsObserved: contactAttempts.length,
          provider: record?.provider || record?.endpoint || null,
          providerNativeReceipt: providerNativeReceipt(record),
        }));
        processNode.status = "stopped";
        processNode.refusal = { type: "aborted" };
        break contactLot;
      }
      const parsedAction = parseSoftwareMissionActionRecord(record);
      const action = parsedAction;
      if (!action || record?.refusal) {
        processNode.observations.push(`Inference refusal or invalid action: ${record?.refusal?.type || "no result"}${record?.refusal?.reason ? `: ${record.refusal.reason}` : ""}`);
        const refusal = record?.refusal ?? { type: "invalid-action-candidate" };
        const refusalFingerprint = semanticId({ kind: "refusal", value: {
          type: refusal.type ?? refusal.outcome ?? null,
          reason: refusal.reason ?? null,
          disposition: refusal.disposition ?? null,
          provider: record?.provider ?? refusal.provider ?? null,
          schemaAssay: procurement.schemaAssay ?? refusal.schemaAssay ?? null,
          problems: refusal.problems ?? null,
          directLaneRefusals: refusal.directLaneRefusals ?? null,
        } });
        if (processNode.transitionFingerprints.has(refusalFingerprint)) {
          processNode.status = "stopped";
          processNode.fixedPoint = { type: "repeated-market-refusal", fingerprint: refusalFingerprint, refusal };
        } else {
          processNode.transitionFingerprints.add(refusalFingerprint);
          processNode.refusal = refusal;
          if (record?.refusal) processNode.status = "refused";
        }
        onEvent({ type: "process-node-contact-refused", missionId: manifest.id, processNodeId: processNode.id, refusal: processNode.refusal });
        await seatCheckpoint("market-refusal");
        break contactLot;
      }
      const currentEditError = validateCurrentAction(action, processNode, manifest.writablePaths);
      if (currentEditError) {
        processNode.actions.push(action);
        processNode.providers.push(record?.provider || record?.attempts?.find((attempt) => attempt.outcome === "completion")?.provider || record?.endpoint || null);
        processNode.observations.push(JSON.stringify({ refused: true, error: currentEditError, nextAct: "return-to-capability-market" }));
        processNode.refusal = { type: "invalid-action-candidate", reason: currentEditError };
        const invalidFingerprint = transitionFingerprint(processNode, action);
        if (processNode.transitionFingerprints.has(invalidFingerprint)) {
          processNode.status = "stopped";
          processNode.fixedPoint = { type: "repeated-invalid-transition", fingerprint: invalidFingerprint, refusal: processNode.refusal };
        } else {
          processNode.transitionFingerprints.add(invalidFingerprint);
          processNode.status = "refused";
        }
        onEvent({ type: "process-node-action-refused", missionId: manifest.id, processNodeId: processNode.id, action: action.action, refusal: processNode.refusal });
        await seatCheckpoint("action-refusal");
        break contactLot;
      }
      const fingerprint = transitionFingerprint(processNode, action);
      if (processNode.transitionFingerprints.has(fingerprint)) {
        processNode.status = "stopped";
        processNode.fixedPoint = { type: "repeated-deterministic-transition", fingerprint };
        processNode.observations.push(JSON.stringify({ stopped: true, ...processNode.fixedPoint }));
        await seatCheckpoint("fixed-point");
        break contactLot;
      }
      processNode.transitionFingerprints.add(fingerprint);
      processNode.completions += 1;
      processNode.actions.push(action);
      processNode.providers.push(record?.provider || record?.attempts?.find((attempt) => attempt.outcome === "completion")?.provider || record?.endpoint || null);
      let observation;
      if (manifest.workType === "inquiry" && action.action === "finish") {
        const answer = typeof action.args?.summary === "string" ? action.args.summary.trim() : "";
        observation = JSON.stringify(answer
          ? { answered: true, artifact: stableIdentity("inquiry-answer", { mission: manifest.id, answer }) }
          : { terminal: true, error: "inquiry finish requires a nonempty work product" });
        if (answer) {
          processNode.answer = answer;
          processNode.status = "answered";
        }
      } else {
        try { observation = processNode.tools.execute(action); } catch (error) { observation = JSON.stringify({ terminal: true, error: error.message }); }
      }
      processNode.observations.push(observation);
      onEvent({ type: "process-node-action-settled", missionId: manifest.id, processNodeId: processNode.id, contact: processNode.contacts, action: action.action, endpoint: record?.endpoint || null });
      await seatCheckpoint("action-settled");
      if (signal?.aborted) {
        processNode.status = "stopped";
        processNode.refusal = { type: "aborted" };
        break contactLot;
      }
      const verdict = (() => { try { return JSON.parse(observation); } catch { return null; } })();
      if (verdict?.error && verdict?.terminal === true) {
        processNode.refusal = { type: "invalid-action-candidate", reason: verdict.error };
        processNode.status = "refused";
        onEvent({ type: "process-node-action-refused", missionId: manifest.id, processNodeId: processNode.id, action: action.action, refusal: processNode.refusal });
      } else if (processNode.tools.changed.size > 0 && verdict?.verification?.passed === true && verdict?.acceptance?.passed === true) {
        processNode.status = "verified";
        await seatCheckpoint("candidate-verified");
      }
    }
    const selected = processNode?.status === "verified" ? {
      processNodeId: processNode.id,
      changes: processNode.tools.changes(),
      actions: processNode.actions,
      observations: processNode.observations,
      completions: processNode.completions,
      providers: processNode.providers,
      deterministicResolver: processNode.deterministicResolver ?? null,
    } : null;
    const inquiryAnswer = manifest.workType === "inquiry" && processNode?.status === "answered"
      ? processNode.answer
      : null;
    const candidateAccepted = Boolean(selected);
    const proposal = selected ? {
      type: "SoftwareMissionChangeProposal",
      changes: selected.changes.map((change) => ({
        path: change.path,
        beforeExisted: change.before.existed,
        beforeDigest: `sha256:${change.before.digest}`,
        afterDigest: `sha256:${change.afterDigest}`,
        afterBytesBase64: change.after.toString("base64"),
      })),
      authorProviders: [...new Set(selected.providers.filter(Boolean))],
      trajectoryFingerprint: trajectoryFingerprint(selected.actions),
      trajectoryRecipeFingerprint: trajectoryRecipeFingerprint(selected.actions),
      deterministicResolver: selected.deterministicResolver ?? null,
      proposalOnly: true,
      customerMutation: false,
    } : null;
    const continuationRequired = !selected && !inquiryAnswer && processNode?.status === "ready";
    const integration = {
      integrated: false,
      classification: selected ? "awaiting-receiver-induction" : inquiryAnswer ? "answered" : continuationRequired ? "continuation-required" : "unresolved",
    };
    const finishedAt = new Date().toISOString();
    const outcome = {
      verified: candidateAccepted,
      promotable: false,
      candidateVerified: Boolean(selected),
      answered: Boolean(inquiryAnswer),
      inquiryResult: inquiryAnswer,
      continuationRequired,
      integrated: integration.integrated,
      inductionRequired: Boolean(selected),
      classification: integration.classification,
      changedPaths: selected?.changes.map((x) => x.path) || [],
      selectedProcessNodeId: selected?.processNodeId || null,
      selectedActions: selected?.actions || [],
      trajectoryFingerprint: selected ? trajectoryFingerprint(selected.actions) : null,
      trajectoryRecipeFingerprint: selected ? trajectoryRecipeFingerprint(selected.actions) : null,
      inducedResolver: selected?.deterministicResolver ?? null,
      summary: selected
        ? "the process node produced a verification- and customer-acceptance-passing candidate"
        : inquiryAnswer
          ? "the process node inspected the admitted source and produced the requested work product"
        : "the process node did not produce a verification-passing candidate",
      proposal,
      integration,
    };
    const record = {
      type: "SoftwareMissionTrajectory",
      id: manifest.id,
      objective: manifest.objective,
      taskClass: manifest.taskClass,
      startedAt,
      finishedAt,
      territory: { source: input.sourceDescriptor ?? { kind: "local-territory", path: manifest.territory }, filesObserved: snapshot.files.length, baselineVerificationPassed: baselineVerification.passed },
      contextPacket: {
        digest: contextPacket.digest,
        lane: contextPacket.lane,
        targetArtifacts: contextPacket.targetArtifacts,
        evidenceArtifacts: contextPacket.evidenceArtifacts.map((artifact) => ({ path: artifact.path, role: artifact.role, digest: artifact.digest, truncated: artifact.truncated })),
        omittedArtifacts: contextPacket.omittedArtifacts,
        quality: contextPacket.packetQuality,
        acceptanceAuthority: contextPacket.acceptanceAuthority,
        resourceAccount: contextPacket.resourceAccount,
      },
      outcome,
      metrics: {
        processNodes: selected?.deterministicResolver || !processNode ? 0 : 1,
        inferenceContacts,
        inferenceAttempts: attempts,
        usefulCompletions: processNode?.completions ?? 0,
        verifiedCandidates: selected ? 1 : 0,
        directInteractiveModelCalls: 0,
        inducedResolverReplays: selected?.deterministicResolver ? 1 : 0,
        procurementSelections: processNode?.procurements.length ?? 0,
        expectedConsideration: (processNode?.procurements ?? [])
          .flatMap(({ provider, consideration }) => (consideration?.obligations ?? [])
            .filter((obligation) => obligation.amount && typeof obligation.amount === "object"
              && typeof obligation.amount.numerator === "string"
              && typeof obligation.amount.denominator === "string"
              && typeof obligation.unit === "string")
            .map((obligation) => ({ provider, amount: obligation.amount, unit: obligation.unit, asset: obligation.asset ?? null, kind: obligation.kind ?? null }))),
      },
      processNode: processNode ? { id: processNode.id, status: processNode.status, refusal: processNode.refusal ?? null, actions: processNode.actions, providers: processNode.providers, procurements: processNode.procurements, attempts: processNode.attempts ?? [], observations: processNode.observations, fixedPoint: processNode.fixedPoint ?? null, deterministicResolver: processNode.deterministicResolver ?? null } : null,
    };
    const trajectoryRecord = await appendTrajectory(record, memoryOptions);
    onEvent({ type: "mission-settled", missionId: manifest.id, outcome, networkReference: trajectoryRecord.reference, semanticId: trajectoryRecord.documentNi });
    return {
      ...record,
      networkReference: trajectoryRecord.reference,
      semanticId: trajectoryRecord.documentNi,
      // The context projection is the causal promotion view at mission start.
      // A later activation will observe the just-appended trajectory; do not
      // rehydrate global memory merely to decorate this transition's receipt.
      promotion: memoryContext?.promotion ?? await promotionReadout(manifest.taskClass, memoryOptions),
    };
  } finally {
    if (!keepWorkspaces && processNode) rmSync(processNode.parent, { recursive: true, force: true });
  }
}

export async function runMission(input, options = {}) {
  const materialized = await materializeMissionSource(input, options);
  try {
    return await runMaterializedMission({ ...input, territory: materialized.territory, sourceDescriptor: materialized.descriptor }, options);
  } finally {
    if (materialized.cleanup) rmSync(materialized.cleanup, { recursive: true, force: true });
  }
}

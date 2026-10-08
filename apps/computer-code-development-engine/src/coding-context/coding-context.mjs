import { readCodingContext } from "./read-coding-context.mjs";
// The "better context beats a smarter model" lever, made first-class and inspectable.
// buildContext assembles the material a model needs BEFORE it is asked to generate a patch:
// a bounded repo map, files the task/tests point at, and any similar already-solved cases.
// Deterministic; injectable; the thing you improve instead of swapping models.
import { sha256Digest } from "@red-cup-engineering/cryptographic-data-service/integrity";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { executeJavascriptNodeCommand } from "@red-cup-engineering/execute-javascript-node-command-service";
import { gitWorktreePlan, splitNullOutput } from "@red-cup-engineering/git-services-section/git-command-codec";
import { stepRequest } from "../workspace/worktree.mjs";

// Files a task plausibly touches: paths mentioned in the issue body or test output.
export function mentionedPaths(text, repoFiles) {
  const hits = new Set();
  const t = String(text || "");
  for (const f of repoFiles) {
    if (f && t.includes(f)) hits.add(f);
  }
  // also catch bare filenames like "foo.mjs"
  const nameRe = /[\w./-]+\.[A-Za-z]{1,6}/g;
  let m;
  while ((m = nameRe.exec(t))) {
    const hit = repoFiles.find((f) => f.endsWith("/" + m[0]) || f === m[0]);
    if (hit) hits.add(hit);
  }
  return [...hits];
}

export function repoFileList(workdir) {
  const step = gitWorktreePlan.trackedFiles(".");
  const { result } = executeJavascriptNodeCommand(stepRequest(step, workdir));
  if (!step.ok.includes(result.status)) throw new Error(`cannot enumerate context sources: ${result.error ?? result.stderr}`);
  return splitNullOutput(result.stdout);
}

// Assemble context. `similarCases` is an optional array of prior resolved {task, patch}
// pulled from the outcome ledger by the caller.
export function buildContext({ task, workdir, failures = [], similarCases = [] } = {}) {
  const files = repoFileList(workdir);
  const hintText = `${task?.title || ""}\n${task?.body || ""}\n${failures.map((f) => f.test || f.apply || "").join("\n")}`;
  const focus = mentionedPaths(hintText, files);
  const context = readCodingContext({ root: workdir, paths: focus, intent: hintText });
  const excerpts = Object.fromEntries(context.evidence.map(({path, text}) => [path, text]));
  return {
    task,
    repoFileCount: files.length,
    focusFiles: focus,
    excerpts,
    failures,
    similarCases,
    context,
  };
}

function inside(root, requested) {
  const path = resolve(root, requested);
  if (path !== resolve(root) && !path.startsWith(`${resolve(root)}${sep}`)) throw new Error(`context path escapes admitted territory: ${requested}`);
  return path;
}

function normalizePath(root, requested) {
  return relative(root, inside(root, requested)).split(sep).join("/") || ".";
}


function commandPaths(command) {
  return String(command || "").match(/[A-Za-z0-9_./-]+\.(?:[cm]?[jt]sx?|json|md|toml|ya?ml)/gu) || [];
}

function relativeImports(text) {
  const found = new Set(), patterns = [/(?:from\s+|import\s*\()\s*["'](\.[^"']+)["']/gu, /require\s*\(\s*["'](\.[^"']+)["']\s*\)/gu];
  for (const pattern of patterns) for (const match of String(text || "").matchAll(pattern)) found.add(match[1]);
  return [...found];
}

function resolveImport(root, importer, specifier) {
  const base = resolve(root, dirname(importer), specifier);
  for (const candidate of [base, `${base}.mjs`, `${base}.js`, `${base}.ts`, `${base}.tsx`, join(base, "index.mjs"), join(base, "index.js")]) {
    if (existsSync(candidate) && candidate.startsWith(`${resolve(root)}${sep}`)) return relative(root, candidate).split(sep).join("/");
  }
  return null;
}

function compactCheck(result) {
  if (!result) return null;
  return { passed: result.passed === true, output: result.passed === true ? "exit=0" : String(result.output || "") };
}

function compactVerifiedMemories(memories) {
  return memories
    .filter((memory) => memory?.outcome?.verified === true || Array.isArray(memory?.verifiedActions))
    .map((memory) => ({
      id: memory.id,
      taskClass: memory.taskClass || null,
      objective: String(memory.objective || ""),
      finishedAt: memory.finishedAt || null,
      classification: memory.outcome?.classification || null,
      changedPaths: Array.isArray(memory.outcome?.changedPaths) ? memory.outcome.changedPaths : memory.changedPaths || [],
      summary: String(memory.outcome?.summary || memory.summary || ""),
      trajectoryFingerprint: memory.outcome?.trajectoryFingerprint || memory.trajectoryFingerprint || null,
      selectedMoves: (memory.outcome?.selectedActions || memory.verifiedActions || []).map((move) => ({
        action: move.action,
        path: move.args?.path || null,
        reason: String(move.reason || ""),
      })),
    }));
}

function compactResidueKnowledge(memories) {
  return memories
    .filter((memory) => memory?.type === "SoftwareTrajectoryResidueKnowledge")
    .map((memory) => ({
      type: memory.type,
      dominantRefusal: memory.dominantRefusal,
      occurrences: memory.occurrences,
      providers: memory.providers || [],
      schemaAssays: memory.schemaAssays || [],
      problems: (memory.problems || []).map((problem) => String(problem)),
      latestSchemaAssay: memory.latestSchemaAssay || null,
      latestProblems: (memory.latestProblems || []).map((problem) => String(problem)),
      latestWitness: memory.latestWitness || null,
      reasons: (memory.reasons || []).map((reason) => String(reason)),
      witnesses: memory.witnesses || [],
      strategy: memory.strategy,
      modelEscalationAllowed: false,
      capabilityFormationRequired: memory.capabilityFormationRequired === true,
      nextAct: memory.nextAct,
    }));
}

// Compile the cockpit a coding actor enters with. This is deterministic host
// work: models receive exact local evidence and narrow judgment/action duties;
// they never compute digests, decide filesystem scope, or certify test results.
export function buildCodingContextPacket({
  manifest,
  snapshot,
  baselineVerification,
  baselineAcceptance,
  memories = [],
  actionSchema,
} = {}) {
  const root = resolve(manifest.territory), focusPaths = manifest.focusPaths.map((path) => normalizePath(root, path));
  const acceptanceMentioned = commandPaths(manifest.acceptanceCommand).map((path) => normalizePath(root, path));
  const commandMentioned = [...commandPaths(manifest.verifyCommand), ...acceptanceMentioned].map((path) => normalizePath(root, path));
  const capsuleArtifacts = Array.isArray(manifest.acceptanceCapsule?.artifacts) ? manifest.acceptanceCapsule.artifacts : [];
  const capsuleArtifactPaths = new Set(capsuleArtifacts.map((artifact) => normalizePath(root, artifact.path)));
  const targetPaths = [...new Set([...focusPaths, ...commandMentioned])];
  const candidates = [];
  const add = (path, role, priority) => {
    const normalized = normalizePath(root, path);
    if (!candidates.some((candidate) => candidate.path === normalized)) candidates.push({ path: normalized, role, priority });
  };
  for (const path of focusPaths) add(path, "focus", 1);
  for (const path of commandMentioned) add(path, "machine-check-target", 2);
  for (const [path, role] of [["package.json", "package-manifest"], ["README.md", "territory-readme"]]) if (existsSync(inside(root, path))) add(path, role, 3);

  // First read exact focus material, then admit its local relative interfaces.
  for (const path of focusPaths) {
    const absolute = inside(root, path);
    if (!existsSync(absolute)) continue;
    const observed = readCodingContext({ root, paths: [path], instructions: false, requireComplete: true, maxBytes: manifest.contextBudgetBytes ?? 1_000_000 });
    if (!observed.complete) throw new Error(`cannot read complete focus artifact: ${path}`);
    const text = observed.evidence[0].text;
    for (const specifier of relativeImports(text)) {
      const imported = resolveImport(root, path, specifier);
      if (imported) add(imported, "relative-import-interface", 4);
    }
  }

  candidates.sort((left, right) => left.priority - right.priority || left.path.localeCompare(right.path));
  const evidenceArtifacts = [], omittedArtifacts = [], targetArtifacts = [];
  let usedBytes = 0;
  for (const path of targetPaths) if (!existsSync(inside(root, path)) && !capsuleArtifactPaths.has(path)) targetArtifacts.push({ path, status: "must-create" });
  const sources = readCodingContext({ root, paths: candidates.filter(({path}) => existsSync(inside(root, path))), requireComplete: true, maxBytes: manifest.contextBudgetBytes ?? 1_000_000, maxFiles: Number.MAX_SAFE_INTEGER });
  if (!sources.complete) throw new Error(`coding context requires complete artifacts: ${sources.omitted.map(({path, reason}) => `${path}: ${reason}`).join(", ")}`);
  evidenceArtifacts.push(...sources.evidence);
  usedBytes += sources.usedBytes;
  for (const artifact of capsuleArtifacts) {
    const path = normalizePath(root, artifact.path), bytes = Buffer.from(artifact.text);
    evidenceArtifacts.push({ path, role: "protected-acceptance", digest: artifact.digest, bytes: bytes.length, truncated: false, text: bytes.toString("utf8") });
    usedBytes += bytes.length;
  }

  const priorVerifiedKnowledge = compactVerifiedMemories(memories);
  const priorResidueKnowledge = compactResidueKnowledge(memories);
  const writablePaths = manifest.writablePaths.map((path) => normalizePath(root, path));
  const writableCovers = (path) => writablePaths.length === 0 || writablePaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
  const protectedAcceptance = manifest.acceptanceCapsule != null || (acceptanceMentioned.length > 0
    && acceptanceMentioned.every((path) => existsSync(inside(root, path)) && !writableCovers(path)));
  const packet = {
    type: "AutonomousCodingContextPacket",
    id: `${manifest.id}:context`,
    identity: { missionId: manifest.id, taskClass: manifest.taskClass || null, actorRole: "bounded software worker", hostRole: "scope enforcement, evidence assembly, execution, verification, semantic review, and protected-border integration" },
    objective: manifest.objective,
    machineChecks: {
      verifyCommand: manifest.verifyCommand,
      acceptanceCommand: manifest.acceptanceCommand,
      baselineVerification: compactCheck(baselineVerification),
      baselineAcceptance: compactCheck(baselineAcceptance),
    },
    acceptanceTestVectors: manifest.testVectors,
    acceptanceAuthority: {
      protected: protectedAcceptance,
      mode: protectedAcceptance ? "host-protected" : "candidate-writable-or-unresolved",
      commandTargets: acceptanceMentioned,
      capsuleId: manifest.acceptanceCapsule?.id || null,
      capsuleDigest: manifest.acceptanceCapsule?.digest || null,
      rule: "A trajectory is promotable only when every explicit acceptance-command artifact pre-exists and is outside the candidate writable lane.",
    },
    lane: {
      territory: root,
      focusPaths,
      writablePaths: manifest.writablePaths,
      readablePaths: manifest.readablePaths,
      protectedOrExcluded: ["paths outside territory", "undeclared writable paths when writablePaths is nonempty", ".git", "node_modules", ".lake", "dist", "coverage", "operational data records unless the objective names them"],
    },
    targetArtifacts,
    evidenceArtifacts,
    omittedArtifacts,
    repositoryMap: { filesObserved: snapshot.files.length, truncated: false, files: snapshot.files },
    priorVerifiedKnowledge,
    priorResidueKnowledge,
    constraints: manifest.constraints || [],
    firstMoves: [
      "Use the supplied focus and interface artifacts before asking to list or read anything.",
      "If exact focus bytes are present and untruncated, edit from those bytes on the first turn when the repair is determined.",
      "Create every must-create target needed by the acceptance command in the same candidate workspace.",
      "Translate every acceptanceTestVector into regression assertions; do not weaken, omit, or replace a vector with a nearby example.",
      "Use tools only for missing evidence, mutation, or host-computed checks; do not inspect stale mission or operational records unless named by the objective.",
    ],
    outputContract: { rule: "Return exactly one tool action per inference turn; the host computes every digest, scope verdict, command result, and integration decision.", actionSchema },
    packetQuality: {
      selfContainment: targetPaths.length > 0 && targetPaths.every((path) => evidenceArtifacts.some((artifact) => artifact.path === path) || targetArtifacts.some((artifact) => artifact.path === path)),
      machineCheckableGoalConditions: Boolean(manifest.verifyCommand && manifest.acceptanceCommand),
      executableAcceptanceExamples: Array.isArray(manifest.testVectors) && manifest.testVectors.length > 0
        && manifest.testVectors.every((vector) => vector.given.length > 0 && vector.when.length > 0 && vector.then.length > 0),
      laneBoundaries: Boolean(root && Array.isArray(manifest.focusPaths) && Array.isArray(manifest.writablePaths) && Array.isArray(manifest.readablePaths)),
      resolvableCitations: evidenceArtifacts.every((artifact) => (artifact.role === "protected-acceptance" || existsSync(inside(root, artifact.path))) && artifact.digest.startsWith("sha256:")),
      outputContract: Boolean(actionSchema?.type === "object"),
    },
    resourceAccount: {
      artifactBytesSupplied: usedBytes,
      priorKnowledgeBytesSupplied: Buffer.byteLength(JSON.stringify({ priorVerifiedKnowledge, priorResidueKnowledge })),
      acceptanceTestVectorBytesSupplied: Buffer.byteLength(JSON.stringify(manifest.testVectors)),
      erasures: [],
    },
  };
  packet.digest = sha256Digest(JSON.stringify(packet));
  return packet;
}

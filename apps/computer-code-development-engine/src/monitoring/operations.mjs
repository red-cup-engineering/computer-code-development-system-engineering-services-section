/** RPC inbound adapters for source-code monitoring application reads. */
import path from "node:path";
import { workspaceReadoutOperations } from "../workspace/readout.mjs";

import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { operationHandlerResult } from "@red-cup-engineering/computer-system-engine/rpc/execution-context";
import { tm } from "@red-cup-engineering/computer-data-services-section/semiotic-expression-notation";

import { INITIAL_CAUSAL_RESOURCE_ENVELOPE } from "@red-cup-engineering/semiotic-eavt-services-section/journal/witness";
import { journal, openJournal } from "@red-cup-engineering/computer-system-engine/journal/journal";
import {
  moduleTopologyPageContract,
  moduleTopologyReadRequestContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/schema";
import { moduleTopologyOfCorpus, moduleTopologyPage } from "./source-code/topology/service.mjs";
import { readModuleTopology } from "./source-code/topology/service.mjs";
import {
  workspaceDependencyGraphContract,
  workspaceImportAuditContract,
  workspaceImportAuditRequestContract,
  workspacePackageConformanceContract,
  workspacePackageConformanceRequestContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace/schema";
import { egoWorkspaceDependencyGraph, workspaceDependencyGraphOf } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace";
import { workspaceImportAuditOf } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace/import-audit";
import { packageJsonDirectoryProvider } from "./package-json-directory-provider.mjs";

import { attributePredicate, decodeJsonGraphValue } from "@red-cup-engineering/flatfile-resource-graph-service/attribute-projection";
import {
  scanDeclaredWorkspace,
  scanLockfile,
} from "@red-cup-engineering/computer-code-development-engine/workspace/scanner/service";
import { workspaceScan } from "@red-cup-engineering/computer-code-development-engine/workspace/scanner";
import {
  moduleCohesionPageContract,
  moduleCohesionReadRequestContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/schema";
import { moduleCohesionOfCorpus, moduleCohesionPage } from "./source-code/cohesion/service.mjs";
import {
  moduleCohesionHistoryOfStages,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/history";
import { moduleCohesionHistoryContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/schema";
import {
  evaluateSourceCodePolicies,
  DEFAULT_SOURCE_CODE_POLICIES,
  sourceCodePolicyArtifacts,
  sourceCodePolicyPage,
  sourceCodePolicyPageContract,
  sourceCodePolicyReadRequestContract,
  sourceCodePolicyHistoryContract,
  sourceCodePolicyHistoryOfStages,
  sourceCodePolicyAdmissionContract,
  sourceCodePolicyStage,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/policy";
import { moduleTopologyValuation } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/valuation";
import { readSourceCodeMonitorAggregate } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/aggregate";
import {
  moduleTopologyValuationHistoryContract,
  moduleTopologyValuationHistoryOfStages,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/history";
import {
  sourceCodePolicyObligations,
  sourceCodePolicyObligationDelta,
} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/work";
import { claimSessionObservationBundleContract } from "@red-cup-engineering/relating/running/session-schema";
import { claimSessionFeed, claimSessionStatementRows } from "@red-cup-engineering/relating/running/session";
import { workLedgerObligationCollector } from "@red-cup-engineering/organizing/work/observations";
import {
  DEFAULT_SOURCE_DIRECTORIES,
  DEFAULT_SOURCE_FILE_LIMIT,
  readSourceModuleCorpus,
  sourceModuleArtifacts,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/filesystem";
import { nodeSubjectAnchorSource, readNodeSubjectAnchor } from "@red-cup-engineering/communicating/language/jsnode/taxonomy";
import {
  packageFormNormalizationSchema,
} from "@red-cup-engineering/computer-code-development-engine/workspace/package-form/schema";
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { eavtRecord } from "@red-cup-engineering/eavt/row";

/** Process/application configuration for source-code monitoring adapters. */

const sourceCodePolicyNormalizationRequestContract = schemaFrom({
  $id: "metroplat/monitoring/source-code/policy-normalization-request",
  type: "object",
  required: ["kind", "cut"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.policy-normalization-request" },
    root: { type: "string", minLength: 1 },
    sourceDirs: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    maxFiles: { type: "integer", minimum: 1 },
    cut: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    apply: { type: "boolean" },
  },
});

const sourceCodePolicyNormalizationContract = schemaFrom({
  $id: "metroplat/monitoring/source-code/policy-normalization",
  type: "object",
  required: ["kind", "source", "topology", "observation", "cut", "actionability", "judgement", "execution"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.policy-normalization" },
    source: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    topology: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    observation: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    cut: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
    actionability: { const: "held" },
    judgement: { const: "denied" },
    execution: packageFormNormalizationSchema,
  },
});

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
}

function rpcOutcomeEnvelope(value, verb) {
  const evidence = inputRecord(value);
  if (evidence["kind"] !== "metroplat.rpc.outcome") return undefined;
  const receipt = inputRecord(evidence["receipt"]);
  const invocation = inputRecord(receipt["invocation"]);
  if (receipt["ok"] !== true || invocation["verb"] !== verb) return undefined;
  const at = receipt["completedAt"];
  const id = receipt["id"];
  const invocationId = invocation["id"];
  const causes = invocation["causes"];
  if (typeof at !== "string" || typeof id !== "string" || typeof invocationId !== "string") return undefined;
  return Object.freeze({
    value: receipt["value"],
    at,
    invocation: invocationId,
    receipt: id,
    causes: Object.freeze(Array.isArray(causes) ? causes.filter((cause) => typeof cause === "string") : []),
  });
}

function moduleCohesionStageOfRpcOutcome(value) {
  const outcome = rpcOutcomeEnvelope(value, "module-cohesion");
  if (outcome === undefined) return undefined;
  try {
    const page = moduleCohesionPageContract.assert(outcome.value, "journaled module-cohesion outcome");
    return Object.freeze({
      source: page.source,
      observation: page.observation,
      at: outcome.at,
      invocation: outcome.invocation,
      receipt: outcome.receipt,
      causes: outcome.causes,
      valuation: page.valuation,
    });
  } catch {
    // Old or malformed outcomes remain journal evidence but are not presented
    // as inhabitants of the current monitoring contract.
    return undefined;
  }
}

function moduleTopologyValuationStageOfRpcOutcome(value) {
  const outcome = rpcOutcomeEnvelope(value, "module-topology-valuation");
  if (outcome === undefined) return undefined;
  const v = inputRecord(outcome.value);
  if (v["kind"] !== "metroplat.monitoring.source-code.module-topology-valuation") return undefined;
  const source = typeof v["source"] === "string" ? v["source"] : undefined;
  const observation = typeof v["observation"] === "string" ? v["observation"] : undefined;
  if (source === undefined || observation === undefined) return undefined;
  const summaryRaw = v["summary"];
  if (summaryRaw === null || typeof summaryRaw !== "object" || Array.isArray(summaryRaw)) return undefined;
  const sr = summaryRaw;
  const held    = typeof sr["held"]      === "number" ? sr["held"]      : 0;
  const denied  = typeof sr["denied"]    === "number" ? sr["denied"]    : 0;
  const contested = typeof sr["contested"] === "number" ? sr["contested"] : 0;
  const unknown   = typeof sr["unknown"]   === "number" ? sr["unknown"]   : 0;
  return Object.freeze({
    source,
    observation,
    at: outcome.at,
    invocation: outcome.invocation,
    receipt: outcome.receipt,
    causes: outcome.causes,
    summary: Object.freeze({ held, denied, contested, unknown }),
  });
}

function sourceCodePolicyStageOfRpcOutcome(value) {
  const outcome = rpcOutcomeEnvelope(value, "source-code-policy");
  if (outcome === undefined) return undefined;
  try {
    const page = sourceCodePolicyPageContract.assert(outcome.value, "journaled source-code-policy outcome");
    return sourceCodePolicyStage({
      source: page.source,
      topology: page.topology,
      observation: page.observation,
      policies: page.policies,
      at: outcome.at,
      invocation: outcome.invocation,
      receipt: outcome.receipt,
      causes: outcome.causes,
      summary: page.summary,
    });
  } catch {
    return undefined;
  }
}

function optionalPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : undefined;
}

function optionalNonnegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function optionalStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0)
    ? Object.freeze([...value])
    : undefined;
}

function governedSourceCorpus(
  root,
  sourceDirs,
  maxFiles,
  options,
  reservedArtifactSlots = 2,
) {
  return readSourceModuleCorpus(
    root,
    sourceDirs ?? DEFAULT_SOURCE_DIRECTORIES,
    Math.min(
      maxFiles ?? DEFAULT_SOURCE_FILE_LIMIT,
      INITIAL_CAUSAL_RESOURCE_ENVELOPE.maxReferencedArtifacts - reservedArtifactSlots,
    ),
    options,
  );
}

const SOURCE_CODE_POLICY_READS = Object.freeze(
  DEFAULT_SOURCE_CODE_POLICIES.map((policy) => tm.mark(policy.identity)),
);
const SOURCE_CODE_POLICY_ARTIFACTS = sourceCodePolicyArtifacts(DEFAULT_SOURCE_CODE_POLICIES);

function governedPolicyArtifacts(corpus) {
  const artifacts = new Map(
    [...sourceModuleArtifacts(corpus), ...SOURCE_CODE_POLICY_ARTIFACTS]
      .map((artifact) => [artifact.ref, artifact]),
  );
  return Object.freeze([...artifacts.values()].sort((left, right) => left.ref.localeCompare(right.ref)));
}

function sourcePolicyLifecycleState(root) {
  const collector = workLedgerObligationCollector();
  const heads = new Set();
  journal.scanCausalTerritory(root, collector, (state, row, event) => {
    state.push(row);
    const { v } = eavtRecord(row);
    const value = inputRecord(v);
    const boundary = inputRecord(value["boundary"]);
    const evidence = boundary["evidence"];
    if (Array.isArray(evidence) && evidence.includes("producer:source-code-policy")) {
      for (const cause of event.core.causes) heads.delete(cause);
      heads.add(event.id);
    }
    return state;
  });
  return Object.freeze({
    obligations: collector.read(),
    heads: Object.freeze([...heads].sort()),
  });
}

function readStagesFromRpcJournal(
  root,
  dates,
  stageOf,
) {
  const stages = [];
  let rows = 0;
  let malformed = 0;
  for (const date of [...new Set(dates)].sort()) {
    const feed = journal.feed(root, "rpc", date, { subject: "rpc" });
    if (!journal.sourceStatus(feed).exists) continue;
    const scan = journal.scan(feed, stages, (accumulator, row) => {
      const { a, v } = eavtRecord(row);
      const attribute = a !== null && typeof a === "object" && !Array.isArray(a)
        ? a
        : undefined;
      if (attribute?.["kind"] !== "metroplat.rpc.outcome") return accumulator;
      const stage = stageOf(v);
      if (stage !== undefined) accumulator.push(stage);
      return accumulator;
    });
    rows += scan.rows;
    malformed += scan.malformed;
  }
  return Object.freeze({ rows, malformed, stages: Object.freeze(stages) });
}

/** Traverse the canonical RPC journal, then delegate temporal judgment to the pure monitor fold. */
export function readModuleCohesionHistoryFromJournal(
  root,
  dates,
  options = {},
) {
  return moduleCohesionHistoryOfStages(
    dates,
    readStagesFromRpcJournal(root, dates, moduleCohesionStageOfRpcOutcome),
    options,
  );
}

export function readModuleTopologyValuationHistoryFromJournal(
  root,
  dates,
  options = {},
) {
  return moduleTopologyValuationHistoryOfStages(
    dates,
    readStagesFromRpcJournal(root, dates, moduleTopologyValuationStageOfRpcOutcome),
    options,
  );
}

export function readSourceCodePolicyHistoryFromJournal(
  root,
  dates,
  options = {},
) {
  return sourceCodePolicyHistoryOfStages(
    dates,
    readStagesFromRpcJournal(root, dates, sourceCodePolicyStageOfRpcOutcome),
    options,
  );
}

const inquiryRootProperty = { type: "string", minLength: 1 };
const inquiryPathsProperty = { type: "array", minItems: 1, maxItems: 20, items: inquiryRootProperty };

/** Bind code observation to the real repository while keeping journal authority at dataRoot. */
function inquiryRootOf(binding, record) {
  if (binding.repositoryRoot === undefined) throw new TypeError("code inquiry requires a bound repositoryRoot");
  const repository = binding.realPathOrNull(binding.repositoryRoot);
  const requested = binding.realPathOrNull(path.resolve(binding.repositoryRoot, record.root ?? "."));
  if (repository === null || requested === null) throw new TypeError("code inquiry root is unavailable");
  const relative = path.relative(repository, requested);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new RangeError("code inquiry root is outside repositoryRoot");
  }
  if (record.sourceDirs !== undefined) for (const directory of record.sourceDirs) {
    inquiryRootOf(binding, { root: path.resolve(requested, directory) });
  }
  return requested;
}

function inquiryAstRequest(verb) {
  return schemaFrom({
    $id: `code-inquiry/${verb}/request`,
    type: "object", additionalProperties: false, required: ["sourceDirs", "maxFiles"],
    properties: {
      root: inquiryRootProperty, sourceDirs: inquiryPathsProperty,
      maxFiles: { type: "integer", minimum: 1, maximum: 200 },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: 50 },
      ...(verb === "source-code-policy" ? {} : {
        includeSymbols: { type: "boolean" },
        ...(verb === "module-cohesion" ? { minSymbols: { type: "integer", minimum: 1 } } : {
          paths: inquiryPathsProperty,
          subjectAnchors: { type: "array", maxItems: 200 },
          subjectAnchorCoverage: { enum: ["partial", "complete"] },
        }),
      }),
    },
  });
}

const inquiryGraphRequest = schemaFrom({
  $id: "code-inquiry/workspace-graph/request",
  type: "object", additionalProperties: false, required: ["name"],
  properties: {
    name: inquiryRootProperty, root: inquiryRootProperty,
    downDepth: { type: "integer", minimum: 0, maximum: 2 },
    upDepth: { type: "integer", minimum: 0, maximum: 2 },
  },
});
const inquiryImportRequest = schemaFrom({
  ...workspaceImportAuditRequestContract.schema,
  $id: "code-inquiry/workspace-import-audit/request",
  type: "object", additionalProperties: false, required: ["paths"],
  properties: { root: inquiryRootProperty, paths: inquiryPathsProperty },
});

/** Engineering work resources: bounded workspace reads and writes, consumer
 * conformance, normalization and policy evidence. Each operation retains its
 * own effect contract and requires the allocated skill's separate authority. */
export function codeWorkspaceOperations(binding, options = {}) {
  const reads = new Set(["module-topology", "module-cohesion"]);
  return Object.freeze([
    ...workspaceReadoutOperations(binding, options),
    ...workspaceGraphOperations(binding, { inquiry: true }),
    ...sourceCodePolicyOperations(binding, { inquiry: true }),
    ...[
      ...moduleTopologyOperations(binding, { inquiry: true }),
      ...moduleCohesionOperations(binding, { inquiry: true }),
    ].filter((candidate) => reads.has(candidate.verb)),
  ]);
}

export function moduleTopologyOperations(binding, { inquiry = false } = {}) {
  return Object.freeze([operation({
    verb: "module-topology",
    ...(inquiry ? { domain: inquiryAstRequest("module-topology") } : {}),
    relation: "projection",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Read package source topology from the TypeScript AST.",
    description: "Domain: { root?, sourceDirs?, subjectAnchors?, subjectAnchorCoverage?, paths?, maxFiles?, offset?, limit?, includeSymbols? }. Anchor coverage defaults to partial, so absence remains unknown; complete coverage licenses cross-cutting readings. Aggregate measurements cover the complete observed source set; each path focuses details on one exact module or every module below that directory prefix, including reverse consumers, while the deterministic page remains content-addressable.",
    codomain: moduleTopologyPageContract,
    run: (input) => {
      const record = inputRecord(input);
      const root = inquiry ? inquiryRootOf(binding, record)
      : typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.packageRoot;
      if (root === undefined) return null;
      const sourceDirs = optionalStringArray(record["sourceDirs"]);
      const subjectAnchors = Array.isArray(record["subjectAnchors"]) ? record["subjectAnchors"] : undefined;
      const subjectAnchorCoverage = record["subjectAnchorCoverage"];
      const paths = optionalStringArray(record["paths"]);
      const maxFiles = optionalPositiveInteger(record["maxFiles"]);
      const offset = optionalNonnegativeInteger(record["offset"]);
      const limit = optionalPositiveInteger(record["limit"]);
      const includeSymbols = record["includeSymbols"] === true;
      const request = moduleTopologyReadRequestContract.assert(Object.freeze({
        kind: "metroplat.module-topology.read-request",
        root,
        ...(sourceDirs === undefined ? {} : { sourceDirs }),
        ...(subjectAnchors === undefined ? {} : { subjectAnchors }),
        ...(subjectAnchorCoverage === undefined ? {} : { subjectAnchorCoverage }),
        ...(paths === undefined ? {} : { paths }),
        ...(maxFiles === undefined ? {} : { maxFiles }),
        ...(offset === undefined ? {} : { offset }),
        ...(limit === undefined ? {} : { limit }),
        ...(includeSymbols ? { includeSymbols: true } : {}),
      }), "module-topology input");
      const corpus = governedSourceCorpus(request.root, request.sourceDirs, request.maxFiles, binding);
      const page = moduleTopologyPage(moduleTopologyOfCorpus(corpus, {
        ...(request.subjectAnchors === undefined ? {} : {
          subjectAnchors: request.subjectAnchors.map((anchor) => readNodeSubjectAnchor(anchor)),
        }),
        ...(request.subjectAnchorCoverage === undefined ? {} : { subjectAnchorCoverage: request.subjectAnchorCoverage }),
      }), {
        ...(request.offset === undefined ? {} : { offset: request.offset }),
        ...(request.limit === undefined ? {} : { limit: request.limit }),
        ...(request.includeSymbols === true ? { includeSymbols: true } : {}),
        ...(request.paths === undefined ? {} : { paths: request.paths }),
      });
      return operationHandlerResult(page, [], Object.freeze([
        ...sourceModuleArtifacts(corpus),
        ...page.subjectAnchors.map((anchor) => nodeSubjectAnchorSource(anchor)),
      ]));
    },
  })]);
}

export function workspacePackageConformanceOfFlatfileObservation(root, observation) {
  const packages = observation.resources.map((resource) => {
    if (typeof resource.focus !== "string" || resource.focus.length === 0) {
      throw new TypeError(`flatfile package observation ${resource.resource} has no package name`);
    }
    const review = resource.cells.find((cell) => cell.predicate === attributePredicate("packageReview"));
    if (review === undefined) throw new TypeError(`flatfile package observation ${resource.resource} has no package review`);
    const decoded = decodeJsonGraphValue(review.object);
    if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new TypeError(`flatfile package observation ${resource.resource} has a malformed package review`);
    }
    const deviationsRaw = (decoded)["deviations"];
    if (!Array.isArray(deviationsRaw)) throw new TypeError(`flatfile package observation ${resource.resource} has no package-review deviations`);
    const deviations = deviationsRaw.map((deviation) => {
      if (deviation === null || typeof deviation !== "object" || Array.isArray(deviation)) {
        throw new TypeError(`flatfile package observation ${resource.resource} has a malformed package-review deviation`);
      }
      const candidate = deviation;
      if (typeof candidate["code"] !== "string" || candidate["code"].length === 0
        || typeof candidate["detail"] !== "string" || candidate["detail"].length === 0) {
        throw new TypeError(`flatfile package observation ${resource.resource} has a malformed package-review deviation`);
      }
      return Object.freeze({ code: candidate["code"], detail: candidate["detail"] });
    });
    return Object.freeze({ resource: resource.resource, name: resource.focus, deviations: Object.freeze(deviations) });
  });
  return workspacePackageConformanceContract.assert(Object.freeze({
    kind: "metroplat.workspace-graph.package-conformance",
    root,
    packages: Object.freeze(packages),
    diagnostics: Object.freeze((observation.diagnostics ?? []).map((diagnostic) => {
      if (typeof diagnostic.code !== "string" || diagnostic.code.length === 0
        || typeof diagnostic.path !== "string" || diagnostic.path.length === 0
        || typeof diagnostic.message !== "string" || diagnostic.message.length === 0) {
        throw new TypeError("flatfile package observation has a malformed diagnostic");
      }
      return Object.freeze({ ...diagnostic });
    })),
    deviationCount: packages.reduce((count, entry) => count + entry.deviations.length, 0),
  }), "flatfile workspace package conformance");
}

/** Source directories the import audit reads: the house's own
 *  scripts/apps/src import-stratification law (import-stratification.md)
 *  names strata `DEFAULT_SOURCE_DIRECTORIES` never scans by default. */
const IMPORT_AUDIT_SOURCE_DIRECTORIES = Object.freeze([
  ...DEFAULT_SOURCE_DIRECTORIES,
  "scripts",
  "apps",
]);

/**
 * Scan one workspace for the import audit: unscoped, the resolved root's own
 * declared-workspace discovery (`scanDeclaredWorkspace`, matching
 * `workspace-graph`'s and `workspace-package-conformance`'s root); scoped by
 * `paths`, each named directory is scanned as its own workspace root and the
 * discovered packages are merged, so a lot can gate only its changed
 * packages without a shallow, depth-bounded walk from the full checkout root
 * missing them.
 */
function importAuditWorkspaceScan(requestedRoot, paths, options) {
  if (paths === undefined) return scanDeclaredWorkspace(requestedRoot, options);
  const packages = paths
    .map((candidate) => path.resolve(requestedRoot, candidate))
    .flatMap((candidateRoot) => scanDeclaredWorkspace(candidateRoot, options).packages);
  return workspaceScan(requestedRoot, packages);
}

/** Host-bound adapters for the pure workspace source-code monitor. */
export function workspaceGraphOperations(binding, { inquiry = false } = {}) {
  return Object.freeze([
    operation({
      verb: "workspace-graph",
      relation: "projection",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read the workspace internal package dependency graph.",
      description: inquiry
        ? "Domain: { name, root?, downDepth?, upDepth? }. Reads a complete closed package neighbourhood in the bound repository. Depths are at most 2; a result exceeding 100 nodes or 400 edges is refused, never truncated. Dependencies outside the selected neighbourhood are omitted by the declared scope."
        : "Domain: {}. Reads declared workspace packages from dataRoot and folds internal dependency edges.",
      ...(inquiry ? { domain: inquiryGraphRequest } : {}),
      codomain: workspaceDependencyGraphContract,
      run: (input) => {
        const root = inquiry ? inquiryRootOf(binding, input) : binding.dataRoot;
        if (root === undefined) return null;
        const scan = scanDeclaredWorkspace(root, binding);
        const lockfile = scanLockfile(root, binding);
        const graph = workspaceDependencyGraphOf(scan, {
          ...(lockfile.kind === "metroplat.admission.pnpm-lockfile" ? { lockfile } : {}),
        });
        if (!inquiry) return graph;
        if (!graph.nodes.some((node) => node.name === input.name)) throw new RangeError("named package is not admitted by the workspace declaration");
        const neighbourhood = egoWorkspaceDependencyGraph(graph, input.name, {
          downDepth: input.downDepth ?? 1, upDepth: input.upDepth ?? 1,
        });
        if (neighbourhood.nodes.length > 100 || neighbourhood.edges.length > 400) {
          throw new RangeError("package neighbourhood exceeds the inquiry bound; reduce downDepth or upDepth");
        }
        return neighbourhood;
      },
    }),
    operation({
      verb: "workspace-import-audit",
      relation: "projection",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Cross-check workspace dependency declarations against source imports.",
      description: "Domain: { root?: string, paths?: string[] }. Reads workspace graph plus per-package TypeScript topology from the resolved root (request.root, else dataRoot), optionally scoped to named package directories; refuses a resolved root that admits no package.",
      domain: inquiry ? inquiryImportRequest : workspaceImportAuditRequestContract,
      codomain: workspaceImportAuditContract,
      run: (input) => {
        const request = workspaceImportAuditRequestContract.assert(input, "workspace import audit request");
        const requestedRoot = inquiry ? inquiryRootOf(binding, request) : request.root ?? binding.dataRoot;
        if (requestedRoot === undefined) return null;
        const paths = inquiry ? request.paths.map((root) => inquiryRootOf(binding, { root: path.resolve(requestedRoot, root) })) : request.paths;
        const scan = importAuditWorkspaceScan(requestedRoot, paths, binding);
        const lockfile = request.paths === undefined ? scanLockfile(requestedRoot, binding) : undefined;
        const graph = workspaceDependencyGraphOf(scan, {
          ...(lockfile?.kind === "metroplat.admission.pnpm-lockfile" ? { lockfile } : {}),
        });
        const topologyByPackage = new Map(
          graph.nodes.map((node) => [node.name, readModuleTopology(node.root, { ...binding, sourceDirs: IMPORT_AUDIT_SOURCE_DIRECTORIES })]),
        );
        return workspaceImportAuditOf({ graph, topologyByPackage });
      },
    }),
    operation({
      verb: "workspace-package-conformance",
      relation: "projection",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read flatfile-projected package-conformance observations for the workspace.",
      description: "Domain: { root?: string }. Reads the requested workspace root through the flatfile platform while retaining the host binding for authority.",
      domain: workspacePackageConformanceRequestContract,
      codomain: workspacePackageConformanceContract,
      run: async (input) => {
        const request = workspacePackageConformanceRequestContract.assert(input, "workspace package conformance request");
        const requestedRoot = inquiry ? inquiryRootOf(binding, request) : request.root ?? binding.dataRoot;
        if (requestedRoot === undefined) return null;
        const observation = await packageJsonDirectoryProvider({
          id: "urn:metroplat:workspace-package-conformance",
          root: requestedRoot,
        }).observe({});
        return workspacePackageConformanceOfFlatfileObservation(requestedRoot, observation);
      },
    }),
  ]);
}

/** The default source policy through the same bounded RPC boundary as its topology evidence.
 *  `binding.normalizePackageForm` (the sibling `../integrations/filesystem/services/package-form/service.mjs`'s
 *  export of the same name -- a real carrier-moving filesystem actuator) is required by the
 *  `normalize-package-form` verb; this module never imports that actuator itself, so its own
 *  purity never depends on it. */
export function sourceCodePolicyOperations(binding, { inquiry = false } = {}) {
  const readEvaluation = (input) => {
    const record = inputRecord(input);
    const root = inquiry ? inquiryRootOf(binding, record)
      : typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.packageRoot;
    if (root === undefined) return undefined;
    const sourceDirs = optionalStringArray(record["sourceDirs"]);
    const maxFiles = optionalPositiveInteger(record["maxFiles"]);
    const offset = optionalNonnegativeInteger(record["offset"]);
    const limit = optionalPositiveInteger(record["limit"]);
    const request = sourceCodePolicyReadRequestContract.assert(Object.freeze({
      kind: "metroplat.monitoring.source-code.policy-read-request",
      root,
      ...(sourceDirs === undefined ? {} : { sourceDirs }),
      ...(maxFiles === undefined ? {} : { maxFiles }),
      ...(offset === undefined ? {} : { offset }),
      ...(limit === undefined ? {} : { limit }),
    }), "source-code-policy input");
    // Boundary observation + corpus manifest + every default policy declaration.
    const corpus = governedSourceCorpus(
      request.root,
      request.sourceDirs,
      request.maxFiles,
      binding,
      2 + SOURCE_CODE_POLICY_ARTIFACTS.length,
    );
    // includeSymbols must stay at its default (true): the normalization-cut
    // ruling's layout-convention/subject-anchor detection reads per-symbol
    // @metroplatSubject JSDoc, so disabling symbol extraction here silently
    // drops that ruling from every operation sharing this read (including
    // normalize-package-form, which then can't find its own just-computed
    // cut as a currently denied actionable move).
    return Object.freeze({ request, corpus, evaluation: evaluateSourceCodePolicies(moduleTopologyOfCorpus(corpus)) });
  };
  return Object.freeze([operation({
    verb: "source-code-policy",
    ...(inquiry ? { domain: inquiryAstRequest("source-code-policy") } : {}),
    relation: "projection",
    reads: SOURCE_CODE_POLICY_READS,
    inputFormat: "json",
    outputFormat: "json",
    summary: "Judge local source imports with the default FOUR-valued policy.",
    description: "Domain: { root?, sourceDirs?, maxFiles?, offset?, limit? }. Projects the admitted source topology into predication, evaluates the explicit default local-target policy to a least fixed point, and returns a bounded ruling page with aggregate contradiction and coordination readings.",
    codomain: sourceCodePolicyPageContract,
    run: (input) => {
      const read = readEvaluation(input);
      if (read === undefined) return null;
      const page = sourceCodePolicyPage(read.evaluation, {
        ...(read.request.offset === undefined ? {} : { offset: read.request.offset }),
        ...(read.request.limit === undefined ? {} : { limit: read.request.limit }),
      });
      return operationHandlerResult(page, [], governedPolicyArtifacts(read.corpus));
    },
  }), operation({
    verb: "normalize-package-form",
    relation: "boundary",
    reads: SOURCE_CODE_POLICY_READS,
    inputFormat: "json",
    outputFormat: "json",
    effects: {
      class: "external",
      replay: "idempotency-key",
      coordination: "coordination-free",
      deterministic: "unmeasured",
      totality: "partial",
    },
    domain: sourceCodePolicyNormalizationRequestContract,
    codomain: sourceCodePolicyNormalizationContract,
    summary: "Execute one exact currently denied source-code normalization cut.",
    description: "Domain: { kind, cut, root?, sourceDirs?, maxFiles?, apply? }. Re-reads the governed source corpus and default policy, selects the exact content-identified cut only while it remains actionable and denied, and delegates its move-module carrier effect to the existing package-form actuator. Dry-run is the default.",
    run: async (input) => {
      const request = sourceCodePolicyNormalizationRequestContract.assert(input, "normalize-package-form input")

;
      const read = readEvaluation(request);
      if (read === undefined) return null;
      const ruling = read.evaluation.rulings.find((candidate) =>
        candidate.kind === "metroplat.monitoring.source-code.normalization-cut-ruling"
        && candidate.cut.identity === request.cut
        && candidate.cut.action === "move-module"
        && candidate.actionability === "held"
        && candidate.judgement === "denied");
      if (ruling === undefined || ruling.kind !== "metroplat.monitoring.source-code.normalization-cut-ruling") {
        throw new TypeError(`normalize-package-form: ${request.cut} is not a currently denied actionable move-module cut`);
      }
      const execution = await binding.normalizePackageForm({
        kind: "metroplat.jsnode.package-form.normalization-request",
        root: read.request.root,
        from: ruling.cut.from,
        to: ruling.cut.to,
        apply: request.apply === true,
      });
      const result = sourceCodePolicyNormalizationContract.assert(Object.freeze({
        kind: "metroplat.monitoring.source-code.policy-normalization",
        source: read.evaluation.source,
        topology: read.evaluation.topology,
        observation: read.evaluation.observation,
        cut: ruling.cut.identity,
        actionability: "held",
        judgement: "denied",
        execution,
      }), "source-code policy normalization");
      return operationHandlerResult(result, [], governedPolicyArtifacts(read.corpus));
    },
  }), operation({
    verb: "module-topology-valuation",
    relation: "projection",
    reads: SOURCE_CODE_POLICY_READS,
    inputFormat: "json",
    outputFormat: "json",
    summary: "Assign FOUR-valued Belnap readings to each source module from its local-import policy rulings.",
    description: "Domain: { root?, sourceDirs?, maxFiles? }. Runs the default source-code policy evaluation, then joins each module's local-import ruling readings in the Belnap knowledge lattice. Each observed module receives a held/denied/contested/unknown reading; a module with no local-import rulings carries implicit unknown (no evidence either way). Returns a content-addressed ModuleTopologyValuation with per-module readings and a four-census summary. This completes the paraconsistent Monitor (M) phase of the MAPE-K loop.",
    run: (input) => {
      const read = readEvaluation(input);
      if (read === undefined) return null;
      const valuation = moduleTopologyValuation(read.evaluation);
      return operationHandlerResult(valuation, [], governedPolicyArtifacts(read.corpus));
    },
  }), operation({
    verb: "source-code-monitor-aggregate",
    relation: "projection",
    reads: SOURCE_CODE_POLICY_READS,
    inputFormat: "json",
    outputFormat: "json",
    summary: "Unified paraconsistent Monitor aggregate over all source-code subsystems.",
    description: "Domain: { root?, sourceDirs?, maxFiles? }. Runs the default source-code policy evaluation and joins the policy, topology, and build-order subsystem signals in the Belnap knowledge lattice to produce a single package-level paraconsistent reading. The returned aggregate carries per-subsystem evidence records suitable for temporal tracking via recordHistoryOfStages. This is the canonical Monitor (M) output for MAPE-K Analyze consumption.",
    run: (input) => {
      const read = readEvaluation(input);
      if (read === undefined) return null;
      const tv = moduleTopologyValuation(read.evaluation);
      const aggregate = readSourceCodeMonitorAggregate(read.evaluation, tv, {
        sourceDirs: read.corpus.sourceDirs,
        files: read.corpus.files.length,
        truncated: read.corpus.truncated,
      });
      return operationHandlerResult(aggregate, [], governedPolicyArtifacts(read.corpus));
    },
  }), operation({
    verb: "module-topology-valuation-history",
    relation: "projection",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Read the bounded history of admitted module-topology-valuation observations.",
    description: "Domain: { dates?: YYYY-MM-DD[1..31], maxStages?: 1..100 }. Projects per-observation FOUR-census summaries into evidence Records (pos=held, neg=denied+contested) and relates consecutive content-identified outcomes in the Belnap knowledge and truth orders. Truth-ascending transitions signal improving conformance; truth-descending transitions signal regression; incomparable transitions surface paraconsistent co-movement.",
    codomain: moduleTopologyValuationHistoryContract,
    run: (input) => {
      if (binding.dataRoot === undefined) return null;
      const record = inputRecord(input);
      const dates = optionalStringArray(record["dates"])
        ?? Object.freeze([binding.now().slice(0, 10)]);
      const maxStages = optionalPositiveInteger(record["maxStages"]);
      return readModuleTopologyValuationHistoryFromJournal(binding.dataRoot, dates, {
        ...(maxStages === undefined ? {} : { maxStages }),
      });
    },
  }), operation({
    verb: "source-code-policy-history",
    relation: "projection",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Read the bounded history of admitted source-code policy observations.",
    description: "Domain: { dates?: YYYY-MM-DD[1..31], maxStages?: 1..100 }. Projects policy censuses into faithful evidence Records and relates consecutive content-identified outcomes in Obsmetrologia's knowledge and truth orders.",
    codomain: sourceCodePolicyHistoryContract,
    run: (input) => {
      if (binding.dataRoot === undefined) return null;
      const record = inputRecord(input);
      const dates = optionalStringArray(record["dates"])
        ?? Object.freeze([binding.now().slice(0, 10)]);
      const maxStages = optionalPositiveInteger(record["maxStages"]);
      return readSourceCodePolicyHistoryFromJournal(binding.dataRoot, dates, {
        ...(maxStages === undefined ? {} : { maxStages }),
      });
    },
  }), operation({
    verb: "source-code-policy-obligations",
    relation: "projection",
    reads: SOURCE_CODE_POLICY_READS,
    inputFormat: "json",
    outputFormat: "json",
    summary: "Project non-held source policy rulings into work obligations.",
    description: "Domain: { root?, sourceDirs?, maxFiles? }. Returns canonical claim-session work material without admitting it: denied rulings become repair obligations, contested rulings retain reconciliation evidence, and held/unknown rulings create no work.",
    codomain: claimSessionObservationBundleContract,
    run: (input) => {
      const read = readEvaluation(input);
      if (read === undefined) return null;
      return operationHandlerResult(
        sourceCodePolicyObligations(read.evaluation),
        [],
        governedPolicyArtifacts(read.corpus),
      );
    },
  }), operation({
    verb: "source-code-policy-obligations-admit",
    reads: SOURCE_CODE_POLICY_READS,
    inputFormat: "json",
    outputFormat: "json",
    summary: "Admit the lifecycle delta of source policy work obligations.",
    description: "Domain: { root?, sourceDirs?, maxFiles? }. Explicitly appends only newly opened or newly resolved source-policy work items. Unchanged findings are idempotent; resolved or removed findings discharge their original cells; recurring findings can reopen.",
    effects: {
      class: "journal-write",
      replay: "idempotency-key",
      coordination: "coordination-free",
      deterministic: "unmeasured",
      totality: "unmeasured",
    },
    codomain: sourceCodePolicyAdmissionContract,
    run: (input, _arguments, context) => {
      if (binding.dataRoot === undefined) return null;
      const read = readEvaluation(input);
      if (read === undefined) return null;
      const lifecycle = sourcePolicyLifecycleState(binding.dataRoot);
      const delta = sourceCodePolicyObligationDelta(read.evaluation, lifecycle.obligations);
      const opened = delta.observations.filter((observation) =>
        (observation.boundary)?.role === "obligation").length;
      const discharged = delta.observations.filter((observation) =>
        (observation.boundary)?.role === "discharge").length;
      const at = binding.now();
      const rows = delta.observations.flatMap((observation) => claimSessionStatementRows(observation));
      const admission = rows.length === 0 ? undefined : openJournal(binding.dataRoot).appendRows(claimSessionFeed.name, rows, {
        at,
        subject: "work-ledger",
        caller: Object.freeze({ transport: "source-code-policy-obsticulation", action: "source-code-policy-obligations-admit" }),
        eventCauses: Object.freeze([
          ...(context?.evidence ?? []),
          ...lifecycle.heads,
        ]),
      });
      const statements = Object.freeze((admission?.statements ?? []).map((statement) => statement.id));
      const result = sourceCodePolicyAdmissionContract.assert(Object.freeze({
        kind: "metroplat.monitoring.source-code.policy-obligation-admission",
        source: read.evaluation.source,
        observation: read.evaluation.observation,
        opened,
        discharged,
        appended: admission?.appended ?? 0,
        statements,
      }), "source-code policy obligation admission");
      return operationHandlerResult(result, statements, governedPolicyArtifacts(read.corpus));
    },
  })]);
}

export function moduleCohesionOperations(binding, { inquiry = false } = {}) {
  return Object.freeze([operation({
    verb: "module-cohesion",
    ...(inquiry ? { domain: inquiryAstRequest("module-cohesion") } : {}),
    relation: "projection",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Read per-module declaration cohesion from the TypeScript AST.",
    description: "Domain: { root?, sourceDirs?, maxFiles?, minSymbols?, offset?, limit?, includeSymbols? }. The package-level evidence Record and its Reading shadow cover the complete observed source set; module partitions and their own valuations are returned as a deterministic page of at most 50.",
    codomain: moduleCohesionPageContract,
    run: (input) => {
      const record = inputRecord(input);
      const root = inquiry ? inquiryRootOf(binding, record)
      : typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.packageRoot;
      if (root === undefined) return null;
      const sourceDirs = optionalStringArray(record["sourceDirs"]);
      const maxFiles = optionalPositiveInteger(record["maxFiles"]);
      const minSymbols = optionalPositiveInteger(record["minSymbols"]);
      const offset = optionalNonnegativeInteger(record["offset"]);
      const limit = optionalPositiveInteger(record["limit"]);
      const includeSymbols = record["includeSymbols"] === true;
      const request = moduleCohesionReadRequestContract.assert(Object.freeze({
        kind: "metroplat.module-cohesion.read-request",
        root,
        ...(sourceDirs === undefined ? {} : { sourceDirs }),
        ...(maxFiles === undefined ? {} : { maxFiles }),
        ...(minSymbols === undefined ? {} : { minSymbols }),
        ...(offset === undefined ? {} : { offset }),
        ...(limit === undefined ? {} : { limit }),
        ...(includeSymbols ? { includeSymbols: true } : {}),
      }), "module-cohesion input");
      const corpus = governedSourceCorpus(request.root, request.sourceDirs, request.maxFiles, binding);
      const page = moduleCohesionPage(moduleCohesionOfCorpus(corpus, {
        ...(request.minSymbols === undefined ? {} : { minSymbols: request.minSymbols }),
      }), {
        ...(request.offset === undefined ? {} : { offset: request.offset }),
        ...(request.limit === undefined ? {} : { limit: request.limit }),
        ...(request.includeSymbols === true ? { includeSymbols: true } : {}),
      });
      return operationHandlerResult(page, [], sourceModuleArtifacts(corpus));
    },
  }), operation({
    verb: "module-cohesion-history",
    relation: "projection",
    inputFormat: "json",
    outputFormat: "json",
    summary: "Read the bounded history of admitted module-cohesion observations.",
    description: "Domain: { dates?: YYYY-MM-DD[1..31], maxStages?: 1..100 }. Projects distinct consecutive, exact-source-identified observations and their causal predecessors from the canonical RPC journal, then relates their faithful Records in Obsmetrologia's knowledge and truth orders.",
    codomain: moduleCohesionHistoryContract,
    run: (input) => {
      if (binding.dataRoot === undefined) return null;
      const record = inputRecord(input);
      const dates = optionalStringArray(record["dates"])
        ?? Object.freeze([binding.now().slice(0, 10)]);
      const maxStages = optionalPositiveInteger(record["maxStages"]);
      return readModuleCohesionHistoryFromJournal(binding.dataRoot, dates, {
        ...(maxStages === undefined ? {} : { maxStages }),
      });
    },
  })]);
}

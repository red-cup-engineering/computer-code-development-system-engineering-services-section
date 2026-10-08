import * as filesystemEffects from "@red-cup-engineering/computer-system-engine/filesystem";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { canonicalJson } from "@red-cup-engineering/json-services-section";
import { journal, openJournal } from "@red-cup-engineering/computer-system-engine/journal/journal";
import { moduleCohesionReceipt } from "@red-cup-engineering/metrologic/models/graphs/module-cohesion";
import {
  knowledgeJoinReading as joinKnowledge,
  truthJoinReading as joinTruth,
  knowledgeMeetReading as meetKnowledge,
  truthMeetReading as meetTruth,
} from "@red-cup-engineering/computer-data-services-section/four";
import {
  readingOfEvidenceRecord,
  evidenceRecord,
  evidenceRecordOfFourCensus,
  evidenceRecordTopMass,
  joinKnowledgeEvidenceRecords,
  joinTruthEvidenceRecords,
  meetKnowledgeEvidenceRecords,
  meetTruthEvidenceRecords,
  addEvidenceRecords,
} from "@red-cup-engineering/metrologic/articulation/predicating/positing/evidence-record";

import { DEFAULT_SOURCE_CODE_POLICIES, evaluateSourceCodePolicies, importStratificationPolicy, localImportTargetPolicy, moduleBuildOrderPolicy, normalizationCutPolicy, sourceModuleStratum, LOCAL_IMPORT_CONFORMS_CELL, IMPORT_STRATIFICATION_CONFORMS_CELL, IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL, LOCAL_IMPORT_TARGET_PRESENT_CELL, MODULE_BUILD_ORDER_ACYCLIC_CELL, MODULE_BUILD_ORDER_CONFORMS_CELL, MODULE_BUILD_ORDER_RULING_CELL, moduleTopologyRelation, sourceCodePolicy, sourceCodePolicyArtifacts, sourceCodePolicyPage } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/policy";
import { moduleCohesionPage, readModuleCohesion } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/service";
import { moduleTopologyPage, readModuleTopology } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/service";
import { recordKnowledgeRelation, recordTruthRelation } from "@red-cup-engineering/computer-code-development-engine/monitoring/substrate/history";
import { sourceModuleFiles, readSourceModuleCorpus, sourceModuleArtifacts } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/filesystem";
import { sourceCodePolicyObligations, SOURCE_CODE_NORMALIZATION_WORK } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/work";
import { closureRule } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/closure-rule-system";
import { settleCausalSet } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal";
import { authorizationFromStanding, dispatch } from "@red-cup-engineering/computer-system-engine/rpc/dispatch";
import { createOperationCatalog, operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { invocation } from "@red-cup-engineering/computer-system-engine/rpc/invocation";
import { tm } from "@red-cup-engineering/computer-data-services-section/semiotic-expression-notation";
import { nodeDeclarationReference, nodeBeingLayerFilenameSuffixes, nodeBeingLayerOfFilenameSuffix, nodeSubjectAnchor, nodeBeingTaxon, readNodeBeingTaxon } from "@red-cup-engineering/communicating/language/jsnode/taxonomy";
import { nodeBeingDocumentationProjectionIsValid } from "@red-cup-engineering/communicating/language/jsnode/documentation";
import { articulate } from "@red-cup-engineering/communicating-in-english";
import { journalRpcWitness } from "@red-cup-engineering/computer-system-engine/rpc/journal-witness";
import { claimSessionStatementRows } from "@red-cup-engineering/relating/running/session";
import { chronicleWorkClaims } from "@red-cup-engineering/feltos/work/chronicle";
import {
  workItemObservationsOfRows,
  workLedgerObligationCollector,
} from "@red-cup-engineering/organizing/work/observations";
import { workItemOfCell } from "@red-cup-engineering/socializing";
import { workRoadmapOfObservations } from "@red-cup-engineering/organizing/work/read-models";
import { recordHistoryOfStages, recordKnowledgeRelation as recordKnowledgeRelation_2, recordTruthRelation as recordTruthRelation_2 } from "@red-cup-engineering/computer-code-development-engine/monitoring/substrate/history";
import { readingEvidence, fourCensusOf, joinReadingsKnowledge } from "@red-cup-engineering/computer-code-development-engine/monitoring/substrate/valuation";
import { readMonitorAggregate, subsystemEntry } from "@red-cup-engineering/computer-code-development-engine/monitoring/substrate/aggregate";
import { recordKnowledgeRelation as recordKnowledgeRelation_3, recordTruthRelation as recordTruthRelation_3, recordHistoryOfStages as recordHistoryOfStages_2 } from "@red-cup-engineering/computer-code-development-engine/monitoring/substrate/history";
import { nodeSubjectAnchorCoverageNames, nodePackageLayerNames, nodePackageLayoutConventionNames, nodePackageLayoutConventionReadingSchema, moduleTopologyPlacementSchema, moduleTopologySpeciesCensusEntrySchema, nodeBeingDocumentationProjectionSchema, moduleTopologyReadRequestSchema, moduleTopologyReadRequestContract, moduleTopologySymbolSchema, moduleTopologyReexportSchema, moduleTopologyModuleSchema, moduleTopologyReadSchema, moduleTopologyReadContract, moduleTopologyPageModuleSchema, moduleTopologyPageSchema, moduleTopologyPageContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/schema";
import { readModuleTopology as readModuleTopology_2, moduleTopologyOfCorpus, moduleTopologyPage as moduleTopologyPage_2, searchModuleTopologySymbols, symbolClustersOf } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/service";
import { moduleTopologyValuation } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/valuation";
import { moduleTopologyValuationHistoryOfStages, moduleTopologyValuationHistoryContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/history";
import { readSourceCodeMonitorAggregate } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/aggregate";
import { moduleCohesionValuationSchema, moduleCohesionReadRequestSchema, moduleCohesionReadRequestContract, moduleCohesionModuleSchema, moduleCohesionReadSchema, moduleCohesionReadContract, moduleCohesionPageModuleSchema, moduleCohesionPageSchema, moduleCohesionPageContract, moduleCohesionHistorySchema, moduleCohesionHistoryContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/schema";
import { readModuleCohesion as readModuleCohesion_2, moduleCohesionOfCorpus, moduleCohesionPage as moduleCohesionPage_2 } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/service";
import { moduleCohesionHistoryOfStages } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/history";
import { sourceCodePolicy as sourceCodePolicy_2, sourceCodePolicyArtifacts as sourceCodePolicyArtifacts_2, sourceModuleStratum as sourceModuleStratum_2, moduleTopologyRelation as moduleTopologyRelation_2, evaluateSourceCodePolicies as evaluateSourceCodePolicies_2, sourceCodePolicyPage as sourceCodePolicyPage_2, sourceCodePolicyHistoryOfStages, sourceCodePolicyStage, sourceCodePolicyReadRequestSchema, sourceCodePolicyReadRequestContract, sourceCodePolicyPageSchema, sourceCodePolicyPageContract, sourceCodePolicyHistorySchema, sourceCodePolicyHistoryContract, sourceCodePolicyAdmissionSchema, sourceCodePolicyAdmissionContract, LOCAL_IMPORT_TARGET_PRESENT_CELL as LOCAL_IMPORT_TARGET_PRESENT_CELL_2, LOCAL_IMPORT_CONFORMS_CELL as LOCAL_IMPORT_CONFORMS_CELL_2, IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL as IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL_2, IMPORT_STRATIFICATION_CONFORMS_CELL as IMPORT_STRATIFICATION_CONFORMS_CELL_2, MODULE_BUILD_ORDER_ACYCLIC_CELL as MODULE_BUILD_ORDER_ACYCLIC_CELL_2, MODULE_BUILD_ORDER_CONFORMS_CELL as MODULE_BUILD_ORDER_CONFORMS_CELL_2, NORMALIZATION_CUT_ACTIONABLE_CELL, NORMALIZATION_CUT_CONFORMS_CELL, localImportTargetPolicy as localImportTargetPolicy_2, moduleBuildOrderPolicy as moduleBuildOrderPolicy_2, normalizationCutPolicy as normalizationCutPolicy_2, importStratificationPolicy as importStratificationPolicy_2, DEFAULT_SOURCE_CODE_POLICIES as DEFAULT_SOURCE_CODE_POLICIES_2, localImportRulingCell, importStratificationRulingCell, MODULE_BUILD_ORDER_RULING_CELL as MODULE_BUILD_ORDER_RULING_CELL_2, normalizationCutRulingCell, sourceCodePolicyRulingCell, sourceCodePolicyEvidenceRecord } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/policy";
import { moduleTopologyNormalizationCutSchema } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/normalization";
import { sourceCodePolicyObligations as sourceCodePolicyObligations_2, sourceCodePolicyObligationDelta, SOURCE_CODE_NORMALIZATION_WORK as SOURCE_CODE_NORMALIZATION_WORK_2 } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/work";
import { workspaceDependencyGraphOf, egoWorkspaceDependencyGraph } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace";
import { workspacePackageConformanceRequestSchema, workspacePackageConformanceRequestContract, workspaceImportAuditRequestSchema, workspaceImportAuditRequestContract, workspaceDependencyGraphNodeSchema, workspaceDependencyGraphNodeContract, workspaceDependencyGraphEdgeSchema, workspaceDependencyGraphEdgeContract, buildOrderObstructionSchema, buildOrderObstructionContract, buildOrderTiersSchema, buildOrderTiersContract, workspaceDependencyGraphSchema, workspaceDependencyGraphContract, workspacePackageConformanceSchema, workspacePackageConformanceContract, decommissionedImportViolationSchema, decommissionedImportViolationContract, workspaceDecommissionedImportAuditSchema, workspaceDecommissionedImportAuditContract, workspacePhantomImportSchema, workspacePhantomImportContract, workspaceStaleDependencySchema, workspaceStaleDependencyContract, workspaceCrossPackageRelativeImportSchema, workspaceCrossPackageRelativeImportContract, workspaceImportAuditSchema, workspaceImportAuditContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace/schema";
import { workspaceRootEmptyRefusal, workspaceImportAuditOf } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace/import-audit";
import { lexiconEntrySchema, lexiconCensusReadRequestSchema, lexiconCensusReadRequestContract, lexiconCensusFileSchema, lexiconCensusEntryReadSchema, lexiconCensusReadSchema, lexiconCensusReadContract, lexiconReadSchema, lexiconReadContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/schema";
import { lexiconFromRulings, readLexicon, lexiconFromRulings as lexiconFromRulings_2, readLexicon as readLexicon_2 } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/fold";
import { lexiconCensusReadSchemaContract, findLexiconSegments, readLexiconCensus, lexiconCensusOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/service";
import { DEFAULT_SOURCE_DIRECTORIES, DEFAULT_SOURCE_FILE_LIMIT, readSourceModuleCorpus as readSourceModuleCorpus_2, sourceModuleArtifacts as sourceModuleArtifacts_2, sourceModuleConfinedPath, sourceModuleFiles as sourceModuleFiles_2, sourceModuleRelativePath } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/filesystem";
import { fileCensusReadSchemaContract, visitFileCensus, walkFileCensus, readFileCensus, fileCensusOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/filesystem/file-census/service";
import { legibilityReadSchemaContract, readLegibility, legibilityOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/filesystem/legibility/service";
import { proofPlayReadoutSchema, proofPlayReadoutContract, proofPlayReadoutContract as proofPlayReadoutContract_2 } from "@red-cup-engineering/computer-code-development-engine/monitoring/proof-play/schema";
import { readProofPlay, proofPlayOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/proof-play/service";
import { checkoutHealthCheckerNames, checkoutHealthFindingSchema, checkoutHealthReadRequestSchema, checkoutHealthReadRequestContract, checkoutHealthReadSchema, checkoutHealthReadContract, checkoutHealthWorkIntentRequestSchema, checkoutHealthWorkIntentRequestContract, checkoutHealthWorkIntentSummarySchema, checkoutHealthWorkIntentSummaryContract, readyDutiesDischargeRequestSchema, readyDutiesDischargeRequestContract, readyDutiesDischargeResultSchema, readyDutiesDischargeResultContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/schema";
import { isCheckoutSourceFile, changedPathsFromGitStatus, checkoutScanPaths, houseScopedLockfileRegistryViolations, readChecksCache, writeChecksCache, channelRepositoryEntries, youtubeChannelRepositoryFormFindings, handRegisteredOperationsFindings, observeFailedUnitsAcrossHosts, observeCheckoutBoundUnitsAcrossHosts, readCheckoutHealth, CHECKOUT_HEALTH_BUDGET_MS } from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/checks";
import { taskIdFor, allocationIdFor, buildTaskAllocation, formatFindingLine, groupCheckerFindingsIntoTasks, tasksFromFailedUnits, tasksFromCheckoutBoundUnits, buildHealthWorkIntent, healthWorkIntent, DEFAULT_ALLOCATION_OFFICE } from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/work-intent";
import { slugify } from "@red-cup-engineering/computer-text-content-engineering-services-section/slugify-text";
import { classifyDutyScope, subjectPathFromDutyText, walkDirectories, candidateSubjectPaths, resolveSubjectPath, readyTaskDutiesOfDispatch, runExactDepsHand, runDataCustodyHand, digestOfRepairOutput, dischargeTextFor, buildDischargeInput, evaluateDeterministicAcceptance, executeDeterministicDuty, planOrDischargeDuty, dischargeReadyDuties, SCOPE_RECOGNIZED_NO_HAND_PATTERN, DEFAULT_REPAIR_SCRIPTS } from "@red-cup-engineering/feltos/work/duty-discharge";
import { validateDeterministicExecution } from "@red-cup-engineering/organizing/work/schema";
import { checkoutHealthOperations, checkoutHealthWorkIntentAdmitOperations, readyDutiesDischargeOperations, checkoutHealthFamilyOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/service";
import { moduleTopologyValuationLawReceipt, sourceCodeMonitorAggregateLawReceipt, readProofHealthMonitorAggregate, readMathLawReadout, readCatalogVerifyReadout, proofHealthOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/proof-health";
import { schemaConformanceSampleCountsSchema, schemaConformanceCutSchema, schemaConformanceCutContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/schema-conformance/schema";
import { readSchemaConformance, schemaConformanceOperations } from "@red-cup-engineering/computer-code-development-engine/monitoring/schema-conformance/service";
import { toEavt } from "@red-cup-engineering/eavt/row";
const monitoring = Object.freeze({ substrate: { recordHistoryOfStages, recordKnowledgeRelation: recordKnowledgeRelation_2, recordTruthRelation: recordTruthRelation_2, readingEvidence, fourCensusOf, joinReadingsKnowledge, readMonitorAggregate, subsystemEntry }, sourceCode: { recordKnowledgeRelation: recordKnowledgeRelation_3, recordTruthRelation: recordTruthRelation_3, recordHistoryOfStages: recordHistoryOfStages_2, nodeSubjectAnchorCoverageNames, nodePackageLayerNames, nodePackageLayoutConventionNames, nodePackageLayoutConventionReadingSchema, moduleTopologyPlacementSchema, moduleTopologySpeciesCensusEntrySchema, nodeBeingDocumentationProjectionSchema, moduleTopologyReadRequestSchema, moduleTopologyReadRequestContract, moduleTopologySymbolSchema, moduleTopologyReexportSchema, moduleTopologyModuleSchema, moduleTopologyReadSchema, moduleTopologyReadContract, moduleTopologyPageModuleSchema, moduleTopologyPageSchema, moduleTopologyPageContract, readModuleTopology: readModuleTopology_2, moduleTopologyOfCorpus, moduleTopologyPage: moduleTopologyPage_2, searchModuleTopologySymbols, symbolClustersOf, moduleTopologyValuation, moduleTopologyValuationHistoryOfStages, moduleTopologyValuationHistoryContract, readSourceCodeMonitorAggregate, moduleCohesionValuationSchema, moduleCohesionReadRequestSchema, moduleCohesionReadRequestContract, moduleCohesionModuleSchema, moduleCohesionReadSchema, moduleCohesionReadContract, moduleCohesionPageModuleSchema, moduleCohesionPageSchema, moduleCohesionPageContract, moduleCohesionHistorySchema, moduleCohesionHistoryContract, readModuleCohesion: readModuleCohesion_2, moduleCohesionOfCorpus, moduleCohesionPage: moduleCohesionPage_2, moduleCohesionHistoryOfStages, sourceCodePolicy: sourceCodePolicy_2, sourceCodePolicyArtifacts: sourceCodePolicyArtifacts_2, sourceModuleStratum: sourceModuleStratum_2, moduleTopologyRelation: moduleTopologyRelation_2, evaluateSourceCodePolicies: evaluateSourceCodePolicies_2, sourceCodePolicyPage: sourceCodePolicyPage_2, sourceCodePolicyHistoryOfStages, sourceCodePolicyStage, sourceCodePolicyReadRequestSchema, sourceCodePolicyReadRequestContract, sourceCodePolicyPageSchema, sourceCodePolicyPageContract, sourceCodePolicyHistorySchema, sourceCodePolicyHistoryContract, sourceCodePolicyAdmissionSchema, sourceCodePolicyAdmissionContract, LOCAL_IMPORT_TARGET_PRESENT_CELL: LOCAL_IMPORT_TARGET_PRESENT_CELL_2, LOCAL_IMPORT_CONFORMS_CELL: LOCAL_IMPORT_CONFORMS_CELL_2, IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL: IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL_2, IMPORT_STRATIFICATION_CONFORMS_CELL: IMPORT_STRATIFICATION_CONFORMS_CELL_2, MODULE_BUILD_ORDER_ACYCLIC_CELL: MODULE_BUILD_ORDER_ACYCLIC_CELL_2, MODULE_BUILD_ORDER_CONFORMS_CELL: MODULE_BUILD_ORDER_CONFORMS_CELL_2, NORMALIZATION_CUT_ACTIONABLE_CELL, NORMALIZATION_CUT_CONFORMS_CELL, localImportTargetPolicy: localImportTargetPolicy_2, moduleBuildOrderPolicy: moduleBuildOrderPolicy_2, normalizationCutPolicy: normalizationCutPolicy_2, importStratificationPolicy: importStratificationPolicy_2, DEFAULT_SOURCE_CODE_POLICIES: DEFAULT_SOURCE_CODE_POLICIES_2, localImportRulingCell, importStratificationRulingCell, MODULE_BUILD_ORDER_RULING_CELL: MODULE_BUILD_ORDER_RULING_CELL_2, normalizationCutRulingCell, sourceCodePolicyRulingCell, sourceCodePolicyEvidenceRecord, moduleTopologyNormalizationCutSchema, sourceCodePolicyObligations: sourceCodePolicyObligations_2, sourceCodePolicyObligationDelta, SOURCE_CODE_NORMALIZATION_WORK: SOURCE_CODE_NORMALIZATION_WORK_2, workspaceDependencyGraphOf, egoWorkspaceDependencyGraph, workspacePackageConformanceRequestSchema, workspacePackageConformanceRequestContract, workspaceImportAuditRequestSchema, workspaceImportAuditRequestContract, workspaceDependencyGraphNodeSchema, workspaceDependencyGraphNodeContract, workspaceDependencyGraphEdgeSchema, workspaceDependencyGraphEdgeContract, buildOrderObstructionSchema, buildOrderObstructionContract, buildOrderTiersSchema, buildOrderTiersContract, workspaceDependencyGraphSchema, workspaceDependencyGraphContract, workspacePackageConformanceSchema, workspacePackageConformanceContract, decommissionedImportViolationSchema, decommissionedImportViolationContract, workspaceDecommissionedImportAuditSchema, workspaceDecommissionedImportAuditContract, workspacePhantomImportSchema, workspacePhantomImportContract, workspaceStaleDependencySchema, workspaceStaleDependencyContract, workspaceCrossPackageRelativeImportSchema, workspaceCrossPackageRelativeImportContract, workspaceImportAuditSchema, workspaceImportAuditContract, workspaceRootEmptyRefusal, workspaceImportAuditOf, lexiconEntrySchema, lexiconCensusReadRequestSchema, lexiconCensusReadRequestContract, lexiconCensusFileSchema, lexiconCensusEntryReadSchema, lexiconCensusReadSchema, lexiconCensusReadContract, lexiconReadSchema, lexiconReadContract, lexiconFromRulings, readLexicon, lexiconFromRulings: lexiconFromRulings_2, readLexicon: readLexicon_2, lexiconCensusReadSchemaContract, findLexiconSegments, readLexiconCensus, lexiconCensusOperations, DEFAULT_SOURCE_DIRECTORIES, DEFAULT_SOURCE_FILE_LIMIT, readSourceModuleCorpus: readSourceModuleCorpus_2, sourceModuleArtifacts: sourceModuleArtifacts_2, sourceModuleConfinedPath, sourceModuleFiles: sourceModuleFiles_2, sourceModuleRelativePath }, filesystem: { fileCensus: { fileCensusReadSchemaContract, visitFileCensus, walkFileCensus, readFileCensus, fileCensusOperations }, legibility: { legibilityReadSchemaContract, readLegibility, legibilityOperations } }, proofPlay: { proofPlayReadoutSchema, proofPlayReadoutContract, proofPlayReadoutContract: proofPlayReadoutContract_2, readProofPlay, proofPlayOperations }, checkoutHealth: { checkoutHealthCheckerNames, checkoutHealthFindingSchema, checkoutHealthReadRequestSchema, checkoutHealthReadRequestContract, checkoutHealthReadSchema, checkoutHealthReadContract, checkoutHealthWorkIntentRequestSchema, checkoutHealthWorkIntentRequestContract, checkoutHealthWorkIntentSummarySchema, checkoutHealthWorkIntentSummaryContract, readyDutiesDischargeRequestSchema, readyDutiesDischargeRequestContract, readyDutiesDischargeResultSchema, readyDutiesDischargeResultContract, isCheckoutSourceFile, changedPathsFromGitStatus, checkoutScanPaths, houseScopedLockfileRegistryViolations, readChecksCache, writeChecksCache, channelRepositoryEntries, youtubeChannelRepositoryFormFindings, handRegisteredOperationsFindings, observeFailedUnitsAcrossHosts, observeCheckoutBoundUnitsAcrossHosts, readCheckoutHealth, CHECKOUT_HEALTH_BUDGET_MS, slugify, taskIdFor, allocationIdFor, buildTaskAllocation, formatFindingLine, groupCheckerFindingsIntoTasks, tasksFromFailedUnits, tasksFromCheckoutBoundUnits, buildHealthWorkIntent, healthWorkIntent, DEFAULT_ALLOCATION_OFFICE, classifyDutyScope, subjectPathFromDutyText, walkDirectories, candidateSubjectPaths, resolveSubjectPath, readyTaskDutiesOfDispatch, runExactDepsHand, runDataCustodyHand, digestOfRepairOutput, dischargeTextFor, buildDischargeInput, evaluateDeterministicAcceptance, validateDeterministicExecution, executeDeterministicDuty, planOrDischargeDuty, dischargeReadyDuties, SCOPE_RECOGNIZED_NO_HAND_PATTERN, DEFAULT_REPAIR_SCRIPTS, checkoutHealthOperations, checkoutHealthWorkIntentAdmitOperations, readyDutiesDischargeOperations, checkoutHealthFamilyOperations }, moduleTopologyValuationLawReceipt, sourceCodeMonitorAggregateLawReceipt, readProofHealthMonitorAggregate, readMathLawReadout, readCatalogVerifyReadout, proofHealthOperations, schemaConformanceSampleCountsSchema, schemaConformanceCutSchema, schemaConformanceCutContract, readSchemaConformance, schemaConformanceOperations });
import {
  moduleTopologyOperations,
  readModuleCohesionHistoryFromJournal,
  readSourceCodePolicyHistoryFromJournal,
  sourceCodePolicyOperations,
} from "@red-cup-engineering/computer-code-development-engine/monitoring/operations";

const CANONICAL_ARTIFACT_LIMIT = 1024 * 1024;

test("JSNode layer filename projection is readable by the same language vocabulary", () => {
  for (const [layer, suffix] of Object.entries(nodeBeingLayerFilenameSuffixes)) {
    assert.equal(nodeBeingLayerOfFilenameSuffix(suffix), layer);
  }
  assert.equal(nodeBeingLayerOfFilenameSuffix("types"), "types");
  assert.equal(nodeBeingLayerOfFilenameSuffix("utils"), "utils");
});

test("work observations recognize only the canonical scope grammar", () => {
  assert.deepEqual(workItemOfCell("work-item:session/work/obligation/0001"), {
    level: "work-item",
    id: "session/work/obligation/0001",
  });
  assert.equal(workItemOfCell("work-ledger/item/0001"), null);
  assert.equal(workItemOfCell("openai/codex/session/example/work/obligation/0001"), null);

  const [observation] = chronicleWorkClaims({
    kind: "metroplat.chronicle-work-read",
    sessionId: "example",
    source: "test",
    protocol: "openai",
    surface: "codex",
    goals: 0,
    obligations: 1,
    items: [{
      kind: "metroplat.chronicle-work-item",
      role: "obligation",
      source: "test",
      text: "repair the package",
      evidence: [],
    }],
    evidence: [],
  }).observations;
  assert.equal(observation.claim.cell, "work-item:openai/codex/session/example/work/obligation/0001");
});

test("work interpretations have one package owner and one-way dependency", () => {
  const topology = readModuleTopology(process.cwd(), { ...filesystemEffects, sourceDirs: ["src/claims", "src/work"] });
  const claimModules = topology.modules.filter((module) => module.path.startsWith("src/claims/"));
  assert.ok(claimModules.length > 0);
  assert.deepEqual(
    claimModules.flatMap((module) => module.imports.filter((dependency) => dependency.startsWith("src/work/"))),
    [],
  );

  const workPaths = new Set(topology.modules
    .filter((module) => module.path.startsWith("src/work/"))
    .map((module) => module.path));
  assert.ok(workPaths.has("src/work/chronicle.mts"));
  assert.ok(workPaths.has("src/work/milestones.mts"));
  assert.ok(workPaths.has("src/work/obligations.mts"));
});

test("the public monitoring surface does not expose its RPC inbound adapter", () => {
  assert.equal("moduleTopologyOperations" in monitoring, false);
  assert.equal("moduleCohesionOperations" in monitoring, false);
  assert.equal("sourceCodePolicyOperations" in monitoring, false);
});

test("evidence records retain multiplicity while their forced FOUR shadow preserves counting merge", () => {
  const supporting = evidenceRecord(2, 0);
  const opposing = evidenceRecord(0, 3);
  const merged = addEvidenceRecords(supporting, opposing);

  assert.deepEqual(merged, { kind: "evidence.record", pos: 2, neg: 3 });
  assert.equal(readingOfEvidenceRecord(merged), "stable");
  assert.deepEqual(
    readingOfEvidenceRecord(merged),
    joinKnowledge(readingOfEvidenceRecord(supporting), readingOfEvidenceRecord(opposing)),
  );
  assert.equal(evidenceRecordTopMass(merged), 2);
  assert.deepEqual(readingOfEvidenceRecord(evidenceRecord(1, 0)), readingOfEvidenceRecord(evidenceRecord(9, 0)));
  assert.notDeepEqual(evidenceRecord(1, 0), evidenceRecord(9, 0));
});

test("the record-to-Reading readout preserves both lattice structures and counting merge", () => {
  const sample = [];
  for (let pos = 0; pos <= 3; pos += 1) {
    for (let neg = 0; neg <= 3; neg += 1) sample.push(evidenceRecord(pos, neg));
  }
  for (const left of sample) {
    for (const right of sample) {
      assert.deepEqual(
        readingOfEvidenceRecord(addEvidenceRecords(left, right)),
        joinKnowledge(readingOfEvidenceRecord(left), readingOfEvidenceRecord(right)),
      );
      assert.deepEqual(
        readingOfEvidenceRecord(joinKnowledgeEvidenceRecords(left, right)),
        joinKnowledge(readingOfEvidenceRecord(left), readingOfEvidenceRecord(right)),
      );
      assert.deepEqual(
        readingOfEvidenceRecord(meetKnowledgeEvidenceRecords(left, right)),
        meetKnowledge(readingOfEvidenceRecord(left), readingOfEvidenceRecord(right)),
      );
      assert.deepEqual(
        readingOfEvidenceRecord(joinTruthEvidenceRecords(left, right)),
        joinTruth(readingOfEvidenceRecord(left), readingOfEvidenceRecord(right)),
      );
      assert.deepEqual(
        readingOfEvidenceRecord(meetTruthEvidenceRecords(left, right)),
        meetTruth(readingOfEvidenceRecord(left), readingOfEvidenceRecord(right)),
      );
      assert.ok(
        evidenceRecordTopMass(left) + evidenceRecordTopMass(right)
          <= evidenceRecordTopMass(addEvidenceRecords(left, right)),
      );
    }
  }
});

test("a FOUR census projects to one multiplicity-preserving evidence Record", () => {
  assert.deepEqual(
    evidenceRecordOfFourCensus({ absurd: 7, potential: 3, active: 2, stable: 5 }),
    evidenceRecord(8, 7),
  );
});

test("cohesion retains disagreement between strong and weak filtration readings", () => {
  const receipt = moduleCohesionReceipt({
    path: "src/example.mts",
    symbols: ["a", "b", "c"],
    internalReferenceEdges: [["a", "b"]],
    coImportEdges: [["b", "c"]],
  });

  assert.deepEqual(receipt.partitions.map((partition) => partition.componentCount), [2, 1]);
  assert.deepEqual(receipt.valuation.record, { kind: "evidence.record", pos: 3, neg: 1 });
  assert.equal(receipt.valuation.reading, "stable");
  assert.equal(receipt.valuation.topMass, 1);
});

test("Record transitions retain both Obsmetrologia partial orders", () => {
  const left = evidenceRecord(3, 2);
  assert.equal(recordKnowledgeRelation(left, evidenceRecord(4, 3)), "ascending");
  assert.equal(recordTruthRelation(left, evidenceRecord(4, 1)), "ascending");
  assert.equal(recordTruthRelation(left, evidenceRecord(2, 3)), "descending");
  assert.equal(recordKnowledgeRelation(left, evidenceRecord(4, 1)), "incomparable");
  assert.equal(recordTruthRelation(left, evidenceRecord(4, 3)), "incomparable");
  assert.equal(recordTruthRelation(left, left), "equal");
});

test("source monitors share location-independent corpus identity while retaining distinct observation identities", () => {
  const parent = mkdtempSync(path.join(tmpdir(), "metroplat-cohesion-identity-"));
  try {
    const content = [
      "export const a = 1;",
      "export const b = a + 1;",
      "export const c = b + 1;",
      "export const d = c + 1;",
      "export const e = d + 1;",
      "",
    ].join("\n");
    const roots = [path.join(parent, "left"), path.join(parent, "right")];
    for (const root of roots) {
      mkdirSync(path.join(root, "src"), { recursive: true });
      writeFileSync(path.join(root, "src", "sample.mts"), content);
    }
    const left = readModuleCohesion(roots[0], { ...filesystemEffects, sourceDirs: ["src"] });
    const right = readModuleCohesion(roots[1], { ...filesystemEffects, sourceDirs: ["src"] });
    const leftTopology = readModuleTopology(roots[0], { ...filesystemEffects, sourceDirs: ["src"] });
    const rightTopology = readModuleTopology(roots[1], { ...filesystemEffects, sourceDirs: ["src"] });
    assert.notEqual(left.root, right.root);
    assert.equal(left.source, right.source);
    assert.equal(left.observation, right.observation);
    assert.equal(leftTopology.source, rightTopology.source);
    assert.equal(leftTopology.observation, rightTopology.observation);
    assert.equal(leftTopology.modules[0].identity, rightTopology.modules[0].identity);
    assert.equal(left.source, leftTopology.source);
    assert.notEqual(left.observation, leftTopology.observation);
    assert.equal(left.modules[0].identity, leftTopology.modules[0].identity);
    assert.deepEqual(leftTopology.modules[0].symbolClusters, left.modules[0].components);
    assert.deepEqual(rightTopology.modules[0].symbolClusters, right.modules[0].components);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("module topology preserves content identity separately from observed path", () => {
  const parent = mkdtempSync(path.join(tmpdir(), "metroplat-module-identity-"));
  try {
    const leftRoot = path.join(parent, "left");
    const rightRoot = path.join(parent, "right");
    mkdirSync(path.join(leftRoot, "src"), { recursive: true });
    mkdirSync(path.join(rightRoot, "src"), { recursive: true });
    const content = "export const same = true;\n";
    writeFileSync(path.join(leftRoot, "src", "before.mts"), content);
    writeFileSync(path.join(rightRoot, "src", "after.mts"), content);

    const left = readModuleTopology(leftRoot, { ...filesystemEffects, sourceDirs: ["src"] });
    const right = readModuleTopology(rightRoot, { ...filesystemEffects, sourceDirs: ["src"] });
    assert.equal(left.modules[0].identity, right.modules[0].identity);
    assert.notEqual(left.modules[0].path, right.modules[0].path);

    const locatedCell = (topology) => moduleTopologyRelation(topology).predication.cells
      .find((cell) => cell.predicate.mark.value === "source-code:located-at");
    const leftLocated = locatedCell(left);
    const rightLocated = locatedCell(right);
    assert.deepEqual(leftLocated.subject.mark.value, rightLocated.subject.mark.value);
    assert.notDeepEqual(leftLocated.object.mark.value, rightLocated.object.mark.value);

    writeFileSync(path.join(rightRoot, "src", "after.mts"), "export const changed = true;\n");
    const changed = readModuleTopology(rightRoot, { ...filesystemEffects, sourceDirs: ["src"] });
    assert.notEqual(right.modules[0].identity, changed.modules[0].identity);
    assert.notDeepEqual(rightLocated.subject.mark.value, locatedCell(changed).subject.mark.value);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("cohesion history projects exact-source observations and causal predecessors from the canonical RPC journal", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-cohesion-history-"));
  const date = "2026-07-12";
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    const source = path.join(root, "src", "sample.mts");
    writeFileSync(source, [
      "export const a = 1;",
      "export const b = a + 1;",
      "export const c = b + 1;",
      "export const d = c + 1;",
      "export const e = d + 1;",
      "",
    ].join("\n"));
    const first = moduleCohesionPage(readModuleCohesion(root, { ...filesystemEffects, sourceDirs: ["src"] }));
    writeFileSync(source, [
      "export const a = 1;",
      "export const b = a + 1;",
      "export const c = b + 1;",
      "export const d = c + 1;",
      "export const e = d + 1;",
      "export const separate = 0;",
      "",
    ].join("\n"));
    const second = moduleCohesionPage(readModuleCohesion(root, { ...filesystemEffects, sourceDirs: ["src"] }));
    const store = openJournal(root);
    const admit = (page, at, id) => store.appendRows("rpc", [toEavt({
      e: id,
      a: { kind: "metroplat.rpc.outcome" },
      v: {
        kind: "metroplat.rpc.outcome",
        invocation: id,
        at,
        receipt: {
          kind: "metroplat.rpc.execution:witness",
          id,
          ok: true,
          invocation: { id: `invocation:${id}`, verb: "module-cohesion", causes: [`cause:${id}`] },
          value: page,
          completedAt: at,
        },
      },
      t: at,
    })], { at, subject: "rpc" });
    admit(first, `${date}T10:00:00.000Z`, "receipt:first-page-1");
    admit(first, `${date}T10:01:00.000Z`, "receipt:first-page-2");
    admit(second, `${date}T10:02:00.000Z`, "receipt:second");

    const history = readModuleCohesionHistoryFromJournal(root, [date]);
    assert.equal(history.observations, 3);
    assert.notEqual(first.source, second.source);
    assert.notEqual(first.observation, second.observation);
    assert.deepEqual(history.stages.map((entry) => entry.observation), [first.observation, second.observation]);
    assert.deepEqual(history.stages.map((entry) => entry.source), [first.source, second.source]);
    assert.deepEqual(history.stages.map((entry) => entry.causes), [
      ["cause:receipt:first-page-1"],
      ["cause:receipt:second"],
    ]);
    assert.deepEqual(history.transitions, [{
      from: first.observation,
      to: second.observation,
      knowledge: "ascending",
      truth: "descending",
    }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source policy history derives Record truth and knowledge transitions from governed RPC outcomes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-policy-history-"));
  const date = "2026-07-12";
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "entry.mts"), 'import "./target.mjs";\nexport const entry = true;\n');
    const target = path.join(root, "src", "target.mts");
    writeFileSync(target, "export const target = true;\n");
    const first = sourceCodePolicyPage(evaluateSourceCodePolicies(readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] })));
    rmSync(target);
    const second = sourceCodePolicyPage(evaluateSourceCodePolicies(readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] })));
    assert.deepEqual(first.summary, { absurd: 0, potential: 3, active: 0, stable: 0 });
    assert.deepEqual(second.summary, { absurd: 0, potential: 2, active: 1, stable: 0 });

    const store = openJournal(root);
    const admit = (page, at, id) => store.appendRows("rpc", [toEavt({
      e: id,
      a: { kind: "metroplat.rpc.outcome" },
      v: {
        kind: "metroplat.rpc.outcome",
        invocation: id,
        at,
        receipt: {
          kind: "metroplat.rpc.execution:witness",
          id,
          ok: true,
          invocation: { id: `invocation:${id}`, verb: "source-code-policy", causes: [`cause:${id}`] },
          value: page,
          completedAt: at,
        },
      },
      t: at,
    })], { at, subject: "rpc" });
    admit(first, `${date}T10:00:00.000Z`, "receipt:first");
    admit(first, `${date}T10:01:00.000Z`, "receipt:first-page-2");
    admit(second, `${date}T10:02:00.000Z`, "receipt:second");

    const history = readSourceCodePolicyHistoryFromJournal(root, [date]);
    assert.equal(history.observations, 3);
    assert.deepEqual(history.stages.map((stage) => stage.record), [evidenceRecord(3, 0), evidenceRecord(2, 1)]);
    assert.deepEqual(history.stages.map((stage) => stage.standing), ["potential", "stable"]);
    assert.deepEqual(history.stages.map((stage) => stage.policies), [first.policies, second.policies]);
    assert.deepEqual(history.stages.map((stage) => stage.causes), [
      ["cause:receipt:first"],
      ["cause:receipt:second"],
    ]);
    assert.deepEqual(history.transitions, [{
      from: first.observation,
      to: second.observation,
      knowledge: "incomparable",
      truth: "descending",
    }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source monitoring uses one generated-material-excluding filesystem policy", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-source-monitor-"));
  try {
    for (const directory of ["src", "src/nested", "src/.tmp", "src/dist", "src/node_modules", "lib", "lib/legacy"]) {
      mkdirSync(path.join(root, directory), { recursive: true });
    }
    writeFileSync(path.join(root, "src", "a.mts"), "export const a = 1;\n");
    writeFileSync(path.join(root, "src", "nested", "b.ts"), "export const b = 2;\n");
    writeFileSync(path.join(root, "src", "nested", "c.mjs"), "export const c = 3;\n");
    writeFileSync(path.join(root, "src", ".tmp", "generated.mts"), "export const generated = true;\n");
    writeFileSync(path.join(root, "src", "dist", "built.mts"), "export const built = true;\n");
    writeFileSync(path.join(root, "src", "node_modules", "dependency.ts"), "export const dependency = true;\n");
    writeFileSync(path.join(root, "lib", "current.mts"), "export const current = true;\n");
    writeFileSync(path.join(root, "lib", "legacy", "archived.mts"), "export const archived = true;\n");

    assert.deepEqual(
      sourceModuleFiles(root, ["src", "lib"]).map((file) => path.relative(root, file).split(path.sep).join("/")),
      ["lib/current.mts", "src/a.mts", "src/nested/b.ts", "src/nested/c.mjs"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source artifact projection stores byte-identical modules once by content identity", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-source-artifact-dedupe-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    const content = "export const duplicate = true;\n";
    writeFileSync(path.join(root, "src", "left.mts"), content);
    writeFileSync(path.join(root, "src", "right.mts"), content);
    const corpus = readSourceModuleCorpus(root, ["src"], 10);
    assert.equal(corpus.files.length, 2);
    assert.equal(corpus.files[0].identity, corpus.files[1].identity);
    assert.equal(sourceModuleArtifacts(corpus).length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source policy declarations are content-addressed authority carried by SEN operation reads", () => {
  const altered = sourceCodePolicy(localImportTargetPolicy.name, [
    closureRule(
      "local-import-target-present",
      [{ cell: LOCAL_IMPORT_TARGET_PRESENT_CELL, atLeast: "potential" }],
      { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "active" },
    ),
  ]);
  assert.notEqual(altered.identity, localImportTargetPolicy.identity);
  const [artifact] = sourceCodePolicyArtifacts([localImportTargetPolicy]);
  assert.equal(artifact.ref, localImportTargetPolicy.identity);
  assert.equal(artifactId(JSON.parse(artifact.canonicalText)), localImportTargetPolicy.identity);
  const forged = Object.freeze({ ...localImportTargetPolicy, rules: altered.rules });
  assert.throws(() => sourceCodePolicyArtifacts([forged]), /identity does not address its declaration/u);

  const operations = sourceCodePolicyOperations({ packageRoot: process.cwd() });
  for (const verb of [
    "source-code-policy",
    "normalize-package-form",
    "source-code-policy-obligations",
    "source-code-policy-obligations-admit",
  ]) {
    assert.deepEqual(
      operations.find((candidate) => candidate.verb === verb)?.reads,
      DEFAULT_SOURCE_CODE_POLICIES.map((policy) => tm.mark(policy.identity)),
    );
  }

  const makeProbe = (policy) => operation({
    verb: "policy-authority-probe",
    reads: [tm.mark(policy.identity)],
    run: () => null,
  });
  assert.notEqual(makeProbe(localImportTargetPolicy).ref, makeProbe(altered).ref);
});

test("module dependency topology separates undirected H1 from directed causal build order", () => {
  const moduleEntry = (path, imports) => Object.freeze({ path, identity: `identity:${path}`, imports });
  const diamond = moduleTopologyRelation(Object.freeze({
    source: "source:diamond",
    observation: "observation:diamond",
    modules: Object.freeze([
      moduleEntry("a.mts", ["b.mts", "c.mts"]),
      moduleEntry("b.mts", ["d.mts"]),
      moduleEntry("c.mts", ["d.mts"]),
      moduleEntry("d.mts", []),
    ]),
  }));
  assert.equal(diamond.measurement.h1, 1);
  assert.deepEqual(diamond.measurement.buildOrder, {
    kind: "metroplat.monitoring.source-code.module-build-order",
    tiers: [["d.mts"], ["b.mts", "c.mts"], ["a.mts"]],
  });
  assert.equal("coordinationFree" in diamond.measurement, false);

  const directedCycle = moduleTopologyRelation(Object.freeze({
    source: "source:cycle",
    observation: "observation:cycle",
    modules: Object.freeze([
      moduleEntry("a.mts", ["b.mts"]),
      moduleEntry("b.mts", ["a.mts"]),
    ]),
  }));
  assert.equal(directedCycle.measurement.buildOrder.kind,
    "metroplat.monitoring.source-code.module-build-order-obstruction");
  assert.equal(directedCycle.measurement.buildOrder.reason, "closed-timelike-curve");
  assert.deepEqual(directedCycle.measurement.buildOrder.cycle, ["a.mts", "b.mts", "a.mts"]);

  const canonicalCycle = settleCausalSet(Object.freeze({
    kind: "lorentzian.causalSet",
    events: Object.freeze(["b", "a"]),
    links: Object.freeze([
      Object.freeze({ from: "b", to: "a" }),
      Object.freeze({ from: "a", to: "b" }),
    ]),
  }));
  assert.equal(canonicalCycle.reason, "closed-timelike-curve");
  assert.deepEqual(canonicalCycle.cycle, ["a", "b", "a"]);
  assert.deepEqual(canonicalCycle.offending, { from: "b", to: "a" });

  const multipleCycles = settleCausalSet(Object.freeze({
    kind: "lorentzian.causalSet",
    events: Object.freeze(["z", "b", "a"]),
    links: Object.freeze([
      Object.freeze({ from: "z", to: "z" }),
      Object.freeze({ from: "a", to: "b" }),
      Object.freeze({ from: "b", to: "a" }),
    ]),
  }));
  assert.equal(multipleCycles.reason, "closed-timelike-curve");
  assert.deepEqual(multipleCycles.cycle, ["a", "b", "a"]);
  assert.deepEqual(multipleCycles.offending, { from: "b", to: "a" });
});

test("type-only imports remain evidence without creating JavaScript build-order cycles", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-type-import-topology-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "a.mts"), 'import "./b.mjs";\nexport const a = true;\n');
    writeFileSync(path.join(root, "src", "b.mts"), 'import type { a } from "./a.mjs";\nexport const b = true;\n');
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const a = topology.modules.find((moduleEntry) => moduleEntry.path === "src/a.mts");
    const b = topology.modules.find((moduleEntry) => moduleEntry.path === "src/b.mts");
    assert.deepEqual(a.imports, ["src/b.mts"]);
    assert.deepEqual(a.typeImports, []);
    assert.deepEqual(b.imports, []);
    assert.deepEqual(b.typeImports, ["src/a.mts"]);
    assert.deepEqual(topology.cyclicComponents, []);
    assert.deepEqual(moduleTopologyRelation(topology).measurement.buildOrder, {
      kind: "metroplat.monitoring.source-code.module-build-order",
      tiers: [["src/b.mts"], ["src/a.mts"]],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module topology reports every maximal runtime dependency knot", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-cyclic-components-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "a.mts"), 'import "./b.mjs";\n');
    writeFileSync(path.join(root, "src", "b.mts"), 'import "./a.mjs";\n');
    writeFileSync(path.join(root, "src", "c.mts"), 'import "./c.mjs";\n');
    writeFileSync(path.join(root, "src", "d.mts"), 'import "./a.mjs";\n');
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    assert.deepEqual(topology.cyclicComponents, [
      ["src/a.mts", "src/b.mts"],
      ["src/c.mts"],
    ]);
    assert.deepEqual(moduleTopologyPage(topology).cyclicComponents, topology.cyclicComponents);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module topology names package reexports instead of hiding assembly behind module edges", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-reexport-topology-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "source.mts"), "export const internal = true;\nexport type Shape = string;\n");
    writeFileSync(path.join(root, "src", "index.mts"), [
      'export { internal as publicValue, type Shape as PublicShape } from "./source.mjs";',
      'export * as sourceNamespace from "./source.mjs";',
      'export * from "external-package";',
      "",
    ].join("\n"));
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const entry = topology.modules.find((moduleEntry) => moduleEntry.path === "src/index.mts");
    assert.deepEqual(entry.reexports, [
      { module: "src/source.mts", imported: "internal", exported: "publicValue", typeOnly: false },
      { module: "src/source.mts", imported: "Shape", exported: "PublicShape", typeOnly: true },
      { module: "src/source.mts", imported: "*", exported: "sourceNamespace", typeOnly: false },
      { module: "external-package", imported: "*", exported: "*", typeOnly: false },
    ]);
    assert.deepEqual(moduleTopologyPage(topology, { paths: ["src/index.mts"] }).modules[0].reexports, entry.reexports);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module topology resolves import aliases to source symbols and exposes reverse symbol consumers", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-symbol-consumer-topology-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "source.mts"), "export const internal = true;\n");
    writeFileSync(path.join(root, "src", "consumer.mts"), [
      'import { internal as localName } from "./source.mjs";',
      "export function usesInternal(): boolean { return localName; }",
      "",
    ].join("\n"));
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const source = topology.modules.find((moduleEntry) => moduleEntry.path === "src/source.mts");
    const consumer = topology.modules.find((moduleEntry) => moduleEntry.path === "src/consumer.mts");
    assert.deepEqual(consumer.symbols[0].dependsOnImportedSymbols, ["src/source.mts#internal"]);
    assert.deepEqual(source.symbols[0].referencedBySymbols, ["src/consumer.mts#usesInternal"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module topology derives context and layer independently for each declaration", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-categorical-placement-"));
  try {
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "types.mts"), [
      "export interface Order { readonly id: string }",
      "export function normalizeOrder(order: Order): Order { return { id: order.id.trim() }; }",
      "",
    ].join("\n"));
    const orders = nodeSubjectAnchor("orders", [nodeDeclarationReference("src/orders/types.mts", "Order")]);
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: [orders] });
    const moduleEntry = topology.modules[0];
    const order = moduleEntry.symbols.find((symbol) => symbol.name === "Order");
    const normalize = moduleEntry.symbols.find((symbol) => symbol.name === "normalizeOrder");

    assert.deepEqual({
      layer: order.placement.layer,
      context: order.placement.context,
      actualLayer: order.placement.actualLayer,
      actualContext: order.placement.actualContext,
      layerMatches: order.placement.layerMatches,
      contextMatches: order.placement.contextMatches,
      confidence: order.placement.confidence,
    }, {
      layer: "types",
      context: "orders",
      actualLayer: "types",
      actualContext: "orders",
      layerMatches: true,
      contextMatches: true,
      confidence: "reified",
    });
    assert.deepEqual({
      layer: normalize.placement.layer,
      context: normalize.placement.context,
      actualLayer: normalize.placement.actualLayer,
      layerMatches: normalize.placement.layerMatches,
    }, {
      layer: "domain",
      context: "orders",
      actualLayer: "types",
      layerMatches: false,
    });
    assert.equal(topology.layoutConvention.reading, "potential");
    assert.equal(topology.layoutConvention.convention, "context-directory-layer-filename");
    assert.deepEqual(topology.layoutConvention.candidates, ["context-directory-layer-filename"]);
    assert.ok(topology.layoutConvention.identity.startsWith("ni:///sha-256;"));
    assert.deepEqual(moduleEntry.placementLayers, ["domain", "types"]);
    assert.deepEqual(moduleEntry.placementContexts, ["orders"]);
    assert.deepEqual(moduleEntry.placementColors, ["source|orders|domain", "source|orders|types"]);
    assert.equal(moduleEntry.carrierChromaticNumber, 2);
    assert.equal(moduleEntry.mixedPlacement, true);
    assert.equal(topology.symbols, 2);
    assert.equal(topology.layerMismatches, 1);
    assert.equal(topology.contextMismatches, 0);
    assert.equal(topology.mixedPlacementModules, 1);
    assert.equal(topology.multicoloredCarriers, 1);
    assert.equal(topology.maxCarrierChromaticNumber, 2);
    assert.ok(topology.speciesFormulas >= 2);
    assert.deepEqual(topology.subjectAnchors, [orders]);
    const cuts = evaluateSourceCodePolicies(topology).rulings.filter((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling");
    assert.deepEqual(cuts, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module topology keeps competing package layout conventions as stable evidence", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-layout-convention-"));
  try {
    mkdirSync(path.join(root, "src", "orders", "services"), { recursive: true });
    mkdirSync(path.join(root, "src", "services", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "services", "context-first.mts"), [
      "/** @metroplatSubject orders */",
      "export interface Order { readonly id: string }",
      "",
    ].join("\n"));
    writeFileSync(path.join(root, "src", "services", "orders", "layer-first.mts"), "export const layerFirst = true;\n");
    writeFileSync(path.join(root, "src", "orders", "filename.service.mts"), "export const filenameLayer = true;\n");

    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    assert.equal(topology.layoutConvention.reading, "stable");
    assert.equal(topology.layoutConvention.convention, undefined);
    assert.deepEqual(topology.layoutConvention.candidates, [
      "context-directory-layer-filename",
      "context-layer-directories",
      "layer-context-directories",
    ]);
    assert.deepEqual(topology.layoutConvention.observations.map((entry) => ({
      convention: entry.convention,
      paths: entry.paths,
    })), [
      { convention: "context-directory-layer-filename", paths: ["src/orders/filename.service.mts"] },
      { convention: "context-layer-directories", paths: ["src/orders/services/context-first.mts"] },
      { convention: "layer-context-directories", paths: ["src/services/orders/layer-first.mts"] },
    ]);
    assert.ok(topology.layoutConvention.reasons[0].includes("incompatible nesting conventions"));
    assert.ok(topology.modules.every((moduleEntry) => !("normalizationCuts" in moduleEntry)));
    const contextFirst = evaluateSourceCodePolicies(topology).rulings.find((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling"
      && ruling.cut.from.endsWith("context-first.mts"));
    assert.equal(contextFirst.cut.action, "move-module");
    assert.equal(contextFirst.cut.to, "src/orders/context-first.type.mts");
    assert.ok(contextFirst.cut.reasons.includes("target package layout convention declared by policy: context-directory-layer-filename"));

    const conflictingTarget = sourceCodePolicy("architecture:layer-first-layout", [], {
      layoutConvention: "layer-context-directories",
    });
    const stablePolicyCut = evaluateSourceCodePolicies(topology, [normalizationCutPolicy, conflictingTarget]).rulings.find((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling"
      && ruling.cut.from.endsWith("context-first.mts"));
    assert.equal(stablePolicyCut, undefined);

    const normalize = sourceCodePolicyOperations({ packageRoot: root })
      .find((candidate) => candidate.verb === "normalize-package-form");
    const request = {
      kind: "metroplat.monitoring.source-code.policy-normalization-request",
      sourceDirs: ["src"],
      cut: contextFirst.cut.identity,
    };
    const planned = await normalize.execute(request, {});
    assert.equal(planned.value.cut, contextFirst.cut.identity);
    assert.equal(planned.value.execution.carrierMove.status, "planned");
    assert.equal(existsSync(path.join(root, "src", "orders", "services", "context-first.mts")), true);

    const applied = await normalize.execute({ ...request, apply: true }, {});
    assert.equal(applied.value.execution.carrierMove.status, "applied");
    assert.equal(existsSync(path.join(root, "src", "orders", "services", "context-first.mts")), false);
    assert.equal(existsSync(path.join(root, "src", "orders", "context-first.type.mts")), true);
    await assert.rejects(
      normalize.execute({ ...request, apply: true }, {}),
      /not a currently active actionable move-module cut/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("normalization retains a conventional plural layer filename already recognized by JSNode", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-layer-filename-round-trip-"));
  try {
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "types.mts"), "export interface Order { readonly id: string }\n");
    const orders = nodeSubjectAnchor("orders", [nodeDeclarationReference("src/orders/types.mts", "Order")]);
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: [orders] });
    const order = topology.modules[0].symbols.find((symbol) => symbol.name === "Order");
    assert.equal(order.placement.layer, "types");
    assert.equal(order.placement.actualLayer, "types");
    assert.equal(order.placement.layerMatches, true);
    const cuts = evaluateSourceCodePolicies(topology).rulings.filter((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling");
    assert.deepEqual(cuts, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSNode subject anchors govern semantic placement while paths remain carrier observations", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-subject-anchor-placement-"));
  try {
    mkdirSync(path.join(root, "src", "legacy"), { recursive: true });
    writeFileSync(path.join(root, "src", "legacy", "order.mts"), [
      "export interface Order { readonly id: string }",
      "export function normalizeOrder(order: Order): Order { return order; }",
      "",
    ].join("\n"));

    const unanchored = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const unanchoredOrder = unanchored.modules[0].symbols.find((symbol) => symbol.name === "Order");
    assert.equal(unanchoredOrder.placement.context, undefined);
    assert.equal(unanchoredOrder.placement.contextStatus, "absurd");
    assert.equal(unanchoredOrder.placement.actualContext, "legacy");
    assert.equal(unanchoredOrder.placement.contextMatches, undefined);
    assert.equal(unanchoredOrder.placement.kind, "metroplat.monitoring.source-code.placement:obstruction");
    assert.equal(unanchoredOrder.placement.layer, undefined);
    assert.equal("suggestedPath" in unanchoredOrder.placement, false);
    assert.ok(unanchoredOrder.placement.obstructions.some((obstruction) =>
      obstruction.includes("subject context remains absurd")));
    assert.equal(unanchoredOrder.placement.ambiguous, true);
    assert.equal(unanchored.placementObstructions, unanchored.symbols);
    const unanchoredCuts = evaluateSourceCodePolicies(unanchored).rulings.filter((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling");
    assert.deepEqual(unanchoredCuts, []);
    assert.equal(unanchored.unresolvedContexts, unanchored.symbols);
    assert.equal(unanchored.crossCuttingContexts, 0);
    assert.deepEqual(unanchored.subjectAnchors, []);
    assert.equal(unanchored.subjectAnchorCoverage, "partial");
    assert.equal(unanchored.subjectAnchoredSymbols, 0);
    assert.equal(unanchored.subjectUnanchoredSymbols, unanchored.symbols);
    assert.equal(unanchored.multiplySubjectAnchoredSymbols, 0);

    const complete = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchorCoverage: "complete" });
    const completeOrder = complete.modules[0].symbols.find((symbol) => symbol.name === "Order");
    assert.equal(completeOrder.placement.contextStatus, "cross-cutting");
    assert.equal(completeOrder.placement.contextMatches, false);
    assert.equal(complete.unresolvedContexts, 0);
    assert.equal(complete.crossCuttingContexts, complete.symbols);
    assert.equal(complete.subjectAnchorCoverage, "complete");

    const orders = nodeSubjectAnchor("orders", [nodeDeclarationReference("src/legacy/order.mts", "Order")]);
    const anchored = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: [orders] });
    const anchoredOrder = anchored.modules[0].symbols.find((symbol) => symbol.name === "Order");
    const normalize = anchored.modules[0].symbols.find((symbol) => symbol.name === "normalizeOrder");
    assert.equal(anchoredOrder.placement.context, "orders");
    assert.equal(anchoredOrder.placement.kind, "metroplat.monitoring.source-code.placement:witness");
    assert.equal(anchoredOrder.placement.actualContext, "legacy");
    assert.equal(anchoredOrder.placement.contextMatches, false);
    assert.equal(normalize.placement.context, "orders");
    assert.equal(normalize.placement.contextReason, "stated codomain subject anchor");
    assert.equal("suggestedPath" in normalize.placement, false);
    assert.deepEqual(anchored.subjectAnchors, [orders]);
    const changingAnchors = [orders];
    readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: changingAnchors });
    changingAnchors[0] = nodeSubjectAnchor("sales", orders.declarations);
    const changed = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: changingAnchors });
    assert.equal(changed.modules[0].symbols.find(symbol => symbol.name === "Order").placement.context, "sales");
    changingAnchors[0] = { ...orders, identity: artifactId({ tampered: true }) };
    assert.throws(() => readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: changingAnchors }), /subject anchor identity does not verify/u);
    assert.equal(anchored.subjectAnchorCoverage, "partial");
    assert.equal(anchored.subjectAnchoredSymbols, 1);
    assert.equal(anchored.subjectUnanchoredSymbols, 1);
    assert.equal(anchored.multiplySubjectAnchoredSymbols, 0);

    const stable = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"],
      subjectAnchors: [orders, nodeSubjectAnchor("sales", [nodeDeclarationReference("src/legacy/order.mts", "Order")])],
    });
    const stableOrder = stable.modules[0].symbols.find((symbol) => symbol.name === "Order");
    assert.equal(stableOrder.placement.context, undefined);
    assert.equal(stableOrder.placement.contextStatus, "stable");
    assert.equal(stableOrder.placement.kind, "metroplat.monitoring.source-code.placement:obstruction");
    assert.equal("suggestedPath" in stableOrder.placement, false);
    assert.equal(stableOrder.placement.ambiguous, true);
    assert.ok(stableOrder.placement.ambiguityCauses.some((cause) =>
      cause.includes("multiple stated declaration subject anchors: orders, sales")));
    assert.equal(stable.subjectAnchoredSymbols, 1);
    assert.equal(stable.subjectUnanchoredSymbols, 1);
    assert.equal(stable.multiplySubjectAnchoredSymbols, 1);

    assert.throws(() => readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"],
      subjectAnchors: [{ ...orders, identity: artifactId({ tampered: true }) }],
    }), /subject anchor identity does not verify/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSNode source declarations become exact addressed subject anchors without name collisions", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-source-subject-anchor-"));
  try {
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    mkdirSync(path.join(root, "src", "sales"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "types.mts"), [
      "/** @metroplatSubject orders */",
      "export interface Order { readonly id: string }",
      "export function normalizeOrder(order: Order): Order { return order; }",
      "",
    ].join("\n"));
    writeFileSync(path.join(root, "src", "sales", "types.mts"),
      "export interface Order { readonly id: string }\n");

    const orders = nodeSubjectAnchor("orders", [
      nodeDeclarationReference("src/orders/types.mts", "Order"),
    ]);
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    assert.deepEqual(topology.subjectAnchors, [orders]);

    const ordersModule = topology.modules.find((moduleEntry) => moduleEntry.path === "src/orders/types.mts");
    const salesModule = topology.modules.find((moduleEntry) => moduleEntry.path === "src/sales/types.mts");
    assert.equal(ordersModule.symbols.find((symbol) => symbol.name === "Order").placement.context, "orders");
    assert.equal(ordersModule.symbols.find((symbol) => symbol.name === "normalizeOrder").placement.context, "orders");
    assert.equal(salesModule.symbols.find((symbol) => symbol.name === "Order").placement.context, undefined);

    const [topologyOperation] = moduleTopologyOperations({ packageRoot: root });
    const handled = topologyOperation.execute({ sourceDirs: ["src"] }, {});
    assert.equal(handled.value.subjectAnchorCoverage, "partial");
    const anchorArtifact = handled.artifacts.find((artifact) => artifact.ref === orders.identity);
    assert.ok(anchorArtifact);
    assert.equal(artifactId(JSON.parse(anchorArtifact.canonicalText)), orders.identity);
    const complete = topologyOperation.execute({
      sourceDirs: ["src"],
      subjectAnchorCoverage: "complete",
    }, {});
    assert.equal(complete.value.subjectAnchorCoverage, "complete");
    assert.equal(complete.value.crossCuttingContexts, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSNode package documentation states one subject anchor for every declaration in a coherent module", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-module-subject-anchor-"));
  try {
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "service.mts"), [
      "/**",
      " * @packageDocumentation",
      " * Order handling.",
      " * @metroplatSubject orders",
      " */",
      'import type { JsonValue } from "./types.mjs";',
      "export interface Order { readonly id: string }",
      "export function normalizeOrder(order: Order): Order { return order; }",
      "export const orderId = (value: JsonValue): string => String(value);",
      "",
    ].join("\n"));
    writeFileSync(path.join(root, "src", "orders", "types.mts"),
      "export type JsonValue = absurd;\n");

    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const moduleEntry = topology.modules.find((entry) => entry.path === "src/orders/service.mts");
    assert.deepEqual(moduleEntry.symbols.map((symbol) => symbol.placement.context), [
      "orders",
      "orders",
      "orders",
    ]);
    assert.deepEqual(topology.subjectAnchors, [
      nodeSubjectAnchor("orders", [
        nodeDeclarationReference("src/orders/service.mts", "Order"),
        nodeDeclarationReference("src/orders/service.mts", "normalizeOrder"),
        nodeDeclarationReference("src/orders/service.mts", "orderId"),
      ]),
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSNode subject anchors admit only package-safe subjects and exact declarations", () => {
  assert.throws(() => nodeSubjectAnchor("../orders", [
    nodeDeclarationReference("src/orders/types.mts", "Order"),
  ]), /one kebab-case package segment/u);
  assert.throws(() => nodeSubjectAnchor("orders", ["Order"]), /module#symbol/u);
  assert.throws(() => nodeDeclarationReference("../orders/types.mts", "Order"), /root-relative source path/u);
});

test("placement keeps complete anchored integrations together without aesthetic filename churn", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-placement-boundary-"));
  try {
    mkdirSync(path.join(root, "src", "integrations", "payments"), { recursive: true });
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "integrations", "payments", "types.mts"),
      "export interface Payment { readonly amount: number }\n");
    writeFileSync(path.join(root, "src", "integrations", "payments", "service.mts"), [
      'import type { Payment } from "./types.mjs";',
      "export function normalizePayment(payment: Payment): Payment { return { amount: Math.max(0, payment.amount) }; }",
      "",
    ].join("\n"));
    writeFileSync(path.join(root, "src", "orders", "misc.mts"),
      "export interface Order { readonly id: string }\n");
    writeFileSync(path.join(root, "src", "orders", "problem.mts"),
      "export class OrderError extends Error {}\n");

    const payments = nodeSubjectAnchor("payments", [nodeDeclarationReference("src/integrations/payments/types.mts", "Payment")]);
    const orders = nodeSubjectAnchor("orders", [
      nodeDeclarationReference("src/orders/misc.mts", "Order"),
      nodeDeclarationReference("src/orders/problem.mts", "OrderError"),
    ]);
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchors: [payments, orders] });
    const paymentService = topology.modules.find((moduleEntry) =>
      moduleEntry.path === "src/integrations/payments/service.mts");
    const normalize = paymentService.symbols[0];
    assert.deepEqual({
      region: normalize.placement.packageRegion,
      actualRegion: normalize.placement.actualPackageRegion,
      actualLayer: normalize.placement.actualLayer,
      layer: normalize.placement.layer,
      context: normalize.placement.context,
    }, {
      region: "integration",
      actualRegion: "integration",
      actualLayer: "services",
      layer: "domain",
      context: "payments",
    });
    assert.equal(topology.layoutConvention.reading, "potential");
    assert.equal(topology.layoutConvention.convention, "context-directory-layer-filename");
    const evaluation = evaluateSourceCodePolicies(topology);
    const cutRulings = evaluation.rulings.filter((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling");
    assert.deepEqual(cutRulings, []);
    assert.ok(normalize.placement.packageRegionReason.includes(
      "payments is an anchored integration context",
    ));
    const obligations = sourceCodePolicyObligations(evaluation).observations;
    const normalizationObligations = obligations.filter((observation) =>
      observation.boundary.evidence.some((entry) => entry.startsWith("normalization-cut:")));
    assert.deepEqual(normalizationObligations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSNode service is an SEN-read taxon over named ports, not an import count", () => {
  const direct = readNodeBeingTaxon(Object.freeze({
    kind: "metroplat.language.jsnode.being",
    subject: "fixture#coordinate",
    predicates: Object.freeze(["being:callable", "effects:multiple", "model:abstract"].map((predicate) => Object.freeze({
      predicate,
      basis: "type-system",
      confidence: "reified",
    }))),
    ports: Object.freeze(["abstract:Users", "abstract:Orders"]),
  }), nodeBeingTaxon("service"));
  assert.equal(direct.reading, "potential");
  assert.equal(direct.defect, 0);

  const root = mkdtempSync(path.join(tmpdir(), "metroplat-jsnode-taxa-"));
  const files = {
    "src/orders/types.mts": [
      "export interface UserRepository { load(): Promise<string>; }",
      "export interface OrderRepository { save(value: string): Promise<void>; }",
    ].join("\n"),
    "src/orders/helpers.mts": [
      "import type { UserRepository, OrderRepository } from './types.mjs';",
      "export function loadUser(users: UserRepository) { return users.load(); }",
      "export function saveOrder(orders: OrderRepository, value: string) { return orders.save(value); }",
      "export function recursiveLoad(users: UserRepository, depth: number): Promise<string> {",
      "  return depth <= 0 ? users.load() : recursiveLoad(users, depth - 1);",
      "}",
    ].join("\n"),
    "src/orders/work.mts": [
      "import path from 'node:path';",
      "import type { UserRepository, OrderRepository } from './types.mjs';",
      "import { loadUser, saveOrder, recursiveLoad } from './helpers.mjs';",
      "export async function coordinate(users: UserRepository, orders: OrderRepository) {",
      "  const value = await users.load();",
      "  await orders.save(value);",
      "}",
      "export async function coordinateByComposition(users: UserRepository, orders: OrderRepository) {",
      "  const value = await loadUser(users);",
      "  await saveOrder(orders, value);",
      "}",
      "export function recursivelyLoad(users: UserRepository) { return recursiveLoad(users, 1); }",
      "export function formatName(value: string) { return path.basename(value); }",
      "export function hostFetch() { return globalThis.fetch; }",
    ].join("\n"),
    "src/orders/crypto.mts": [
      "import { createHash, randomBytes } from 'node:crypto';",
      "export interface Formatter { format(value: string): string; }",
      "export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }",
      "export function nonce() { return randomBytes(16); }",
      "export function render(formatter: Formatter, value: string) { return formatter.format(value); }",
    ].join("\n"),
  };
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), content);
  }
  try {
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchorCoverage: "complete" });
    const symbols = topology.modules.find((moduleEntry) => moduleEntry.path === "src/orders/work.mts").symbols;
    const service = symbols.find((symbol) => symbol.name === "coordinate");
    assert.equal(service.being.taxon, "service");
    assert.equal(service.being.taxonReading, "potential");
    assert.ok(service.being.formula.identity.startsWith("ni:///sha-256;"));
    assert.ok(service.being.formula.taxonomy.startsWith("ni:///sha-256;"));
    assert.ok(service.being.formula.potential.includes("service"));
    assert.equal([
      ...service.being.formula.potential,
      ...service.being.formula.active,
      ...service.being.formula.stable,
      ...service.being.formula.absurd,
    ].length, 21);
    assert.deepEqual(service.being.ports, ["abstract:OrderRepository", "abstract:UserRepository"]);
    assert.equal(service.placement.layer, "services");
    assert.equal(service.placement.confidence, "reified");
    assert.deepEqual(service.being.predicates.filter((entry) => service.being.taxonSupport.includes(entry.predicate)), [
      { predicate: "being:callable", basis: "syntax", confidence: "reified" },
      { predicate: "effects:multiple", basis: "type-system", confidence: "reified" },
    ]);
    assert.equal(topology.speciesContext.formulas.reduce((total, entry) => total + entry.occurrences, 0), topology.symbols);
    assert.equal(topology.speciesContext.formulas.length, topology.speciesFormulas);
    const serviceConcept = topology.speciesConcepts.find((concept) => concept.taxon === "service");
    assert.ok(serviceConcept.extent.includes(service.being.formula.identity));
    assert.ok(serviceConcept.intent.includes("being:callable"));
    assert.ok(serviceConcept.intent.includes("effects:multiple"));
    assert.ok(serviceConcept.population >= 2);

    const composed = symbols.find((symbol) => symbol.name === "coordinateByComposition");
    assert.equal(composed.being.taxon, "service");
    assert.equal(composed.being.formula.identity, service.being.formula.identity);
    assert.deepEqual(composed.being.effectClosure.directPorts, []);
    assert.deepEqual(composed.being.effectClosure.ports, ["abstract:OrderRepository", "abstract:UserRepository"]);
    assert.deepEqual(composed.being.effectClosure.callables.map((entry) => entry.split("#")[1].split(":")[0]), ["loadUser", "saveOrder"]);
    assert.equal(composed.being.predicates.some((entry) => entry.predicate === "composition:composed"), true);

    const recursive = symbols.find((symbol) => symbol.name === "recursivelyLoad");
    assert.equal(recursive.being.effectClosure.recursive, true);
    assert.deepEqual(recursive.being.ports, ["abstract:UserRepository"]);
    assert.ok(recursive.being.effectClosure.rounds >= 1);

    const pureImport = symbols.find((symbol) => symbol.name === "formatName");
    assert.notEqual(pureImport.being.taxon, "service");
    assert.equal(pureImport.being.predicates.some((entry) => entry.predicate === "effects:multiple"), false);
    assert.equal(pureImport.being.taxon, "unresolved");
    assert.equal(pureImport.placement.kind, "metroplat.monitoring.source-code.placement:obstruction");
    assert.equal(pureImport.placement.layer, undefined);
    assert.equal("suggestedPath" in pureImport.placement, false);
    assert.ok(pureImport.placement.obstructions.some((obstruction) =>
      obstruction.includes("no JSNode species has potential evidence")));
    assert.equal(pureImport.placement.ambiguous, true);
    assert.ok(topology.placementObstructions >= 1);
    const hostFetch = symbols.find((symbol) => symbol.name === "hostFetch");
    assert.equal(hostFetch.being.taxon, "adapter");
    assert.equal(hostFetch.being.taxonReading, "potential");
    assert.deepEqual(hostFetch.being.effectClosure.ports, ["concrete:host:fetch"]);
    assert.equal(hostFetch.placement.packageRegion, "integration");
    const cryptoSymbols = topology.modules.find((moduleEntry) => moduleEntry.path === "src/orders/crypto.mts").symbols;
    const digest = cryptoSymbols.find((symbol) => symbol.name === "digest");
    assert.equal(digest.being.taxon, "generic-utility");
    assert.deepEqual(digest.being.effectClosure.ports, []);
    assert.deepEqual(digest.being.effectClosure.unresolved, []);
    const nonce = cryptoSymbols.find((symbol) => symbol.name === "nonce");
    assert.equal(nonce.being.taxon, "adapter");
    assert.deepEqual(nonce.being.effectClosure.ports, ["concrete:node:crypto:randomness"]);
    assert.equal(nonce.placement.packageRegion, "integration");
    const render = cryptoSymbols.find((symbol) => symbol.name === "render");
    assert.equal(render.being.taxon, "generic-utility");
    assert.deepEqual(render.being.effectClosure.ports, []);
    const serviceCensus = topology.speciesCensus.find((entry) => entry.taxon === "service");
    assert.ok(serviceCensus.potential >= 2);
    assert.equal(serviceCensus.potential + serviceCensus.active + serviceCensus.stable + serviceCensus.absurd, topology.symbols);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("admitted relative modules preserve local effect closures without order-dependent graph metadata", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-admitted-effect-topology-"));
  try {
    mkdirSync(path.join(root, "src", "directory"), { recursive: true });
    const files = {
      "src/ports.ts": "export interface WorkRepository { load(): Promise<string>; }\n",
      "src/leaf.mts": [
        'import type { WorkRepository } from "./ports.js";',
        "export function leaf(repository: WorkRepository) { return repository.load(); }",
        "",
      ].join("\n"),
      "src/caller.mts": [
        'import type { WorkRepository } from "./ports.js";',
        'import { leaf } from "./leaf.mjs";',
        "export function caller(repository: WorkRepository) { return leaf(repository); }",
        "",
      ].join("\n"),
      "src/common.cts": [
        'import type { WorkRepository } from "./ports.js";',
        "export function common(repository: WorkRepository) { return repository.load(); }",
        "",
      ].join("\n"),
      "src/common-caller.cts": [
        'import type { WorkRepository } from "./ports.js";',
        'import { common } from "./common.cjs";',
        "export function commonCaller(repository: WorkRepository) { return common(repository); }",
        "",
      ].join("\n"),
      "src/directory/index.mts": "export const indexed = true;\n",
      "src/entry.mts": 'import "./directory";\nexport const entry = true;\n',
    };
    for (const [relative, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      writeFileSync(path.join(root, relative), content);
    }

    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchorCoverage: "complete" });
    const module = (name) => topology.modules.find((entry) => entry.path === name);
    const symbol = (moduleName, name) => module(moduleName).symbols.find((entry) => entry.name === name);
    const leaf = symbol("src/leaf.mts", "leaf");
    const caller = symbol("src/caller.mts", "caller");
    const common = symbol("src/common.cts", "common");
    const commonCaller = symbol("src/common-caller.cts", "commonCaller");

    assert.deepEqual(module("src/caller.mts").imports, ["src/leaf.mts"]);
    assert.deepEqual(module("src/caller.mts").typeImports, ["src/ports.ts"]);
    assert.deepEqual(module("src/common-caller.cts").imports, ["src/common.cts"]);
    assert.deepEqual(module("src/entry.mts").imports, ["src/directory/index.mts"]);
    assert.deepEqual(caller.being.effectClosure.ports, ["abstract:WorkRepository"]);
    assert.deepEqual(commonCaller.being.effectClosure.ports, ["abstract:WorkRepository"]);
    assert.equal(leaf.being.effectClosure.reachableCallables, 0);
    assert.equal(caller.being.effectClosure.reachableCallables, 1);
    assert.equal(common.being.effectClosure.reachableCallables, 0);
    assert.equal(commonCaller.being.effectClosure.reachableCallables, 1);
    assert.notEqual(leaf.being.effectClosure.identity, caller.being.effectClosure.identity);
    assert.notEqual(common.being.effectClosure.identity, commonCaller.being.effectClosure.identity);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("shared diamonds and recursive components retain every admitted effect", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-effect-closure-graph-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "graph.mts"), [
      "export interface LeftRepository { left(): void; }",
      "export interface RightRepository { right(): void; }",
      "export function shared(left: LeftRepository) { return left.left(); }",
      "export function first(left: LeftRepository) { return shared(left); }",
      "export function second(right: RightRepository, left: LeftRepository) { right.right(); return shared(left); }",
      "export function diamond(left: LeftRepository, right: RightRepository) { first(left); return second(right, left); }",
      "export function cycleA(left: LeftRepository, depth: number): void { if (depth > 0) cycleB(left, depth - 1); else left.left(); }",
      "export function cycleB(left: LeftRepository, depth: number): void { cycleA(left, depth); }",
      "",
    ].join("\n"));
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchorCoverage: "complete" });
    const symbols = topology.modules[0].symbols;
    const named = (name) => symbols.find((entry) => entry.name === name);
    const diamond = named("diamond");
    const shared = named("shared");
    const cycleA = named("cycleA");

    assert.deepEqual(diamond.being.effectClosure.ports, ["abstract:LeftRepository", "abstract:RightRepository"]);
    assert.equal(diamond.being.effectClosure.reachableCallables, 3);
    assert.equal(shared.being.effectClosure.reachableCallables, 0);
    assert.deepEqual(cycleA.being.effectClosure.ports, ["abstract:LeftRepository"]);
    assert.equal(cycleA.being.effectClosure.recursive, true);
    assert.ok(cycleA.being.effectClosure.rounds >= 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSNode objects, coalgebras, automata, bindings, and special morphisms share the SEN taxonomy", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-jsnode-being-taxa-"));
  try {
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "beings.mts"), [
      "export interface Order { readonly id: string }",
      "export interface OrderInput { readonly id: string }",
      "export class OrderError extends Error {}",
      "export class OrderEntity { id = ''; rename(id: string) { this.id = id; } }",
      "export const OrderSchema = { type: 'object' } as const;",
      "export const orderRoutes = { '/orders': 'list' } as const;",
      "export const orderPlugin = { install: 'orders' } as const;",
      "export const orderState = new Map<string, string>();",
      "export const orderValue = 1;",
      "export function validateOrder(value: Order): boolean { return value.id.length > 0; }",
      "export function toOrder(input: OrderInput): Order { return { id: input.id }; }",
      "export function useOrder(order: Order): Order { return order; }",
      "export function SynchronizeCommand(order: Order): Order { return order; }",
      "",
    ].join("\n"));

    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"], subjectAnchorCoverage: "complete" });
    const symbols = topology.modules[0].symbols;
    const reading = Object.fromEntries(symbols.map((symbol) => [symbol.name, {
      taxon: symbol.being.taxon,
      layer: symbol.placement.layer,
      reading: symbol.being.taxonReading,
    }]));
    assert.deepEqual(reading, {
      Order: { taxon: "type-object", layer: "types", reading: "potential" },
      OrderInput: { taxon: "boundary-transfer-object", layer: "dto", reading: "potential" },
      OrderError: { taxon: "error", layer: "errors", reading: "potential" },
      OrderEntity: { taxon: "entity", layer: "entities", reading: "potential" },
      OrderSchema: { taxon: "schema", layer: "schemas", reading: "potential" },
      orderRoutes: { taxon: "route-table", layer: "routes", reading: "potential" },
      orderPlugin: { taxon: "plugin", layer: "plugins", reading: "potential" },
      orderState: { taxon: "state-binding", layer: "state", reading: "potential" },
      orderValue: { taxon: "generic-value", layer: "utils", reading: "potential" },
      validateOrder: { taxon: "validator", layer: "validators", reading: "potential" },
      toOrder: { taxon: "mapper", layer: "mappers", reading: "potential" },
      useOrder: { taxon: "hook", layer: "hooks", reading: "potential" },
      SynchronizeCommand: { taxon: "command", layer: "commands", reading: "potential" },
    });
    assert.equal(symbols.find((symbol) => symbol.name === "OrderError").placement.confidence, "reified");
    assert.equal(symbols.find((symbol) => symbol.name === "OrderInput").placement.confidence, "heuristic");
    assert.equal(symbols.find((symbol) => symbol.name === "OrderSchema").placement.confidence, "heuristic");
    assert.ok(symbols.every((symbol) => symbol.being.taxonIdentity.startsWith("ni:///sha-256;")));
    const reviewWork = sourceCodePolicyObligations(evaluateSourceCodePolicies(topology)).observations.filter((observation) =>
      observation.boundary.evidence.includes("work-kind:evidence-gathering"));
    assert.deepEqual(reviewWork, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("normalization retains partial subject vocabulary as topology obstruction rather than pseudo-work", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-jsnode-defect-species-"));
  try {
    mkdirSync(path.join(root, "src", "orders"), { recursive: true });
    writeFileSync(path.join(root, "src", "orders", "first.mts"), "export interface FirstOrder { readonly id: string }\n");
    writeFileSync(path.join(root, "src", "orders", "second.mts"), "export interface SecondOrder { readonly id: string }\n");

    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    assert.equal(topology.placementObstructions, topology.symbols);
    assert.equal(topology.unresolvedContexts, topology.symbols);
    const reviewRulings = evaluateSourceCodePolicies(topology).rulings.filter((ruling) =>
      ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling");
    assert.deepEqual(reviewRulings, []);

    const reviewWork = sourceCodePolicyObligations(evaluateSourceCodePolicies(topology)).observations.filter((observation) =>
      observation.boundary.evidence.includes("work-kind:evidence-gathering"));
    assert.deepEqual(reviewWork, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sourceModuleStratum reads the outermost package layout stratum with a transparent leading src/", () => {
  assert.equal(sourceModuleStratum("src/scripts/x.mts"), "scripts");
  assert.equal(sourceModuleStratum("src/apps/y/z.mts"), "apps");
  assert.equal(sourceModuleStratum("src/x.mts"), "src");
  assert.equal(sourceModuleStratum("scripts/x.mjs"), "scripts");
  assert.equal(sourceModuleStratum("apps/x.mjs"), "apps");
  assert.equal(sourceModuleStratum("README.md"), undefined);
  assert.equal(sourceModuleStratum("lib/x.mts"), "lib");
  assert.equal(sourceModuleStratum("test/x.test.mjs"), "test");
  assert.equal(sourceModuleStratum("src/lib/identity/index.mts"), "lib");
  assert.equal(sourceModuleStratum("src/monitoring/source-code/policy.mts"), "src");
  assert.equal(sourceModuleStratum("content/text/x.md"), undefined);
});

test("import-stratification policy encodes exactly the owner-stated scripts -> apps edge as its own finite observation fiber", () => {
  assert.equal(importStratificationPolicy.name, "default:import-stratification");
  assert.equal(importStratificationPolicy.rules.length, 2);
  const [deny, lawful] = importStratificationPolicy.rules;
  assert.equal(deny.name, "scripts-may-not-import-apps");
  assert.deepEqual(deny.antecedent, [{ cell: IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL, atLeast: "potential" }]);
  assert.deepEqual(deny.consequent, { cell: IMPORT_STRATIFICATION_CONFORMS_CELL, reading: "active" });
  assert.equal(lawful.name, "import-stratification-lawful");
  assert.deepEqual(lawful.antecedent, [{ cell: IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL, atLeast: "active" }]);
  assert.deepEqual(lawful.consequent, { cell: IMPORT_STRATIFICATION_CONFORMS_CELL, reading: "potential" });
  assert.ok(DEFAULT_SOURCE_CODE_POLICIES.some((policy) => policy.identity === importStratificationPolicy.identity));
});

test("import-stratification law denies a scripts module importing an apps module, settling active not stable", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-import-stratification-active-"));
  try {
    mkdirSync(path.join(root, "scripts"), { recursive: true });
    mkdirSync(path.join(root, "apps"), { recursive: true });
    writeFileSync(path.join(root, "scripts", "run.mts"), 'import "../apps/face.mjs";\nexport const run = true;\n');
    writeFileSync(path.join(root, "apps", "face.mts"), "export const face = true;\n");
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["scripts", "apps"] });
    const evaluation = evaluateSourceCodePolicies(topology);
    const stratificationRuling = evaluation.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.import-stratification-ruling"
      && candidate.from === "scripts/run.mts");
    const localImportRuling = evaluation.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.local-import-ruling"
      && candidate.from === "scripts/run.mts");
    assert.ok(stratificationRuling);
    assert.equal(stratificationRuling.importerStratum, "scripts");
    assert.equal(stratificationRuling.targetStratum, "apps");
    assert.equal(stratificationRuling.judgement, "active");
    assert.ok(stratificationRuling.fired.some((entry) =>
      entry.rule === "scripts-may-not-import-apps" && entry.policy === importStratificationPolicy.identity));
    // The target is genuinely present (admitted), so the wholly separate
    // local-import-target-present concern still, correctly, holds: import
    // stratification is a distinct finite observation fiber, never merged
    // with target presence, so one concern's evidence never masks the
    // other's violation into `stable`.
    assert.ok(localImportRuling);
    assert.equal(localImportRuling.targetPresent, true);
    assert.equal(localImportRuling.judgement, "potential");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("import-stratification law holds apps importing scripts and scripts importing src", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-import-stratification-potential-"));
  try {
    mkdirSync(path.join(root, "apps"), { recursive: true });
    mkdirSync(path.join(root, "scripts"), { recursive: true });
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "apps", "face.mts"), 'import "../scripts/run.mjs";\nexport const face = true;\n');
    writeFileSync(path.join(root, "scripts", "run.mts"), 'import "../src/core.mjs";\nexport const run = true;\n');
    writeFileSync(path.join(root, "src", "core.mts"), "export const core = true;\n");
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["apps", "scripts", "src"] });
    const evaluation = evaluateSourceCodePolicies(topology);
    const appsToScripts = evaluation.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.import-stratification-ruling"
      && candidate.from === "apps/face.mts");
    const scriptsToSrc = evaluation.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.import-stratification-ruling"
      && candidate.from === "scripts/run.mts");
    assert.ok(appsToScripts);
    assert.equal(appsToScripts.importerStratum, "apps");
    assert.equal(appsToScripts.targetStratum, "scripts");
    assert.equal(appsToScripts.judgement, "potential");
    assert.ok(!appsToScripts.fired.some((entry) => entry.rule === "scripts-may-not-import-apps"));
    assert.ok(scriptsToSrc);
    assert.equal(scriptsToSrc.importerStratum, "scripts");
    assert.equal(scriptsToSrc.targetStratum, "src");
    assert.equal(scriptsToSrc.judgement, "potential");
    assert.ok(!scriptsToSrc.fired.some((entry) => entry.rule === "scripts-may-not-import-apps"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("import-stratification law denies scripts importing apps under metroplat's own src/ nesting and raises one obligation", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-import-stratification-nested-"));
  try {
    mkdirSync(path.join(root, "src", "scripts"), { recursive: true });
    mkdirSync(path.join(root, "src", "apps"), { recursive: true });
    writeFileSync(path.join(root, "src", "scripts", "run.mts"), 'import "../apps/face.mjs";\nexport const run = true;\n');
    writeFileSync(path.join(root, "src", "apps", "face.mts"), "export const face = true;\n");
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const evaluation = evaluateSourceCodePolicies(topology);
    const ruling = evaluation.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.import-stratification-ruling"
      && candidate.from === "src/scripts/run.mts");
    assert.ok(ruling);
    assert.equal(ruling.importerStratum, "scripts");
    assert.equal(ruling.targetStratum, "apps");
    assert.equal(ruling.judgement, "active");
    assert.ok(ruling.fired.some((entry) => entry.rule === "scripts-may-not-import-apps"));

    const obligations = sourceCodePolicyObligations(evaluation).observations;
    const stratificationObligations = obligations.filter((observation) =>
      observation.boundary.role === "obligation"
      && observation.claim.cell.startsWith("task:import-stratification-"));
    assert.equal(stratificationObligations.length, 1);
    assert.ok(stratificationObligations.some((observation) =>
      /scripts-may-not-import-apps/u.test(observation.boundary.text)
      && /src\/scripts\/run\.mts/u.test(observation.boundary.text)
      && /src\/apps\/face\.mts/u.test(observation.boundary.text)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("import-stratification law raises no ruling when a stratum is unresolved", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-import-stratification-absurd-"));
  try {
    mkdirSync(path.join(root, "content"), { recursive: true });
    writeFileSync(path.join(root, "content", "index.mts"), 'import "./util.mjs";\nexport const index = true;\n');
    writeFileSync(path.join(root, "content", "util.mts"), "export const util = true;\n");
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["content"] });
    const withStratification = evaluateSourceCodePolicies(topology);
    const withoutStratification = evaluateSourceCodePolicies(topology, [localImportTargetPolicy]);
    const stratificationRuling = withStratification.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.import-stratification-ruling"
      && candidate.from === "content/index.mts");
    const localImportRuling = withStratification.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.local-import-ruling"
      && candidate.from === "content/index.mts");
    const baseline = withoutStratification.rulings.find((candidate) =>
      candidate.kind === "metroplat.monitoring.source-code.local-import-ruling"
      && candidate.from === "content/index.mts");
    assert.equal(stratificationRuling, undefined);
    assert.ok(localImportRuling);
    assert.equal(localImportRuling.judgement, "potential");
    assert.equal(localImportRuling.judgement, baseline.judgement);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("directed build-order policy uses the same FOUR reconciliation and work path", () => {
  const moduleEntry = (path, imports) => Object.freeze({ path, identity: `identity:${path}`, imports });
  const topology = Object.freeze({
    source: "source:cycle",
    observation: "observation:cycle",
    modules: Object.freeze([
      moduleEntry("a.mts", ["b.mts"]),
      moduleEntry("b.mts", ["a.mts"]),
    ]),
  });
  const active = evaluateSourceCodePolicies(topology);
  const buildRuling = active.rulings.find((ruling) =>
    ruling.kind === "metroplat.monitoring.source-code.module-build-order-ruling");
  assert.equal(buildRuling.judgement, "active");
  const activeWork = sourceCodePolicyObligations(active);
  assert.ok(activeWork.observations.some((observation) =>
    observation.boundary.role === "obligation"
    && observation.boundary.evidence.includes(`cell:${MODULE_BUILD_ORDER_RULING_CELL}`)
    && observation.boundary.evidence.includes("cycle-edge:a.mts->b.mts")
    && observation.boundary.evidence.includes("cycle-edge:b.mts->a.mts")));

  const allowCycles = sourceCodePolicy("architecture:allow-directed-cycles", [
    closureRule(
      "allow-directed-cycle",
      [{ cell: MODULE_BUILD_ORDER_ACYCLIC_CELL, atLeast: "active" }],
      { cell: MODULE_BUILD_ORDER_CONFORMS_CELL, reading: "potential" },
    ),
  ]);
  const stable = evaluateSourceCodePolicies(topology, [moduleBuildOrderPolicy, allowCycles]);
  const stableBuild = stable.rulings.find((ruling) =>
    ruling.kind === "metroplat.monitoring.source-code.module-build-order-ruling");
  assert.equal(stableBuild.judgement, "stable");
  assert.equal(stable.reconciliation.conflicts.length, 1);
  assert.ok(sourceCodePolicyObligations(stable).observations.some((observation) =>
    observation.boundary.evidence.some((entry) => entry.includes(MODULE_BUILD_ORDER_RULING_CELL))));

  assert.throws(() => sourceCodePolicy("architecture:cross-scope-rule", [
    closureRule(
      "cross-scope-rule",
      [{ cell: MODULE_BUILD_ORDER_ACYCLIC_CELL, atLeast: "potential" }],
      { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "potential" },
    ),
  ]), /cell module-build-order:acyclic is not in the finite carrier/u);
});

test("policy observation identity commits package-scale rulings without truncating them", () => {
  const imports = Object.freeze(Array.from({ length: 2_600 }, (_value, index) => `missing-${index}.mts`));
  const evaluation = evaluateSourceCodePolicies(Object.freeze({
    source: "source:large-policy-observation",
    observation: "observation:large-policy-observation",
    modules: Object.freeze([
      Object.freeze({ path: "entry.mts", identity: "identity:entry", imports }),
    ]),
  }));
  assert.equal(evaluation.rulings.length, imports.length + 1);
  assert.equal(evaluation.summary.active, imports.length);
  assert.equal(evaluation.summary.potential, 1);
  assert.equal(sourceCodePolicyPage(evaluation).totalRulings, imports.length + 1);
  assert.match(evaluation.observation, /^ni:\/\/\/sha-256;/u);
});

test("source topology becomes a predication relation and FOUR-valued policy rulings retain contradictions", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-source-policy-"));
  try {
    mkdirSync(path.join(root, "src", "directory"), { recursive: true });
    writeFileSync(path.join(root, "src", "entry.mts"), [
      'import "./present.mjs";',
      'import type { TypeOnly } from "./types.mjs";',
      'import type { ExternalType } from "external-types";',
      'import "./directory/index.mjs";',
      'import "./absent.mjs";',
      "export const entry = true;",
      "",
    ].join("\n"));
    writeFileSync(path.join(root, "src", "present.mts"), "export const present = true;\n");
    writeFileSync(path.join(root, "src", "directory", "index.mts"), "export const indexed = true;\n");

    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const entry = topology.modules.find((moduleEntry) => moduleEntry.path === "src/entry.mts");
    assert.deepEqual(entry.imports, [
      "src/absent.mts",
      "src/directory/index.mts",
      "src/present.mts",
    ]);
    assert.deepEqual(entry.typeImports, ["src/types.mts"]);
    assert.deepEqual(entry.externalTypeImports, ["external-types"]);

    const relation = moduleTopologyRelation(topology);
    assert.equal(relation.predication.cells.length, 6);
    assert.deepEqual(relation.measurement, {
      entities: 4,
      cells: 3,
      h0: 1,
      h1: 0,
      buildOrder: {
        kind: "metroplat.monitoring.source-code.module-build-order",
        tiers: [["src/directory/index.mts", "src/present.mts"], ["src/entry.mts"]],
      },
    });

    const defaults = evaluateSourceCodePolicies(topology);
    // 1 build-order + 3 local-import (2 potential, 1 active) + 3 import-stratification
    // (all potential: every edge here is src -> src, the lawful shape) — import
    // stratification is its own finite observation fiber, so it always
    // contributes a ruling once both strata resolve, independent of the
    // local-import target-present concern.
    assert.deepEqual(defaults.summary, { potential: 6, active: 1, stable: 0, absurd: 0 });
    assert.equal(defaults.reconciliation.regime, "scott");
    const page = sourceCodePolicyPage(defaults, { limit: 2 });
    assert.equal(page.totalRulings, 7);
    assert.equal(page.returned, 2);
    assert.equal(page.nextOffset, 2);
    assert.equal(page.rulings[0].kind, "metroplat.monitoring.source-code.module-build-order-ruling");
    assert.deepEqual(page.summary, defaults.summary);
    const defaultObligations = sourceCodePolicyObligations(defaults);
    assert.equal(defaultObligations.observations.length, 4);
    assert.ok(defaultObligations.observations.every((observation) => observation.claim.reading === "absurd"));
    assert.ok(defaultObligations.observations.every((observation) => observation.boundary.role === "obligation"));
    assert.ok(defaultObligations.observations.some((observation) =>
      /target is not an admitted source module/u.test(observation.boundary.text)));
    assert.equal(defaultObligations.observations.filter((observation) =>
      observation.boundary.evidence.includes("work-kind:evidence-gathering")).length, 0);
    const defaultWork = workItemObservationsOfRows(
      defaultObligations.observations.flatMap(claimSessionStatementRows),
    );
    assert.deepEqual(defaultWork.map(({ event }) => event), Array(4).fill("opened"));
    assert.deepEqual(defaultWork.slice(0, 3).map(({ item, parent, dependencies }) => ({ item, parent, dependencies })), [
      { item: SOURCE_CODE_NORMALIZATION_WORK.endeavor, parent: undefined, dependencies: [] },
      { item: SOURCE_CODE_NORMALIZATION_WORK.project, parent: SOURCE_CODE_NORMALIZATION_WORK.endeavor, dependencies: [] },
      { item: SOURCE_CODE_NORMALIZATION_WORK.carrierPlan, parent: SOURCE_CODE_NORMALIZATION_WORK.project, dependencies: [] },
    ]);
    const plannedTasks = defaultWork.filter(({ item }) => item.startsWith("task:"));
    assert.equal(plannedTasks.length, 1);
    assert.deepEqual(new Set(plannedTasks.map(({ parent }) => parent)), new Set([SOURCE_CODE_NORMALIZATION_WORK.carrierPlan]));
    const roadmap = workRoadmapOfObservations(defaultWork);
    assert.deepEqual(roadmap.milestones
      .filter((milestone) => milestone.parent === SOURCE_CODE_NORMALIZATION_WORK.project)
      .map(({ height, scopes }) => ({ height, scopes })), [
      { height: 0, scopes: [SOURCE_CODE_NORMALIZATION_WORK.carrierPlan] },
    ]);
    assert.equal(roadmap.nodes.find(({ scope }) => scope === SOURCE_CODE_NORMALIZATION_WORK.carrierPlan).structural.state, "ready");

    const [policyOperation] = sourceCodePolicyOperations({ packageRoot: root });
    const handled = policyOperation.execute({ sourceDirs: ["src"], limit: 1 }, {});
    const operationPage = handled.value;
    assert.equal(operationPage.kind, "metroplat.monitoring.source-code.policy");
    assert.equal(operationPage.totalRulings, 7);
    assert.equal(operationPage.returned, 1);
    assert.deepEqual(
      handled.artifacts.map((artifact) => artifact.ref).sort(),
      [
        localImportTargetPolicy.identity,
        moduleBuildOrderPolicy.identity,
        normalizationCutPolicy.identity,
        importStratificationPolicy.identity,
        topology.source,
        ...topology.modules.map((moduleEntry) => moduleEntry.identity),
      ].sort(),
    );

    const opposing = sourceCodePolicy("local-imports-are-forbidden", [
      closureRule(
        "forbid-present-local-import",
        [{ cell: LOCAL_IMPORT_TARGET_PRESENT_CELL, atLeast: "potential" }],
        { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "active" },
      ),
    ]);
    const stable = evaluateSourceCodePolicies(topology, [
      // Keep defaults explicit: supplied policies replace, rather than silently
      // extending, the caller's policy set.
      sourceCodePolicy("allow-present-local-import", [
        closureRule(
          "allow-present-local-import",
          [{ cell: LOCAL_IMPORT_TARGET_PRESENT_CELL, atLeast: "potential" }],
          { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "potential" },
        ),
        closureRule(
          "deny-absent-local-import",
          [{ cell: LOCAL_IMPORT_TARGET_PRESENT_CELL, atLeast: "active" }],
          { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "active" },
        ),
      ]),
      opposing,
    ]);
    // This override supplies no rule on the import-stratification conforms
    // cell, so its 3 rulings (one per edge) join the 1 absurd build-order
    // ruling rather than the local-import contest.
    assert.deepEqual(stable.summary, { potential: 0, active: 1, stable: 2, absurd: 4 });
    assert.equal(stable.reconciliation.regime, "transfinite");
    assert.equal(stable.reconciliation.conflicts.length, 2);
    assert.ok(stable.rulings.filter((ruling) => ruling.targetPresent)
      .every((ruling) => ruling.judgement === "stable"));
    const stableObligations = sourceCodePolicyObligations(stable);
    assert.equal(stableObligations.observations.length, 6);
    assert.equal(new Set(stableObligations.observations.map((observation) => observation.claim.cell)).size, 6);
    assert.ok(stableObligations.observations.some((observation) =>
      observation.boundary.evidence.some((entry) => entry.includes("classification:"))));

    const absurd = evaluateSourceCodePolicies(topology, [sourceCodePolicy("no-rules", [])]);
    // The override policy rules on neither cell, so the 3 import-stratification
    // rulings join the 1 build-order + 3 local-import rulings, all absurd.
    assert.deepEqual(absurd.summary, { absurd: 7, potential: 0, active: 0, stable: 0 });
    assert.equal(sourceCodePolicyObligations(absurd).observations.length, 0);

    writeFileSync(path.join(root, "src", "entry.mts"), [
      'import "./present.mjs";',
      'import "./directory/index.mjs";',
      "export const entry = true;",
      "",
    ].join("\n"));
    const potential = evaluateSourceCodePolicies(readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] }));
    // 1 build-order + 2 local-import + 2 import-stratification, all potential.
    assert.deepEqual(potential.summary, { absurd: 0, potential: 5, active: 0, stable: 0 });
    assert.equal(sourceCodePolicyObligations(potential).observations.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("governed source monitoring preserves exact source artifacts after the filesystem changes", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-source-artifact-replay-"));
  const at = "2026-07-12T12:00:00.000Z";
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    const sourcePath = path.join(root, "src", "module.mts");
    const original = "export const preserved = true;\n";
    writeFileSync(sourcePath, original);
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const identity = topology.modules[0].identity;
    const [policyOperation] = sourceCodePolicyOperations({ packageRoot: root, dataRoot: root, now: () => at });
    const call = invocation({
      request: "source-artifact-replay",
      subject: "subject:test",
      operation: policyOperation.ref,
      verb: policyOperation.verb,
      resource: root,
      input: { sourceDirs: ["src"] },
      caller: { transport: "test" },
      observedAt: at,
    });
    const receipt = await dispatch({
      catalog: createOperationCatalog([policyOperation]),
      witness: journalRpcWitness(root),
      authorize: authorizationFromStanding(new Map([[policyOperation.ref, "potential"]])),
      now: () => at,
    }, call);
    assert.equal(receipt.ok, true);

    writeFileSync(sourcePath, "export const replaced = true;\n");
    rmSync(sourcePath);
    const artifact = journal.readArtifact(root, identity);
    assert.ok(artifact);
    assert.equal(JSON.parse(artifact.canonicalText), original);
    assert.equal(artifactId(JSON.parse(artifact.canonicalText)), identity);
    const manifestArtifact = journal.readArtifact(root, receipt.value.source);
    assert.ok(manifestArtifact);
    const manifest = JSON.parse(manifestArtifact.canonicalText);
    assert.equal(artifactId(manifest), receipt.value.source);
    assert.deepEqual(manifest.files, [{ path: "src/module.mts", content: identity }]);
    for (const policy of DEFAULT_SOURCE_CODE_POLICIES) {
      const policyArtifact = journal.readArtifact(root, policy.identity);
      assert.ok(policyArtifact);
      const policyMaterial = JSON.parse(policyArtifact.canonicalText);
      assert.equal(artifactId(policyMaterial), policy.identity);
      assert.equal(policyMaterial.name, policy.name);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source policy admission retains one normalization enclosure while findings open, discharge, and reopen", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-policy-lifecycle-"));
  let tick = 0;
  const now = () => `2026-07-12T13:${String(tick++).padStart(2, "0")}:00.000Z`;
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    const entry = path.join(root, "src", "entry.mts");
    const target = path.join(root, "src", "target.mts");
    writeFileSync(entry, 'import "./target.mjs";\nexport const entry = true;\n');
    const operations = sourceCodePolicyOperations({ packageRoot: root, dataRoot: root, now });
    const admitOperation = operations.find((operation) => operation.verb === "source-code-policy-obligations-admit");
    assert.ok(admitOperation);
    const witness = journalRpcWitness(root);
    const runtime = {
      catalog: createOperationCatalog([admitOperation]),
      witness,
      authorize: authorizationFromStanding(new Map([[admitOperation.ref, "potential"]])),
      now,
    };
    let request = 0;
    const run = async () => dispatch(runtime, invocation({
      request: `policy-lifecycle:${request++}`,
      subject: "subject:test",
      operation: admitOperation.ref,
      verb: admitOperation.verb,
      resource: root,
      input: { sourceDirs: ["src"] },
      caller: { transport: "test" },
      observedAt: now(),
    }));
    const openObligations = () => {
      const collector = workLedgerObligationCollector();
      journal.scanCausalTerritory(root, collector, (state, row) => {
        state.push(row);
        return state;
      });
      return collector.read().filter((obligation) => obligation.evidence.includes("producer:source-code-policy"));
    };

    const opened = await run();
    assert.equal(opened.ok, true);
    assert.deepEqual(
      { opened: opened.value.opened, discharged: opened.value.discharged, appended: opened.value.appended },
      { opened: 4, discharged: 0, appended: 4 },
    );
    const stableCell = openObligations().find((obligation) =>
      /target is not an admitted source module/u.test(obligation.text)).cell;

    const unchanged = await run();
    assert.deepEqual(
      { opened: unchanged.value.opened, discharged: unchanged.value.discharged, appended: unchanged.value.appended },
      { opened: 0, discharged: 0, appended: 0 },
    );
    assert.equal(openObligations().length, 4);
    const openItems = new Set(openObligations().map(({ item }) => item));
    assert.ok(Object.values(SOURCE_CODE_NORMALIZATION_WORK).every((item) => openItems.has(item)));

    writeFileSync(target, "export const target = true;\n");
    const discharged = await run();
    assert.deepEqual(
      { opened: discharged.value.opened, discharged: discharged.value.discharged, appended: discharged.value.appended },
      { opened: 0, discharged: 4, appended: 4 },
    );
    assert.equal(openObligations().length, 0);

    rmSync(target);
    const reopened = await run();
    assert.deepEqual(
      { opened: reopened.value.opened, discharged: reopened.value.discharged, appended: reopened.value.appended },
      { opened: 4, discharged: 0, appended: 4 },
    );
    assert.equal(openObligations().find((obligation) =>
      /target is not an admitted source module/u.test(obligation.text)).cell, stableCell);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("topology and cohesion pages preserve complete aggregates while bounding detail", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-source-monitor-page-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    for (let index = 0; index < 12; index += 1) {
      writeFileSync(path.join(root, "src", `module-${String(index).padStart(2, "0")}.mts`), [
        ...(index === 7 ? ["/** Existing value summary. */"] : []),
        `export const value${index} = ${index};`,
        `export const next${index} = value${index} + 1;`,
        `export const pair${index} = [value${index}, next${index}];`,
        `export const text${index} = String(value${index});`,
        `export const object${index} = { value${index}, next${index} };`,
        "",
      ].join("\n"));
    }
    const topology = readModuleTopology(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const topologyFirst = moduleTopologyPage(topology, { limit: 5 });
    const topologySecond = moduleTopologyPage(topology, { offset: topologyFirst.nextOffset, limit: 5, includeSymbols: true });
    assert.equal(topologyFirst.totalModules, 12);
    assert.equal(topologyFirst.returned, 5);
    assert.equal(topologyFirst.nextOffset, 5);
    assert.equal(topologyFirst.modules[0].symbols, undefined);
    assert.equal(topology.modules[5].symbols[0].documentation, undefined);
    assert.equal(topologySecond.offset, 5);
    assert.ok(topologySecond.modules.every((moduleEntry) => moduleEntry.symbols.length === 5));
    assert.ok(topologySecond.modules.every((moduleEntry) => moduleEntry.symbols.every((symbol) => symbol.exported)));
    assert.ok(topologySecond.modules.every((moduleEntry) => moduleEntry.symbols.every((symbol) =>
      symbol.documentation.source.startsWith("ni:///sha-256;")
      && symbol.documentation.artifact.startsWith("ni:///sha-256;")
      && symbol.documentation.witness.startsWith("ni:///sha-256;")
      && symbol.documentation.jsdoc.includes("@remarks")
      && symbol.documentation.lossProfile.kind === "lossy")));

    const documentedModule = topologySecond.modules[0];
    const documentedSymbol = documentedModule.symbols[0];
    assert.equal(nodeBeingDocumentationProjectionIsValid(documentedSymbol.documentation, {
      declaration: nodeDeclarationReference(documentedModule.path, documentedSymbol.name),
      declarationKind: documentedSymbol.kind,
      exported: documentedSymbol.exported,
      ...(documentedSymbol.summary === undefined ? {} : { sourceSummary: documentedSymbol.summary }),
      being: documentedSymbol.being,
    }), true);
    const articulation = articulate(documentedSymbol.documentation.text);
    assert.ok(articulation.spans.filter((span) => span.tier === "sentence").length >= 4);

    const focused = moduleTopologyPage(topology, {
      paths: ["src/module-03.mts", "src/module-07.mts"],
      includeSymbols: true,
    });
    assert.equal(focused.totalModules, 12);
    assert.equal(focused.matchedModules, 2);
    assert.deepEqual(focused.modules.map((moduleEntry) => moduleEntry.path), ["src/module-03.mts", "src/module-07.mts"]);
    assert.ok(focused.modules.every((moduleEntry) => Array.isArray(moduleEntry.importedBy)));
    const preservedSummary = focused.modules[1].symbols.find((symbol) => symbol.name === "value7");
    assert.equal(preservedSummary.documentation.sourceSummary, "Existing value summary.");
    assert.ok(preservedSummary.documentation.jsdoc.includes(" * Existing value summary."));

    const directoryFocused = moduleTopologyPage(topology, { paths: ["src"], limit: 50 });
    assert.equal(directoryFocused.matchedModules, 12);
    assert.deepEqual(directoryFocused.modules.map((moduleEntry) => moduleEntry.path),
      topology.modules.map((moduleEntry) => moduleEntry.path));

    const cohesion = readModuleCohesion(root, { ...filesystemEffects, sourceDirs: ["src"] });
    const cohesionPage = moduleCohesionPage(cohesion, { limit: 4 });
    assert.equal(topology.source, cohesion.source);
    assert.notEqual(topology.observation, cohesion.observation);
    assert.equal(topologyFirst.source, topology.source);
    assert.equal(topologyFirst.observation, topology.observation);
    assert.deepEqual(topologyFirst.layoutConvention, topology.layoutConvention);
    assert.equal(cohesionPage.files, cohesion.files);
    assert.equal(cohesionPage.source, cohesion.source);
    assert.equal(cohesionPage.observation, cohesion.observation);
    assert.deepEqual(cohesionPage.valuation, cohesion.valuation);
    assert.equal("obstructedFiles" in cohesionPage, false);
    assert.ok(cohesionPage.modules.every((moduleEntry) => !("obstructed" in moduleEntry)));
    assert.equal(cohesionPage.totalModules, cohesion.modules.length);
    assert.equal(cohesionPage.returned, 4);
    assert.ok(cohesionPage.modules.every((moduleEntry) =>
      moduleEntry.valuation.regime.kind === "ordinal.closure.regime.finite"
      && moduleEntry.valuation.ordinal.kind === "ordinal.closure.ordinal.successor"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("MetroPlat can content-address its own default topology monitor readout", () => {
  const topology = readModuleTopology(process.cwd(), filesystemEffects);
  const page = moduleTopologyPage(topology);
  const bytes = Buffer.byteLength(canonicalJson(page), "utf8");
  const sourceCodeModules = topology.modules.filter((moduleEntry) =>
    moduleEntry.path.startsWith("src/monitoring/source-code/"));
  const sourceCodeDeclarations = sourceCodeModules.flatMap((moduleEntry) =>
    moduleEntry.symbols.map((symbol) => `${moduleEntry.path}#${symbol.name}`));
  const sourceCodeAnchors = topology.subjectAnchors.filter((anchor) =>
    anchor.subject === "source-code");
  const forbiddenRecordDependencies = [
    "src/journal/",
    "src/monitoring/",
    "src/search/",
    "src/lib/addressing/",
    "src/lib/capability/",
    "src/lib/fixpoint/",
    "src/lib/identity/",
    "src/lib/logic/",
    "src/lib/math/",
    "src/lib/rendering/",
  ];
  const recordBoundaryViolations = topology.modules
    .filter((moduleEntry) => moduleEntry.path.startsWith("src/lib/records/"))
    .flatMap((moduleEntry) => moduleEntry.imports
      .filter((target) => forbiddenRecordDependencies.some((prefix) => target.startsWith(prefix)))
      .map((target) => `${moduleEntry.path} -> ${target}`));
  assert.equal(page.files, topology.files);
  assert.equal(page.totalModules, topology.modules.length);
  assert.ok(page.totalModules > page.returned);
  assert.deepEqual(
    [...new Set(sourceCodeAnchors.flatMap((anchor) => anchor.declarations))].sort(),
    [...sourceCodeDeclarations].sort(),
    "the source-code subsystem must state its subject for every declaration it asks MetroPlat to normalize",
  );
  assert.equal(sourceCodeModules.reduce((total, moduleEntry) => total + moduleEntry.subjectUnanchoredSymbols, 0), 0);
  assert.equal(sourceCodeModules.reduce((total, moduleEntry) => total + moduleEntry.multiplySubjectAnchoredSymbols, 0), 1);
  const stableSourceCodePlacements = sourceCodeModules.flatMap((moduleEntry) => moduleEntry.symbols
    .filter((symbol) => symbol.placement.contextStatus === "stable")
    .map((symbol) => `${moduleEntry.path}#${symbol.name}`));
  assert.deepEqual(stableSourceCodePlacements, [
    "src/monitoring/source-code/topology/schema.mts#ModuleTopologyRead",
  ], "the pre-existing monitoring/source-code subject contradiction must remain explicit");
  assert.deepEqual(recordBoundaryViolations, [], "records must remain plain carriers, not a second owner of later responsibilities");
  assert.ok(bytes < CANONICAL_ARTIFACT_LIMIT, `${bytes} must remain below the canonical artifact envelope`);
});

test("MetroPlat can content-address its own valued cohesion monitor readout", () => {
  const cohesion = readModuleCohesion(process.cwd(), filesystemEffects);
  const page = moduleCohesionPage(cohesion);
  const bytes = Buffer.byteLength(canonicalJson(page), "utf8");
  assert.equal(page.files, cohesion.files);
  assert.equal(page.totalModules, cohesion.modules.length);
  const summed = cohesion.modules.reduce(
    (record, moduleEntry) => addEvidenceRecords(record, moduleEntry.valuation.record),
    evidenceRecord(0, 0),
  );
  assert.deepEqual(page.valuation.record, summed);
  assert.deepEqual(page.valuation.reading, readingOfEvidenceRecord(summed));
  assert.ok(page.modules.some((moduleEntry) => moduleEntry.valuation.reading === "stable"));
  assert.ok(bytes < CANONICAL_ARTIFACT_LIMIT, `${bytes} must remain below the canonical artifact envelope`);
});

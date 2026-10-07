/**
 * Live schema-conformance monitoring over bounded, provenanced runtime samples.
 *
 * Provider integrations own transcript discovery and decoding. This monitor
 * selects the contracts to observe, gathers those provider samples, and folds
 * them through the pure per-contract verdict in `lib/schema/conformance`.
 */
import { conformanceOf } from "@red-cup-engineering/relating/carriers/schema";
import { schemaConformanceCutContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/schema-conformance/schema";
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";

import { sampleClaudeClaimSessionObservations } from "@red-cup-engineering/feltos/agents/sessions/claude-code/service";
import { sampleClaudeGluedClaimSessions } from "@red-cup-engineering/feltos/agents/sessions/claude-code/fleet/service";
import { sampleCodexClaimSessionObservations } from "@red-cup-engineering/feltos/agents/sessions/codex/service";
import { claimSessionObservationContract, gluedClaimSessionsContract } from "@red-cup-engineering/relating/running/session-schema";

const CLAIM_SESSION_OBSERVATION_ID = claimSessionObservationContract.id;
const GLUED_CLAIM_SESSIONS_ID = gluedClaimSessionsContract.id;
const PER_SCHEMA_SAMPLE_LIMIT = 5;
const MONITORED_SCHEMAS = Object.freeze([
  claimSessionObservationContract,
  gluedClaimSessionsContract,
]);

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function todayIso(binding) {
  const value = binding.now();
  return value.slice(0, 10);
}

function pushSample(
  bySampledId,
  schemaAddress,
  sample,
) {
  const existing = bySampledId.get(schemaAddress) ?? [];
  if (existing.length >= PER_SCHEMA_SAMPLE_LIMIT) return;
  existing.push(sample);
  bySampledId.set(schemaAddress, existing);
}

/** Read the schema-conformance cut over contracts with bounded runtime samples. */
export async function readSchemaConformance(
  dataRoot,
  date,
  options = {},
) {
  void dataRoot;
  const registered = MONITORED_SCHEMAS;
  const evidence = [`monitored:${registered.length}`];
  const samplesBySchemaAddress = new Map();

  let claimSessionSampled = 0;
  let claimSessionOf = 0;
  if (options.claudeSessionRoot !== undefined) {
    const claude = await sampleClaudeClaimSessionObservations(options.claudeSessionRoot, options);
    claimSessionOf += claude.of;
    for (const sample of claude.samples) {
      pushSample(samplesBySchemaAddress, CLAIM_SESSION_OBSERVATION_ID, sample);
      claimSessionSampled += 1;
    }
  }
  if (options.codexSessionRoot !== undefined) {
    const codex = await sampleCodexClaimSessionObservations(options.codexSessionRoot, options);
    claimSessionOf += codex.of;
    for (const sample of codex.samples) {
      pushSample(samplesBySchemaAddress, CLAIM_SESSION_OBSERVATION_ID, sample);
      claimSessionSampled += 1;
    }
  }
  evidence.push(`claim-session-rows:${claimSessionSampled}/${claimSessionOf}`);

  let liveGlueChecked = false;
  if (options.claudeSessionRoot !== undefined) {
    try {
      const glued = await sampleClaudeGluedClaimSessions(options.claudeSessionRoot, options);
      pushSample(samplesBySchemaAddress, GLUED_CLAIM_SESSIONS_ID, glued);
      liveGlueChecked = true;
    } catch (error) {
      evidence.push(`live-glue-error:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  evidence.push(`live-glue:${liveGlueChecked ? "checked" : "unchecked"}`);

  const verdicts = registered.map((schemaContract) => conformanceOf(schemaContract, samplesBySchemaAddress.get(schemaContract.id) ?? []));
  const conformant = verdicts.filter((verdict) => verdict.classification === "conformant").length;
  const drifted = verdicts.filter((verdict) => verdict.classification === "drifted").length;
  const unexercised = verdicts.filter((verdict) => verdict.classification === "unexercised").length;
  evidence.push(`verdicts:conformant=${conformant} drifted=${drifted} unexercised=${unexercised}`);

  return schemaConformanceCutContract.assert(Object.freeze({
    kind: "metroplat.schema-conformance.read",
    operation: "read-schema-conformance",
    date,
    monitoredSchemas: registered.length,
    conformant,
    drifted,
    unexercised,
    verdicts: Object.freeze(verdicts),
    claimSessionRows: Object.freeze({ sampled: claimSessionSampled, of: claimSessionOf }),
    liveGlue: Object.freeze({ checked: liveGlueChecked }),
    evidence: Object.freeze(evidence),
  }));
}

export function schemaConformanceOperations(binding) {
  return Object.freeze([
    operation({
      verb: "schema-conformance",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read live schema conformance against bounded service material.",
      description: "Domain: { date? }. Uses the service binding dataRoot and configured agent session roots.",
      codomain: schemaConformanceCutContract,
      run: async (input) => {
        const record = inputRecord(input);
        const date = typeof record["date"] === "string" ? record["date"] : todayIso(binding);
        return await readSchemaConformance(binding.dataRoot, date, {
          ...binding,
          ...(binding.claudeSessionRoot === undefined ? {} : { claudeSessionRoot: binding.claudeSessionRoot }),
          ...(binding.codexSessionRoot === undefined ? {} : { codexSessionRoot: binding.codexSessionRoot }),
        });
      },
    }),
  ]);
}

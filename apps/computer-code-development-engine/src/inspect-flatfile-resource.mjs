import {
  admitFlatfileInspectionRequest,
  assembleFlatfileInspection,
  composeFlatfileInspectionEvidence,
} from "@red-cup-engineering/flatfile-resource-graph-service/inspection";
import { inspectPackageResource } from "./operations.mjs";

/**
 * Inspects one immutable resource against admitted flatfile contracts and supplied provider outcomes.
 * The contract inspection is this engine's operation; provider composition and admission are the
 * flatfile engine's pure laws, composed here.
 * @param {{fernPath: string, resource: {path: string, content: string}, observations: readonly {provider: string, outcome: unknown}[]}} input A serializable graph path, resource, and already-acquired observations.
 * @returns {Promise<{inspection: object, composition: object, occurrences: readonly object[]}>} Contract inspection plus selected evidence projections.
 * @throws {Error} When input, provider outcomes, identities, or selected resource graphs are invalid.
 */
export async function inspectFlatfileResourceWithProviders(input) {
  const snapshot = admitFlatfileInspectionRequest(input);
  const [inspection, evidence] = await Promise.all([
    inspectPackageResource({ fernPath: snapshot.fernPath, resource: snapshot.resource }),
    composeFlatfileInspectionEvidence(snapshot),
  ]);
  return assembleFlatfileInspection(inspection, evidence);
}

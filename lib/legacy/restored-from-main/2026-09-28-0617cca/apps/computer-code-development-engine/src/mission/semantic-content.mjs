import { EMPTY_WITNESS_ROOT, admitNormalizedSemanticContent, identifyNormalizedSemanticContent } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/runtime";
import { jsonToTerm, termToJson } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/json-codec";
import { inferTy } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/typing";

export const OPERATION_KIND = "software-mission-execution.operation";

export function identifyOperation(value) {
  const term = jsonToTerm(value), semanticType = inferTy([], term);
  if (semanticType === null) throw new TypeError("software mission operation did not derive an SEN type");
  return identifyNormalizedSemanticContent({ objectKind: OPERATION_KIND, semanticType, term, witnessRoot: EMPTY_WITNESS_ROOT });
}

export function operationFromSemanticBytes(bytes) {
  const admitted = admitNormalizedSemanticContent(bytes);
  if (admitted.envelope.objectKind !== OPERATION_KIND) throw new TypeError("software mission operation has the wrong semantic kind");
  return termToJson(admitted.envelope.settledBody);
}

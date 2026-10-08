// flatfile-inspection-verbs — the inspect-resource verb as a plain verbs module for
// computer-system-engine's generic stdio verb server
// (`--verbs @red-cup-engineering/computer-code-development-engine/flatfile-inspection-verbs`).
// The verb is code: it runs this engine's package-resource inspection beside the flatfile
// engine's provider composition. The request/response schemas are the flatfile engine's.
import { REFUSAL_SCHEMA } from "@red-cup-engineering/computer-data-services-section/operation-refusal-schema";
import {
  inspectFlatfileResourceInputSchema,
  inspectFlatfileResourceOutputSchema,
} from "@red-cup-engineering/flatfile-resource-graph-service/inspection";
import { inspectFlatfileResourceWithProviders } from "../src/inspect-flatfile-resource.mjs";

// FeltOS owns Node-MUD flatfile inspection; a caller only transports the admitted request across
// its own process boundary.
function inspectResource(input) {
  return inspectFlatfileResourceWithProviders(input);
}
inspectResource.spec = {
  args: inspectFlatfileResourceInputSchema,
  returns: inspectFlatfileResourceOutputSchema,
  refusal: REFUSAL_SCHEMA,
};
inspectResource.effects = ["filesystem:read"];

export { inspectResource as "inspect-resource" };

/** Agent doctrine model. */
import { suitForCell } from "@red-cup-engineering/feltos/claims/context";

const DEFAULT_DOCTRINE_QUERY = "what may be built here";
const DEFAULT_DOCTRINE_QUERY_CELL = "doctrine:agent-orientation";
const DEFAULT_DOCTRINE_BUDGET = 4000;
const DEFAULT_DOCTRINE_SECTION_CHARS = 1800;

function materialText(material, maxSectionChars) {
  const header = [
    `path: ${material.path}`,
    ...(material.sourceRoot === undefined ? [] : [`source-root: ${material.sourceRoot}`]),
    ...(material.at === undefined ? [] : [`at: ${material.at}`]),
  ].join("\n");
  const body = material.text.length <= maxSectionChars
    ? material.text
    : `${material.text.slice(0, maxSectionChars)}\n\n[truncated:${material.text.length - maxSectionChars}]`;
  return `${header}\n\n${body}`;
}

export function agentDoctrineSuit(
  materials,
  options = {},
) {
  const query = options.query ?? DEFAULT_DOCTRINE_QUERY;
  const queryCell = options.queryCell ?? DEFAULT_DOCTRINE_QUERY_CELL;
  const maxSectionChars = options.maxSectionChars ?? DEFAULT_DOCTRINE_SECTION_CHARS;
  const inputs = materials.map((material) => Object.freeze({
    cell: `doctrine:${material.path}`,
    kind: "content-document",
    text: materialText(material, maxSectionChars),
    ...(material.sourceRoot === undefined ? {} : { source: material.sourceRoot }),
    ...(material.reading === undefined ? {} : { reading: material.reading }),
    evidence: Object.freeze([`cell:${queryCell}`, `path:${material.path}`]),
    ...(material.at === undefined ? {} : { at: material.at }),
  }));
  const suit = suitForCell(inputs, { cell: queryCell, text: query }, { budget: options.budget ?? DEFAULT_DOCTRINE_BUDGET });
  const omitted = suit.omitted.reduce((total, entry) => total + entry.count, 0);
  const bytes = materials.reduce((total, material) => total + (material.bytes ?? material.text.length), 0);
  return Object.freeze({
    kind: "metroplat.agent.doctrine-suit",
    query,
    queryCell,
    coverage: Object.freeze({
      included: suit.sections.length,
      omitted,
      denominator: Object.freeze({
        documents: materials.length,
        bytes,
      }),
    }),
    suit,
    evidence: Object.freeze([
      `documents:${materials.length}`,
      `bytes:${bytes}`,
      `included:${suit.sections.length}`,
      `omitted:${omitted}`,
    ]),
  });
}

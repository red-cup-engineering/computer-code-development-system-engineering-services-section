/**
 * @packageDocumentation
 *
 * monitoring/source-code/lexicon/fold - the ruled lexicon as a journal fold.
 *
 * The lexicon's storage is the journal, never a config file and never a
 * session's memory. Rulings combine through the canonical FOUR knowledge join;
 * incompatible ratified replacements remain contested semantic evidence.
 *
 * @metroplatSubject source-code
 */
import { journal } from "@red-cup-engineering/computer-system-engine/journal/journal";
import { knowledgeJoinReading, readingAs } from "@red-cup-engineering/computer-data-services-section/four";


const LEXICON_TOKEN_PREFIX = "lexicon:";
const CHARGE_NAMES = new Set(["unknown", "held", "denied", "contested"]);

function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function markValue(node) {
  const record = asRecord(node);
  const mark = asRecord(record?.["mark"]);
  const value = mark?.["value"];
  return typeof value === "string" ? value : undefined;
}

/** Read one admitted claim row's lexicon ruling, or undefined for other rows. */
function rulingOfRowValue(value) {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const reading = record["reading"];
  if (typeof reading !== "string" || !CHARGE_NAMES.has(reading)) return undefined;
  const cell = asRecord(record["cell"]);
  if (cell === undefined) return undefined;
  const token = markValue(cell["subject"]);
  if (token === undefined || !token.startsWith(LEXICON_TOKEN_PREFIX)) return undefined;
  const word = token.slice(LEXICON_TOKEN_PREFIX.length);
  if (word.length === 0) return undefined;
  const claimText = markValue(asRecord(cell["predicate"])?.["claim"]) ?? markValue(cell["predicate"]);
  let replacement;
  let note;
  if (claimText !== undefined) {
    try {
      const body = asRecord(JSON.parse(claimText));
      replacement = typeof body?.["replacement"] === "string" ? body["replacement"] : undefined;
      note = typeof body?.["note"] === "string" ? body["note"] : undefined;
    } catch {
      note = claimText;
    }
  }
  return Object.freeze({
    word,
    ruling: reading,
    ...(replacement === undefined ? {} : { replacement }),
    ...(note === undefined ? {} : { note }),
  });
}

/**
 * Fold admitted rulings to one entry per word. Evidence readings use the FOUR
 * knowledge join: unknown contributes no pole, held plus denied is contested,
 * and contested remains absorbing. Distinct replacements are themselves
 * incompatible claims and therefore force a contested result.
 */
export function lexiconFromRulings(rulings) {
  const byWord = new Map();
  for (const ruling of rulings) {
    const existing = byWord.get(ruling.word);
    if (existing === undefined) byWord.set(ruling.word, [ruling]);
    else existing.push(ruling);
  }
  const entries = [];
  for (const word of [...byWord.keys()].sort()) {
    const readings = byWord.get(word);
    const replacements = new Set(readings.flatMap((reading) =>
      reading.replacement === undefined ? [] : [reading.replacement]));
    const joined = readingAs("extremal", (readings.reduce(
      (standing, reading) => knowledgeJoinReading(standing, (readingAs("knowledge", reading.ruling))),
      "absurd",
    )));
    const replacementConflict = replacements.size > 1;
    const first = readings[0];
    entries.push(Object.freeze({
      word,
      ruling: replacementConflict ? "contested" : joined,
      ...(replacements.size === 1 ? { replacement: [...replacements][0] } : {}),
      ...(replacementConflict
        ? { note: `${replacements.size} disagreeing replacements from ${readings.length} admitted claims` }
        : first.note === undefined ? {} : { note: first.note }),
    }));
  }
  return Object.freeze(entries);
}

/** Read the current ruled lexicon from every admitted lexicon claim. */
export function readLexicon(storeRoot)

 {
  const rulings = [];
  const folded = journal.scanTerritory(storeRoot, rulings, (readings, row) => {
    const ruling = rulingOfRowValue(row[2]);
    if (ruling !== undefined) readings.push(ruling);
    return readings;
  });
  return Object.freeze({ entries: lexiconFromRulings(rulings), rulings: rulings.length, logs: folded.feeds });
}

/**
 * @packageDocumentation
 *
 * monitoring/source-code/lexicon/service - ruled-lexicon divergence monitor.
 *
 * This service owns the measured side of a vocabulary migration: given lexicon entries
 * (a word, its ruling reading, and optionally the ratified replacement), it
 * counts each word's exact whole-word occurrences across one source root and
 * reports the per-file breakdown. It reuses the
 * monitoring/filesystem/file-census walk rather than traversing a second way,
 * and it only measures. Any source mutation remains outside this read-only
 * monitor and must enter through MetroPlat's governed effect path.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";

import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";

import { walkFileCensus } from "@red-cup-engineering/computer-code-development-engine/monitoring/filesystem/file-census/service";
import {
  lexiconCensusReadContract as lexiconCensusReadSchemaContract,
  lexiconCensusReadRequestContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/schema";
import { lexiconReadContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/schema";
import { readLexicon } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/fold";

export { lexiconFromRulings, readLexicon } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/fold";

const DEFAULT_EXTENSIONS = Object.freeze(["mts"]);
const DEFAULT_MAX_FILES_PER_WORD = 40;

function escapeRegExp(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isAlphanumeric(character) {
  return character !== undefined && /[A-Za-z0-9]/u.test(character);
}

function isUppercase(character) {
  return character !== undefined && /[A-Z]/u.test(character);
}

/** Find every occurrence of `word` as a lexical segment: standalone whole words,
 *  camelCase/PascalCase identifier segments (`RelationalMorphism`,
 *  `settlementMorphismKind`), snake/kebab segments, and their plain plurals.
 *  Substrings inside an unbroken lowercase run (`metamorphism`) do not count.
 *  Migration tooling and this census must share this matcher, or verification
 *  measures a different language than the authorized edit transforms. */
export function findLexiconSegments(text, word) {
  const pattern = new RegExp(escapeRegExp(word), "giu");
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const matched = match[0];
    const before = start > 0 ? text[start - 1] : undefined;
    const leftBoundary = !isAlphanumeric(before) || (isUppercase(matched[0]) && !isUppercase(before));
    if (!leftBoundary) continue;
    let length = matched.length;
    let after = text[start + length];
    if (after === "s" || after === "S") {
      const beyond = text[start + length + 1];
      if (!isAlphanumeric(beyond) || isUppercase(beyond)) {
        length += 1;
        after = beyond;
      }
    }
    const rightBoundary = !isAlphanumeric(after) || isUppercase(after);
    if (!rightBoundary) continue;
    matches.push(Object.freeze({ index: start, length }));
    pattern.lastIndex = start + length;
  }
  return Object.freeze(matches);
}

/** Count each lexicon entry's exact whole-word occurrences under one source root.
 *  Occurrence and file counts are exhaustive over the scanned extensions; only
 *  the per-file detail list is bounded by `maxFilesPerWord`. */
export function readLexiconCensus(
  root,
  entries,
  options,
) {
  const rootAbs = path.resolve(root);
  const extensions = new Set((options.extensions ?? DEFAULT_EXTENSIONS).map((extension) => extension.toLowerCase()));
  const maxFilesPerWord = options.maxFilesPerWord ?? DEFAULT_MAX_FILES_PER_WORD;
  const files = walkFileCensus(rootAbs, options).filter((file) => extensions.has(file.extension));

  const texts = [];
  for (const file of files) {
    let text;
    try {
      text = options.readFileBuffer(file.full).toString("utf8");
    } catch {
      continue;
    }
    texts.push({ relative: path.relative(rootAbs, file.full).split(path.sep).join("/"), text });
  }

  const entryReads = entries.map((entry) => {
    const perFileAll = [];
    let occurrences = 0;
    for (const { relative, text } of texts) {
      const count = findLexiconSegments(text, entry.word).length;
      if (count === 0) continue;
      occurrences += count;
      perFileAll.push(Object.freeze({ path: relative, occurrences: count }));
    }
    perFileAll.sort((left, right) => right.occurrences - left.occurrences || left.path.localeCompare(right.path));
    const truncated = perFileAll.length > maxFilesPerWord;
    return Object.freeze({
      word: entry.word,
      ruling: entry.ruling,
      ...(entry.replacement === undefined ? {} : { replacement: entry.replacement }),
      ...(entry.note === undefined ? {} : { note: entry.note }),
      files: perFileAll.length,
      occurrences,
      perFile: Object.freeze(truncated ? perFileAll.slice(0, maxFilesPerWord) : perFileAll),
      truncated,
    });
  });

  return lexiconCensusReadSchemaContract.assert(Object.freeze({
    kind: "metroplat.lexicon-census.read",
    operation: "read-lexicon-census",
    root: rootAbs,
    files: texts.length,
    entries: Object.freeze(entryReads),
  }), "Lexicon census read");
}

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

export function lexiconCensusOperations(binding) {
  return Object.freeze([
    operation({
      verb: "lexicon-census",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read a source root's ruled-lexicon divergence census.",
      description: "Domain: { root?, entries: [{word, ruling, replacement?, note?}], extensions?, maxFilesPerWord? }. Defaults root to the service binding dataRoot and extensions to [\"mts\"].",
      codomain: lexiconCensusReadSchemaContract,
      run: (input) => {
        const record = inputRecord(input);
        const entries = record["entries"] ?? [...readLexicon(binding.dataRoot).entries];
        const request = lexiconCensusReadRequestContract.assert(Object.freeze({
          kind: "metroplat.lexicon-census.read-request",
          root: typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.dataRoot,
          entries,
          ...(record["extensions"] === undefined ? {} : { extensions: record["extensions"] }),
          ...(record["maxFilesPerWord"] === undefined ? {} : { maxFilesPerWord: record["maxFilesPerWord"] }),
        }), "lexicon-census input");
        return readLexiconCensus(request.root, request.entries, {
          ...binding,
          ...(request.extensions === undefined ? {} : { extensions: request.extensions }),
          ...(request.maxFilesPerWord === undefined ? {} : { maxFilesPerWord: request.maxFilesPerWord }),
        });
      },
    }),
    operation({
      verb: "lexicon",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read the current ruled lexicon folded from the store's admitted lexicon claims.",
      description: "Domain: { root? } — the store root holding data/journals. Defaults to the service binding dataRoot. A ruling is admitted with token `lexicon:<word>`; evidence readings fold by FOUR knowledge join and incompatible replacements remain contested.",
      codomain: lexiconReadContract,
      run: (input) => {
        const record = inputRecord(input);
        const root = typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.dataRoot;
        const reading = readLexicon(root);
        return lexiconReadContract.assert(Object.freeze({
          kind: "metroplat.lexicon-census.lexicon",
          operation: "read-lexicon",
          root: path.resolve(root),
          logs: reading.logs,
          rulings: reading.rulings,
          entries: reading.entries,
        }), "Lexicon read");
      },
    }),
  ]);
}

export { lexiconCensusReadSchemaContract };

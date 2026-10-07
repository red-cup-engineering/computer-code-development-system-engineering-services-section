import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  lexiconFromRulings,
  readLexiconCensus,
  lexiconCensusOperations,
} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/lexicon/service";
import { defaultFilesystemBinding } from "@red-cup-engineering/computer-system-engine/rpc/binding";

test("ruled lexicon evidence folds through the FOUR knowledge join", () => {
  const entries = lexiconFromRulings([
    { word: "settlement", ruling: "unknown", replacement: "closure" },
    { word: "settlement", ruling: "held", replacement: "closure" },
    { word: "arena", ruling: "held", replacement: "game" },
    { word: "arena", ruling: "denied", replacement: "game" },
    { word: "dish", ruling: "held", replacement: "managed-element" },
    { word: "dish", ruling: "held", replacement: "settlement" },
  ]);

  assert.equal(entries.find((entry) => entry.word === "settlement")?.ruling, "held");
  assert.equal(entries.find((entry) => entry.word === "arena")?.ruling, "contested");
  assert.equal(entries.find((entry) => entry.word === "dish")?.ruling, "contested");
  assert.match(entries.find((entry) => entry.word === "dish")?.note ?? "", /disagreeing replacements/u);
});

test("lexicon monitoring counts source vocabulary without exposing a mutation operation", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-lexicon-monitor-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "sample.mts"), [
      "export const settlement = true;",
      "export const SettlementRecord = settlement;",
      "export const settlements = [settlement];",
      "export const unsettling = false;",
    ].join("\n"));

    const readout = readLexiconCensus(root, [{ word: "settlement", ruling: "held" }], defaultFilesystemBinding(root));
    assert.equal(readout.files, 1);
    assert.equal(readout.entries[0].occurrences, 5);
    assert.equal(readout.entries[0].perFile[0].path, "src/sample.mts");

    const binding = defaultFilesystemBinding(root, { packageRoot: root });
    assert.deepEqual(lexiconCensusOperations(binding).map((operation) => operation.verb), [
      "lexicon-census",
      "lexicon",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

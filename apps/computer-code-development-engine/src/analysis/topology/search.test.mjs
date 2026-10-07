import assert from "node:assert/strict";
import { test } from "node:test";

import { jsNodePackage } from "./jsnode-topology.mjs";
import { searchPackages } from "./search.mjs";

function pkg(name        , description        , tags                   , dependencies                    = []) {
  return jsNodePackage({
    name,
    version: "0.1.0",
    description,
    layer: "apps",
    exports: ["."],
    dependencies,
    tags,
  });
}

test("a multiword query matches a hyphenated package keyword and explains why", () => {
  const drew = pkg(
    "@red-cup-engineering/drew",
    "Directed Relation Entity Web",
    ["cell-graph", "predication"],
  );
  const opal = pkg("@red-cup-engineering/opal", "Knowledge workbench", [], [drew.name]);

  const matches = searchPackages([opal, drew], "cell graph");

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.package.name, drew.name);
  assert.equal(matches[0]?.field, "tag");
  assert.equal(matches[0]?.tag, "cell-graph");
  assert.deepEqual(matches[0]?.reasons, ['keyword "cell-graph" matches "cell graph"']);
  assert.deepEqual(matches[0]?.consumers, [opal.name]);
});

test("multiword description search requires every query term in one field", () => {
  const drew = pkg("@red-cup-engineering/drew", "Directed relation web over a shared graph carrier", []);
  const unrelated = pkg("@red-cup-engineering/cells", "Cell renderer", []);

  const strict = searchPackages([drew, unrelated], "relation graph");
  assert.deepEqual(strict.map((match) => match.package.name), [drew.name]);
  assert.equal(strict[0]?.field, "description");

  assert.equal(searchPackages([drew, unrelated], "quantum kettle").length, 0);
});

test("an admitted concept alias expands capability search without rewriting package metadata", () => {
  const drew = pkg("@red-cup-engineering/drew", "Directed Relation Entity Web", ["directed-relation"]);

  const matches = searchPackages([drew], "cell graph", {
    concepts: [{ term: "directed relation", aliases: ["cell graph"] }],
  });

  assert.equal(matches[0]?.package.name, drew.name);
  assert.equal(matches[0]?.field, "tag");
  assert.match(matches[0]?.reasons.join(" ") ?? "", /capability vocabulary expands/);
});

test("search reports consumer declarations and never mistakes source for delivery evidence", () => {
  const drew = pkg("@red-cup-engineering/drew", "Directed Relation Entity Web", ["cell-graph"]);
  const feltos = jsNodePackage({
    name: "@red-cup-engineering/feltos",
    version: "0.1.0",
    description: "Felt Operating System",
    layer: "apps",
    exports: ["."],
    dependencies: [drew.name],
    deps: [
      { name: drew.name, range: "0.1.0", kind: "runtime" },
      { name: "@red-cup-engineering/test-kit", range: "2.0.0", kind: "dev" },
    ],
  });

  const unassayed = searchPackages([drew, feltos], "cell graph")[0];
  assert.deepEqual(unassayed?.consumers, [feltos.name]);
  assert.deepEqual(unassayed?.consumerDeclarations, [{ package: feltos.name, kind: "runtime", range: "0.1.0" }]);
  assert.equal(unassayed?.paths.classification, "source-with-unassayed-delivery");
  assert.equal(unassayed?.paths.sourceOnly, null);

  const live = searchPackages([drew, feltos], "cell graph", {
    pathObservationsComplete: true,
    pathObservations: [
      { package: drew.name, kind: "published", locator: "https://registry.example/@red-cup-engineering/drew", version: "0.1.0" },
      { package: drew.name, kind: "installed", locator: "/srv/app/node_modules/@red-cup-engineering/drew", version: "0.1.0" },
      { package: drew.name, kind: "live", locator: "https://graph.example/mcp", version: "0.1.0" },
    ],
  })[0];
  assert.equal(live?.paths.classification, "source-with-live-path");
  assert.equal(live?.paths.sourceOnly, false);
  assert.equal(live?.paths.published.length, 1);
  assert.equal(live?.paths.installed.length, 1);
  assert.equal(live?.paths.live.length, 1);

  const sourceOnly = searchPackages([drew], "cell graph", { pathObservationsComplete: true })[0];
  assert.equal(sourceOnly?.paths.classification, "source-only");
  assert.equal(sourceOnly?.paths.sourceOnly, true);
});

test("a multiword query with no all-terms match falls back to ranking by terms matched anywhere", () => {
  const bibliography = pkg(
    "@red-cup-engineering/bibliography-engineering-services-section",
    "Engineering policy and operations for admitted Markdown bibliography carriers and their citation coverage.",
    ["citation"],
  );
  const unrelated = pkg("@red-cup-engineering/cells", "Cell renderer", []);

  const matches = searchPackages([bibliography, unrelated], "bibliography citation csl");
  assert.equal(matches.length, 1, "no field carries every term, so the fallback carries the one package that matches any of them");
  assert.equal(matches[0]?.package.name, bibliography.name);
  assert.equal(matches[0]?.field, "any-term");
  assert.equal(matches[0]?.matchedTermCount, 2);
  assert.deepEqual(matches[0]?.reasons, ["matches 2 of 3 terms"]);
});

test("an exact all-term match always outranks an any-term fallback match", () => {
  const drew = pkg("@red-cup-engineering/drew", "Directed relation web over a shared graph carrier", []);

  const matches = searchPackages([drew], "relation graph");

  assert.equal(matches[0]?.field, "description");
  assert.notEqual(matches[0]?.field, "any-term");
});

test("search reuses consumer declarations for duplicate package observations without mutating them", () => {
  const first = pkg("@red-cup-engineering/drew", "Directed Relation Entity Web", ["cell-graph"]);
  const second = pkg("@red-cup-engineering/drew", "Directed Relation Entity Web", ["cell-graph"]);
  const consumer = pkg("@red-cup-engineering/feltos", "Felt Operating System", [], [first.name]);

  const matches = searchPackages([first, second, consumer], "cell graph");

  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((match) => match.consumerDeclarations), [
    [{ package: consumer.name, kind: "runtime", range: "*" }],
    [{ package: consumer.name, kind: "runtime", range: "*" }],
  ]);
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  jsNodePackage,
  jsNodeWorkspace,
  induceWorkspaceTopology,
  consumptionUtterance,
  consumptionUtterances,
  functionTerm,
  typeTerm,
  packageTerm,
  usesFunctionPredicate,
  usesTypePredicate,
} from "./jsnode-topology.mjs";

describe("jsNodePackage", () => {
  it("produces a frozen carrier with correct fields", () => {
    const pkg = jsNodePackage({
      name: "@test/foo",
      version: "1.0.0",
      description: "test package",
      layer: "lib",
      exports: [".", "./util"],
      dependencies: ["@test/bar"],
    });
    assert.equal(pkg.kind, "jsnode.package");
    assert.equal(pkg.term, "jsnode.package.@test/foo");
    assert.equal(pkg.layer, "lib");
    assert.deepEqual([...pkg.exports], [".", "./util"]);
    assert.deepEqual([...pkg.dependencies], ["@test/bar"]);
    assert.ok(pkg.utterances.length > 0);
  });

  it("emits one in-layer utterance, one per export, one per dependency", () => {
    const pkg = jsNodePackage({
      name: "@test/foo",
      version: "1.0.0",
      description: "",
      layer: "apps",
      exports: [".", "./cli"],
      dependencies: ["@test/a", "@test/b"],
    });
    assert.equal(pkg.utterances.length, 1 + 2 + 2);
  });
});

describe("jsNodeWorkspace", () => {
  it("collects all package utterances", () => {
    const a = jsNodePackage({ name: "@t/a", version: "0.0.1", description: "", layer: "lib", exports: ["."], dependencies: [] });
    const b = jsNodePackage({ name: "@t/b", version: "0.0.1", description: "", layer: "lib", exports: ["."], dependencies: ["@t/a"] });
    const ws = jsNodeWorkspace("/repo", [a, b]);
    assert.equal(ws.packages.length, 2);
    assert.equal(ws.utterances.length, a.utterances.length + b.utterances.length);
  });
});

describe("consumptionUtterance", () => {
  // The load-bearing property: a consumption edge settles against the *same*
  // term the provider's export side mints — so supply and demand meet there.
  const subjectObject = (u                                         ) =>
    (u                                                                                  ).token.mark.value;
  const predicate = (u                                         ) =>
    (u                                                     ).claim.mark.value;

  it("a function edge points at the provider's functionTerm with uses-function", () => {
    const u = consumptionUtterance({ consumer: "@x/c", provider: "@x/p", kind: "function", name: "foo" });
    assert.equal(subjectObject(u).subject, packageTerm("@x/c"));
    assert.equal(subjectObject(u).object, functionTerm("@x/p", "foo"));
    assert.equal(predicate(u), usesFunctionPredicate());
  });

  it("a type edge points at the provider's typeTerm with uses-type", () => {
    const u = consumptionUtterance({ consumer: "@x/c", provider: "@x/p", kind: "type", name: "Bar" });
    assert.equal(subjectObject(u).object, typeTerm("@x/p", "Bar"));
    assert.equal(predicate(u), usesTypePredicate());
  });

  it("consumptionUtterances maps a list", () => {
    const us = consumptionUtterances([
      { consumer: "@x/c", provider: "@x/p", kind: "function", name: "foo" },
      { consumer: "@x/c", provider: "@x/p", kind: "package" },
    ]);
    assert.equal(us.length, 2);
  });
});

describe("induceWorkspaceTopology", () => {
  it("returns a carrier without throwing", () => {
    const pkg = jsNodePackage({ name: "@t/x", version: "0.0.1", description: "", layer: "lib", exports: ["."], dependencies: [] });
    const ws = jsNodeWorkspace("/repo", [pkg]);
    const carrier = induceWorkspaceTopology(ws);
    assert.ok(carrier !== null && typeof carrier === "object");
  });
});

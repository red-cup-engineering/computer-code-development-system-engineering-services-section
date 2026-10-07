import assert from "node:assert/strict";
import test from "node:test";
import { admitPackageModule } from "../src/package-module.mjs";

const module = {
  kind: "jsnode.package-module",
  version: 1,
  package: { name: "@red-cup-engineering/example", version: "1.2.3" },
  model: { kind: "lagoon.world", title: "Example" },
  behaviors: [{ id: "look", path: "scripts/look.mjs", exportName: "look", inputSchema: { type: "object" }, outputSchema: { type: "object" }, effect: "read" }],
  dependencies: [{ name: "@red-cup-engineering/feltos", version: "0.15.1" }],
};

test("a package module has a stable content receipt and does not execute its behaviors", () => {
  const first = admitPackageModule(module);
  const second = admitPackageModule({ ...module, model: { title: "Example", kind: "lagoon.world" } });
  assert.match(first.receipt.contentIdentity, /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u);
  assert.equal(first.receipt.contentIdentity, second.receipt.contentIdentity);
  assert.equal(first.behaviors[0].path, "scripts/look.mjs");
});

test("a package module refuses undeclared behavior and dependency boundaries", () => {
  assert.throws(() => admitPackageModule({ ...module, behaviors: [{ ...module.behaviors[0], path: "src/look.mjs" }] }), /scripts/);
  assert.throws(() => admitPackageModule({ ...module, dependencies: [{ name: "@red-cup-engineering/feltos", version: 1 }] }), /exact package versions/);
  assert.throws(() => admitPackageModule({ ...module, dependencies: [{ name: "@red-cup-engineering/feltos", version: "^0.15.1" }] }), /exact package versions/);
});

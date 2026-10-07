import { test } from "node:test";
import assert from "node:assert/strict";
import { packageCoordinate, JSNODE_ROLES, ROLE_LEXICON, roleConcept } from "./coordinate.mjs";

test("a scoped domain-role name splits into scope, domain, and role", () => {
  const c = packageCoordinate("@emsenn/meme-topology");
  assert.equal(c.scope, "@emsenn");
  assert.equal(c.local, "meme-topology");
  assert.equal(c.domain, "meme");
  assert.equal(c.role, "topology");
  assert.equal(c.qualifier, null);
});

test("a multi-segment domain keeps every pre-role segment as the domain", () => {
  const c = packageCoordinate("@emsenn/agent-fleet-algebra");
  assert.equal(c.domain, "agent-fleet");
  assert.equal(c.role, "algebra");
});

test("a segment trailing the role is captured as the qualifier", () => {
  const http = packageCoordinate("@emsenn/web-codecs-http");
  assert.equal(http.domain, "web");
  assert.equal(http.role, "codecs");
  assert.equal(http.qualifier, "http");

  const addr = packageCoordinate("@emsenn/meme-topology-addressing");
  assert.equal(addr.domain, "meme");
  assert.equal(addr.role, "topology");
  assert.equal(addr.qualifier, "addressing");
});

test("a name with no known role suffix has a null role and is its own domain", () => {
  const c = packageCoordinate("@561-group/web-server");
  assert.equal(c.role, null);
  assert.equal(c.domain, "web-server");
  assert.equal(c.qualifier, null);
});

test("an unscoped name parses with an empty scope", () => {
  const c = packageCoordinate("swarm");
  assert.equal(c.scope, "");
  assert.equal(c.domain, "swarm");
  assert.equal(c.role, null);
});

test("every known role is recognised as the role of <domain>-<role>", () => {
  for (const role of JSNODE_ROLES) {
    assert.equal(packageCoordinate(`@emsenn/x-${role}`).role, role);
  }
});

test("the role lexicon defines exactly the known roles, in stratum order", () => {
  assert.deepEqual(
    ROLE_LEXICON.map((c) => c.role),
    [...JSNODE_ROLES],
  );
  ROLE_LEXICON.forEach((c, i) => assert.equal(c.stratum, i));
});

test("every role concept carries a non-empty gloss and a provenance source", () => {
  for (const role of JSNODE_ROLES) {
    const c = roleConcept(role);
    assert.equal(c.role, role);
    assert.ok(c.gloss.length > 0, `${role} has a gloss`);
    assert.ok(c.source.length > 0, `${role} cites a source`);
  }
});

test("holography is the only sibling; the canonical six are math layers", () => {
  const siblings = ROLE_LEXICON.filter((c) => c.classification === "sibling").map((c) => c.role);
  assert.deepEqual(siblings, ["holography"]);
  assert.equal(ROLE_LEXICON.filter((c) => c.classification === "math-layer").length, 6);
});

import { packageLifecycle, packageMaturity, jsNodePackage } from "./jsnode-topology.mjs";

test("lifecycle is read from keywords with deprecated taking precedence", () => {
  assert.equal(packageLifecycle([]), "active");
  assert.equal(packageLifecycle(["maintenance"]), "maintenance");
  assert.equal(packageLifecycle(["legacy"]), "maintenance");
  assert.equal(packageLifecycle(["abandoned"]), "abandoned");
  assert.equal(packageLifecycle(["deprecated"]), "deprecated");
  // deprecated wins over abandoned when both are present
  assert.equal(packageLifecycle(["abandoned", "deprecated"]), "deprecated");
});

test("maturity is inferred from the semver version", () => {
  assert.equal(packageMaturity("0.0.0"), "experimental");
  assert.equal(packageMaturity("0.0.3"), "alpha");
  assert.equal(packageMaturity("0.4.1"), "beta");
  assert.equal(packageMaturity("1.0.0"), "stable");
  assert.equal(packageMaturity("2.3.4"), "stable");
  // prerelease tag and explicit keyword override the number
  assert.equal(packageMaturity("1.0.0-beta.1"), "beta");
  assert.equal(packageMaturity("0.0.0", ["stable"]), "stable");
});

test("a carrier derives both lifecycle and maturity", () => {
  const p = jsNodePackage({
    name: "@x/old", version: "0.0.0", description: "", layer: "lib",
    exports: ["."], dependencies: [], tags: ["deprecated"],
  });
  assert.equal(p.lifecycle, "deprecated");
  assert.equal(p.maturity, "experimental");
});

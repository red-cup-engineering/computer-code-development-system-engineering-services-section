import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsNodePackage, jsNodeWorkspace } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { jsType, typeCatalog } from "@red-cup-engineering/javascript-algebra";
import {
  termIri,
  packageTurtle,
  packageJsonLd,
  workspaceTurtle,
  domainTurtle,
  domainJsonLd,
  roleTurtle,
  roleJsonLd,
  vocabulary,
} from "./index.mjs";
import { roleConcept } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";

// The API is now a TypeCatalog with type *names* (not pre-resolved terms): the
// codec projects names onto the floor via the package's own resolveTypeTerm.
const pkg = jsNodePackage({
  name: "@emsenn/foo",
  version: "1.2.3",
  description: "a foo package",
  layer: "lib",
  exports: ["."],
  dependencies: ["@emsenn/bar"],
  tags: ["alpha", "beta"],
  api: typeCatalog({
    types: [jsType("Foo", "interface"), jsType("Fancy", "interface")],
    functions: [
      { name: "makeFoo", domain: ["string"], codomain: "Foo" },
      { name: "burnFoo", domain: ["Foo"] },
    ],
    subtypes: [["Fancy", "Foo"]],
  }),
});

describe("termIri", () => {
  it("maps a scoped package term to a single encoded path segment", () => {
    assert.equal(termIri("/", "jsnode.package.@emsenn/foo"), "/jsnode/package/%40emsenn%2Ffoo");
  });
  it("honours a non-root base", () => {
    assert.equal(termIri("https://x.test", "jsnode.tag.alpha"), "https://x.test/jsnode/tag/alpha");
  });
});

describe("packageTurtle", () => {
  const ttl = packageTurtle(pkg);
  it("declares the factual prefixes and the package as jsnode:Package", () => {
    assert.match(ttl, /@prefix jsnode: <\/jsnode\/vocab#> \./);
    assert.match(ttl, /a jsnode:Package ;/);
  });
  it("emits factual predicates, not claim machinery", () => {
    assert.match(ttl, /jsnode:in-layer </);
    assert.match(ttl, /jsnode:has-tag </);
    assert.match(ttl, /jsnode:depends-on </);
    assert.doesNotMatch(ttl, /PotentialClaim|StableClaim|prov:wasDerivedFrom/);
  });
  it("renders functions as morphisms with domain and codomain", () => {
    assert.match(ttl, /a jsnode:Function ;/);
    assert.match(ttl, /jsnode:has-domain </);
    assert.match(ttl, /jsnode:has-codomain </);
  });
  it("renders the type lattice: a subtype specializes its supertype", () => {
    assert.match(ttl, /jsnode:specializes </);
  });
  it("omits codomain for a function returning nothing", () => {
    // burnFoo has no codomain; ensure no stray empty codomain triple
    const burnBlock = ttl.split("\n\n").find((b) => b.includes("burnFoo"));
    assert.ok(burnBlock);
    assert.doesNotMatch(burnBlock, /has-codomain/);
  });
});

describe("packageJsonLd", () => {
  const doc = JSON.parse(packageJsonLd(pkg))                                                                                ;
  it("carries a context and a graph of the package and its api nodes", () => {
    assert.ok(doc["@context"]["jsnode"]);
    const types = doc["@graph"].map((n) => n["@type"]);
    assert.ok(types.includes("jsnode:Package"));
    assert.ok(types.includes("jsnode:Type"));
    assert.ok(types.includes("jsnode:Function"));
  });
  it("links depends-on to the dependency's package IRI", () => {
    const node = doc["@graph"].find((n) => n["@type"] === "jsnode:Package");
    assert.ok(node);
    assert.deepEqual(node["depends-on"], [termIri("/", "jsnode.package.@emsenn/bar")]);
  });
});

describe("workspaceTurtle + vocabulary", () => {
  it("serializes every package in the workspace", () => {
    const ws = jsNodeWorkspace("/repo", [pkg]);
    const ttl = workspaceTurtle(ws);
    assert.match(ttl, /@emsenn(\/|%2F)foo/);
  });
  it("vocabulary defines the classes and object properties", () => {
    const voc = vocabulary();
    assert.match(voc, /jsnode:Package a owl:Class/);
    assert.match(voc, /jsnode:has-domain a owl:ObjectProperty/);
  });
  it("vocabulary publishes the role concept scheme with each role's definition", () => {
    const voc = vocabulary();
    assert.match(voc, /a skos:ConceptScheme/);
    assert.match(voc, /a skos:Concept/);
    assert.match(voc, /skos:definition "/);
    // the algebra concept's definition is the authored gloss, not a bare label
    assert.match(voc, /generators and relations at the base/);
  });
});

describe("roleTurtle + roleJsonLd", () => {
  const members = [
    jsNodePackage({ name: "@emsenn/meme-topology", version: "0.0.1", description: "the meme topology", layer: "lib", exports: ["."], dependencies: ["@emsenn/agent-topology"] }),
    jsNodePackage({ name: "@emsenn/agent-topology", version: "0.0.1", description: "the agent topology", layer: "lib", exports: ["."], dependencies: [] }),
  ];
  const concept = roleConcept("topology");
  it("emits the role as a SKOS concept carrying its authored definition", () => {
    const ttl = roleTurtle(concept, members);
    assert.match(ttl, /a skos:Concept/);
    assert.match(ttl, /skos:definition "The settlement engine/);
    assert.match(ttl, /skos:inScheme </);
    assert.match(ttl, /jsnode:stratum "1"\^\^xsd:integer/);
  });
  it("describes each member package and its has-role membership", () => {
    const ttl = roleTurtle(concept, members);
    assert.match(ttl, /a jsnode:Package ;/);
    assert.match(ttl, /jsnode:has-role </);
  });
  it("roleJsonLd carries the concept, its definition, and the members in one graph", () => {
    const doc = JSON.parse(roleJsonLd(concept, members));
    assert.ok(Array.isArray(doc["@graph"]));
    const conceptNode = doc["@graph"].find((n                         ) => typeof n.definition === "string");
    assert.match(conceptNode.definition, /settlement engine/);
    assert.equal(conceptNode.stratum, 1);
  });
});

describe("domainTurtle", () => {
  const members = [
    jsNodePackage({ name: "@emsenn/meme-topology", version: "0.0.1", description: "the meme topology", layer: "lib", exports: ["."], dependencies: ["@emsenn/meme-algebra"] }),
    jsNodePackage({ name: "@emsenn/meme-algebra", version: "0.0.1", description: "the meme algebra", layer: "lib", exports: ["."], dependencies: [] }),
  ];
  const ttl = domainTurtle("meme", members);
  it("declares the domain as a jsnode:Domain with its label", () => {
    assert.match(ttl, /a jsnode:Domain ;/);
    assert.match(ttl, /rdfs:label "meme"/);
  });
  it("emits each member's in-domain and has-role membership", () => {
    assert.match(ttl, /jsnode:in-domain </);
    assert.match(ttl, /jsnode:has-role </);
  });
  it("still describes each member as a full jsnode:Package", () => {
    assert.match(ttl, /a jsnode:Package ;/);
    assert.match(ttl, /jsnode:description "the meme algebra"/);
  });
});

describe("domainJsonLd", () => {
  const members = [
    jsNodePackage({ name: "@emsenn/meme-topology", version: "0.0.1", description: "the meme topology", layer: "lib", exports: ["."], dependencies: [] }),
  ];
  const doc = JSON.parse(domainJsonLd("meme", members))                                                ;
  it("includes a Domain node and a member with in-domain/has-role", () => {
    assert.ok(doc["@graph"].some((n) => n["@type"] === "jsnode:Domain"));
    const pkgNode = doc["@graph"].find((n) => n["@type"] === "jsnode:Package") ;
    assert.ok("in-domain" in pkgNode);
    assert.ok("has-role" in pkgNode);
  });
});

describe("vocabulary", () => {
  it("declares the Domain and Role classes and their predicates", () => {
    const voc = vocabulary();
    assert.match(voc, /jsnode:Domain a owl:Class/);
    assert.match(voc, /jsnode:Role a owl:Class/);
    assert.match(voc, /jsnode:in-domain a owl:ObjectProperty/);
    assert.match(voc, /jsnode:has-role a owl:ObjectProperty/);
  });
});

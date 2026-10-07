/**
 * rdf — the JS Node ecosystem as factual linked data.
 *
 * A JSNodePackage's coordinates (layer, tags, exports, dependencies) and its
 * API surface (types, functions, and the domain/codomain of each function)
 * are *facts*, not contested claims: there is no contrary to `depends-on`.
 * So this codec emits a plain-triple vocabulary — `jsnode:Package`,
 * `jsnode:Type`, `jsnode:Function` and their predicates — rather than the
 * four-valued potential/active/stable claim machinery used by older linked-data code.
 * It reuses the shared Turtle term writers (`iriRef`, `turtleLiteral`) so
 * there is one Turtle serializer in the workspace, two vocabularies over it.
 *
 * Every meme-floor term becomes a dereferenceable IRI via `termIri`, so the RDF
 * is the same carrier the topology settles, read at the factual layer.
 */
import { iriRef, turtleLiteral } from "@red-cup-engineering/turtle-services-section/turtle";
import {
  packageTerm,
  layerTerm,
  exportTerm,
  tagTerm,
  typeTerm,
  functionTerm,
  hasTagPredicate,
  hasExportPredicate,
  dependsOnPredicate,
  inLayerPredicate,
  hasTypePredicate,
  hasFunctionPredicate,
  hasDomainPredicate,
  hasCodomainPredicate,
  specializesPredicate,
  transformsToPredicate,
  producedByPredicate,
  consumedByPredicate,
  resolveTypeTerm,
  domainTerm,
  roleTerm,
  roleSchemeTerm,
  ROLE_LEXICON,
  inDomainPredicate,
  hasRolePredicate,
  packageCoordinate,
                     
                       
                   
} from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

                                                     

function ensureSlash(base        )         {
  return base.endsWith("/") ? base : `${base}/`;
}

export function vocabularyNamespace(base = "/")         {
  return `${ensureSlash(base)}jsnode/vocab#`;
}

/** Map a meme-floor term (`jsnode.<kind>.<rest>`) to a dereferenceable IRI
 *  `<base>jsnode/<kind>/<rest>`. The `rest` is percent-encoded so scoped names
 *  like `@emsenn/foo` or `pkg:Type` survive as a single path segment. */
export function termIri(base        , term        )         {
  const body = term.startsWith("jsnode.") ? term.slice("jsnode.".length) : term;
  const dot = body.indexOf(".");
  const kind = dot === -1 ? body : body.slice(0, dot);
  const rest = dot === -1 ? "" : body.slice(dot + 1);
  return `${ensureSlash(base)}jsnode/${kind}/${encodeURIComponent(rest)}`;
}

function predicateLocal(predicate        )         {
  return predicate.startsWith("jsnode.") ? predicate.slice("jsnode.".length) : predicate;
}

// ---------- Turtle ----------

const PREDICATE = Object.freeze({
  inLayer: predicateLocal(inLayerPredicate()),
  hasTag: predicateLocal(hasTagPredicate()),
  hasExport: predicateLocal(hasExportPredicate()),
  dependsOn: predicateLocal(dependsOnPredicate()),
  hasType: predicateLocal(hasTypePredicate()),
  hasFunction: predicateLocal(hasFunctionPredicate()),
  hasDomain: predicateLocal(hasDomainPredicate()),
  hasCodomain: predicateLocal(hasCodomainPredicate()),
  specializes: predicateLocal(specializesPredicate()),
  transformsTo: predicateLocal(transformsToPredicate()),
  producedBy: predicateLocal(producedByPredicate()),
  consumedBy: predicateLocal(consumedByPredicate()),
  inDomain: predicateLocal(inDomainPredicate()),
  hasRole: predicateLocal(hasRolePredicate()),
});

function turtlePrefixes(base        )         {
  return [
    `@prefix rdf: <${RDF}> .`,
    `@prefix rdfs: <${RDFS}> .`,
    `@prefix owl: <${OWL}> .`,
    `@prefix jsnode: <${vocabularyNamespace(base)}> .`,
  ].join("\n");
}

function turtleBlock(subject        , type        , props                            )         {
  const body = props.filter((p)              => p !== null);
  return `${subject} a jsnode:${type} ;\n  ${body.join(" ;\n  ")} .`;
}

function packageTurtleBlocks(base        , pkg               )           {
  const iri = (term        )         => iriRef(termIri(base, term));
  const list = (terms                   )         => terms.map(iri).join(", ");

  const m = pkg.manifest;
  const node = m.engines["node"];
  const props                    = [
    `rdfs:label ${turtleLiteral(pkg.name)}`,
    `jsnode:version ${turtleLiteral(pkg.version)}`,
    `jsnode:description ${turtleLiteral(pkg.description)}`,
    `jsnode:${PREDICATE.inLayer} ${iri(layerTerm(pkg.layer))}`,
    `jsnode:lifecycle ${turtleLiteral(pkg.lifecycle)}`,
    `jsnode:maturity ${turtleLiteral(pkg.maturity)}`,
    // The plain manifest facts (the normie metadata), as factual literals.
    m.license !== null ? `jsnode:license ${turtleLiteral(m.license)}` : null,
    m.private ? `jsnode:private true` : null,
    m.moduleType !== null ? `jsnode:moduleType ${turtleLiteral(m.moduleType)}` : null,
    node !== undefined ? `jsnode:nodeEngine ${turtleLiteral(node)}` : null,
    m.repository !== null ? `jsnode:repository ${turtleLiteral(m.repository)}` : null,
    m.scripts.length ? `jsnode:script ${m.scripts.map(turtleLiteral).join(", ")}` : null,
    pkg.tags.length ? `jsnode:${PREDICATE.hasTag} ${list(pkg.tags.map(tagTerm))}` : null,
    pkg.exports.length ? `jsnode:${PREDICATE.hasExport} ${list(pkg.exports.map((s) => exportTerm(pkg.name, s)))}` : null,
    pkg.dependencies.length ? `jsnode:${PREDICATE.dependsOn} ${list(pkg.dependencies.map(packageTerm))}` : null,
    pkg.api && pkg.api.types.length ? `jsnode:${PREDICATE.hasType} ${list(pkg.api.types.map((t) => typeTerm(pkg.name, t.name)))}` : null,
    pkg.api && pkg.api.functions.length ? `jsnode:${PREDICATE.hasFunction} ${list(pkg.api.functions.map((f) => functionTerm(pkg.name, f.name)))}` : null,
  ];

  const blocks = [turtleBlock(iri(packageTerm(pkg.name)), "Package", props)];

  const api = pkg.api;
  if (api) {
    for (const type of api.types) {
      const supers = api.subtypes
        .filter(([sub]) => sub === type.name)
        .map(([, sup]) => resolveTypeTerm(pkg.name, api, sup));
      blocks.push(turtleBlock(iri(typeTerm(pkg.name, type.name)), "Type", [
        `rdfs:label ${turtleLiteral(type.name)}`,
        `jsnode:kind ${turtleLiteral(type.kind)}`,
        supers.length ? `jsnode:${PREDICATE.specializes} ${list(supers)}` : null,
      ]));
    }
    for (const fn of api.functions) {
      const domain = fn.domain.map((d) => resolveTypeTerm(pkg.name, api, d));
      blocks.push(turtleBlock(iri(functionTerm(pkg.name, fn.name)), "Function", [
        `rdfs:label ${turtleLiteral(fn.name)}`,
        domain.length ? `jsnode:${PREDICATE.hasDomain} ${list(domain)}` : null,
        fn.codomain !== undefined
          ? `jsnode:${PREDICATE.hasCodomain} ${iri(resolveTypeTerm(pkg.name, api, fn.codomain))}`
          : null,
      ]));
    }
  }
  return blocks;
}

export function packageTurtle(pkg               , opts             = {})         {
  const base = opts.base ?? "/";
  return `${turtlePrefixes(base)}\n\n${packageTurtleBlocks(base, pkg).join("\n\n")}\n`;
}

export function workspaceTurtle(workspace                 , opts             = {})         {
  const base = opts.base ?? "/";
  const blocks = workspace.packages.flatMap((pkg) => packageTurtleBlocks(base, pkg));
  return `${turtlePrefixes(base)}\n\n${blocks.join("\n\n")}\n`;
}

// ---------- domains ----------

/** The membership facts for one package: which domain it belongs to and (when
 *  the name carries one) which role it instantiates — the (domain, role)
 *  coordinate read off the package name as linked data. */
function domainMembershipTurtle(base        , pkg               )         {
  const iri = (term        )         => iriRef(termIri(base, term));
  const c = packageCoordinate(pkg.name);
  const props           = [`jsnode:${PREDICATE.inDomain} ${iri(domainTerm(c.domain))}`];
  if (c.role !== null) props.push(`jsnode:${PREDICATE.hasRole} ${iri(roleTerm(c.role))}`);
  return `${iri(packageTerm(pkg.name))} ${props.join(" ;\n  ")} .`;
}

/** One domain as a self-contained linked-data document: the domain node, every
 *  member package fully described, and the in-domain / has-role membership
 *  edges. `members` are the workspace packages whose coordinate domain is
 *  `domain` (the caller filters); the codec resolves the role/domain terms
 *  itself, so it depends only on jsnode-topology — exactly as it already
 *  serializes a package or the whole workspace. */
export function domainTurtle(domain        , members                          , opts             = {})         {
  const base = opts.base ?? "/";
  const iri = (term        )         => iriRef(termIri(base, term));
  const domainBlock = `${iri(domainTerm(domain))} a jsnode:Domain ;\n  rdfs:label ${turtleLiteral(domain)} .`;
  const memberBlocks = members.flatMap((pkg) => [
    ...packageTurtleBlocks(base, pkg),
    domainMembershipTurtle(base, pkg),
  ]);
  return `${turtlePrefixes(base)}\n\n${[domainBlock, ...memberBlocks].join("\n\n")}\n`;
}

// ---------- roles (the SKOS concept scheme) ----------

// The role/vocabulary documents add SKOS (concepts) and XSD (the typed stratum
// notation) on top of the factual prefixes. Package/workspace docs keep the
// lean prefix set; only the concept docs that use these declare them.
function conceptPrefixes(base        )         {
  return [turtlePrefixes(base), `@prefix skos: <${SKOS}> .`, `@prefix xsd: <${XSD}> .`].join("\n");
}

// One role as a SKOS concept: its label, the definition lifted from the
// workspace's own authored prose (carried as skos:definition), its stratum
// (skos:notation + jsnode:stratum), its classification, and the provenance of
// the gloss as an editorial note — never a synthesised claim, always sourced.
function roleConceptBlock(base        , c             )         {
  const iri = (term        )         => iriRef(termIri(base, term));
  return turtleBlock(iri(roleTerm(c.role)), "Role", [
    `a skos:Concept`,
    `skos:inScheme ${iri(roleSchemeTerm())}`,
    `rdfs:label ${turtleLiteral(c.role)}`,
    `skos:prefLabel ${turtleLiteral(c.role)}`,
    `skos:definition ${turtleLiteral(c.gloss)}`,
    `skos:notation "${c.stratum}"^^xsd:integer`,
    `jsnode:stratum "${c.stratum}"^^xsd:integer`,
    `jsnode:roleClass ${turtleLiteral(c.classification)}`,
    `skos:editorialNote ${turtleLiteral(`definition lifted faithfully from ${c.source}`)}`,
  ]);
}

function roleSchemeBlock(base        )         {
  const iri = (term        )         => iriRef(termIri(base, term));
  const top = ROLE_LEXICON[0];
  return (
    `${iri(roleSchemeTerm())} a skos:ConceptScheme ;\n` +
    `  rdfs:label "jsnode role vocabulary" ;\n` +
    `  rdfs:comment "The role suffix every package name encodes, each role a defined concept in stratum order (algebra at the base)." ;\n` +
    (top ? `  skos:hasTopConcept ${iri(roleTerm(top.role))} .` : `  rdfs:label "jsnode role vocabulary" .`)
  );
}

/** One role as a self-contained linked-data document: the concept scheme, the
 *  role concept (label, definition, stratum, provenance), every member package
 *  fully described, and each member's has-role / in-domain membership. Mirrors
 *  {@link domainTurtle}: `members` are the workspace packages whose coordinate
 *  role is this role (the caller filters); the codec resolves the terms itself. */
export function roleTurtle(c             , members                          , opts             = {})         {
  const base = opts.base ?? "/";
  const memberBlocks = members.flatMap((pkg) => [
    ...packageTurtleBlocks(base, pkg),
    domainMembershipTurtle(base, pkg),
  ]);
  return `${conceptPrefixes(base)}\n\n${[roleSchemeBlock(base), roleConceptBlock(base, c), ...memberBlocks].join("\n\n")}\n`;
}

// ---------- JSON-LD ----------

function jsonLdContext(base        )                          {
  const idSet = (id        ) => ({ "@id": id, "@type": "@id", "@container": "@set" });
  return {
    rdf: RDF,
    rdfs: RDFS,
    owl: OWL,
    skos: SKOS,
    jsnode: vocabularyNamespace(base),
    label: "rdfs:label",
    lifecycle: "jsnode:lifecycle",
    maturity: "jsnode:maturity",
    license: "jsnode:license",
    private: "jsnode:private",
    moduleType: "jsnode:moduleType",
    nodeEngine: "jsnode:nodeEngine",
    repository: "jsnode:repository",
    script: { "@id": "jsnode:script", "@container": "@set" },
    prefLabel: "skos:prefLabel",
    definition: "skos:definition",
    notation: "skos:notation",
    editorialNote: "skos:editorialNote",
    inScheme: { "@id": "skos:inScheme", "@type": "@id" },
    hasTopConcept: { "@id": "skos:hasTopConcept", "@type": "@id" },
    stratum: "jsnode:stratum",
    roleClass: "jsnode:roleClass",
    version: "jsnode:version",
    description: "jsnode:description",
    kind: "jsnode:kind",
    [PREDICATE.inLayer]: { "@id": `jsnode:${PREDICATE.inLayer}`, "@type": "@id" },
    [PREDICATE.hasTag]: idSet(`jsnode:${PREDICATE.hasTag}`),
    [PREDICATE.hasExport]: idSet(`jsnode:${PREDICATE.hasExport}`),
    [PREDICATE.dependsOn]: idSet(`jsnode:${PREDICATE.dependsOn}`),
    [PREDICATE.hasType]: idSet(`jsnode:${PREDICATE.hasType}`),
    [PREDICATE.hasFunction]: idSet(`jsnode:${PREDICATE.hasFunction}`),
    [PREDICATE.hasDomain]: idSet(`jsnode:${PREDICATE.hasDomain}`),
    [PREDICATE.hasCodomain]: { "@id": `jsnode:${PREDICATE.hasCodomain}`, "@type": "@id" },
    [PREDICATE.specializes]: idSet(`jsnode:${PREDICATE.specializes}`),
    [PREDICATE.transformsTo]: idSet(`jsnode:${PREDICATE.transformsTo}`),
    [PREDICATE.producedBy]: idSet(`jsnode:${PREDICATE.producedBy}`),
    [PREDICATE.consumedBy]: idSet(`jsnode:${PREDICATE.consumedBy}`),
    [PREDICATE.inDomain]: { "@id": `jsnode:${PREDICATE.inDomain}`, "@type": "@id" },
    [PREDICATE.hasRole]: { "@id": `jsnode:${PREDICATE.hasRole}`, "@type": "@id" },
  };
}

function packageJsonLdNodes(base        , pkg               )                            {
  const id = (term        )         => termIri(base, term);
  const ids = (terms                   )           => terms.map(id);

  const m = pkg.manifest;
  const node                          = {
    "@id": id(packageTerm(pkg.name)),
    "@type": "jsnode:Package",
    label: pkg.name,
    version: pkg.version,
    description: pkg.description,
    [PREDICATE.inLayer]: id(layerTerm(pkg.layer)),
    lifecycle: pkg.lifecycle,
    maturity: pkg.maturity,
  };
  if (m.license !== null) node["license"] = m.license;
  if (m.private) node["private"] = true;
  if (m.moduleType !== null) node["moduleType"] = m.moduleType;
  if (m.engines["node"] !== undefined) node["nodeEngine"] = m.engines["node"];
  if (m.repository !== null) node["repository"] = m.repository;
  if (m.scripts.length) node["script"] = [...m.scripts];
  if (pkg.tags.length) node[PREDICATE.hasTag] = ids(pkg.tags.map(tagTerm));
  if (pkg.exports.length) node[PREDICATE.hasExport] = ids(pkg.exports.map((s) => exportTerm(pkg.name, s)));
  if (pkg.dependencies.length) node[PREDICATE.dependsOn] = ids(pkg.dependencies.map(packageTerm));
  if (pkg.api && pkg.api.types.length) node[PREDICATE.hasType] = ids(pkg.api.types.map((t) => typeTerm(pkg.name, t.name)));
  if (pkg.api && pkg.api.functions.length) node[PREDICATE.hasFunction] = ids(pkg.api.functions.map((f) => functionTerm(pkg.name, f.name)));

  const nodes                            = [node];
  const api = pkg.api;
  if (api) {
    for (const type of api.types) {
      const typeNode                          = {
        "@id": id(typeTerm(pkg.name, type.name)),
        "@type": "jsnode:Type",
        label: type.name,
        kind: type.kind,
      };
      const supers = api.subtypes
        .filter(([sub]) => sub === type.name)
        .map(([, sup]) => resolveTypeTerm(pkg.name, api, sup));
      if (supers.length) typeNode[PREDICATE.specializes] = ids(supers);
      nodes.push(typeNode);
    }
    for (const fn of api.functions) {
      const fnNode                          = { "@id": id(functionTerm(pkg.name, fn.name)), "@type": "jsnode:Function", label: fn.name };
      const domain = fn.domain.map((d) => resolveTypeTerm(pkg.name, api, d));
      if (domain.length) fnNode[PREDICATE.hasDomain] = ids(domain);
      if (fn.codomain !== undefined) fnNode[PREDICATE.hasCodomain] = id(resolveTypeTerm(pkg.name, api, fn.codomain));
      nodes.push(fnNode);
    }
  }
  return nodes;
}

export function packageJsonLd(pkg               , opts             = {})         {
  const base = opts.base ?? "/";
  return `${JSON.stringify({ "@context": jsonLdContext(base), "@graph": packageJsonLdNodes(base, pkg) }, null, 2)}\n`;
}

export function workspaceJsonLd(workspace                 , opts             = {})         {
  const base = opts.base ?? "/";
  const graph = workspace.packages.flatMap((pkg) => packageJsonLdNodes(base, pkg));
  return `${JSON.stringify({ "@context": jsonLdContext(base), "@graph": graph }, null, 2)}\n`;
}

/** One domain as JSON-LD: the domain node plus its members fully described,
 *  each member node carrying its in-domain / has-role membership. Mirrors
 *  {@link domainTurtle}. */
export function domainJsonLd(domain        , members                          , opts             = {})         {
  const base = opts.base ?? "/";
  const id = (term        )         => termIri(base, term);
  const graph                            = [
    { "@id": id(domainTerm(domain)), "@type": "jsnode:Domain", label: domain },
  ];
  for (const pkg of members) {
    const nodes = packageJsonLdNodes(base, pkg);
    const c = packageCoordinate(pkg.name);
    const pkgNode = nodes[0] ;
    pkgNode[PREDICATE.inDomain] = id(domainTerm(c.domain));
    if (c.role !== null) pkgNode[PREDICATE.hasRole] = id(roleTerm(c.role));
    graph.push(...nodes);
  }
  return `${JSON.stringify({ "@context": jsonLdContext(base), "@graph": graph }, null, 2)}\n`;
}

/** One role as JSON-LD: the concept scheme, the role concept (label,
 *  definition, stratum, provenance), and its member packages fully described,
 *  each carrying its has-role / in-domain membership. Mirrors {@link roleTurtle}
 *  and {@link domainJsonLd}. */
export function roleJsonLd(c             , members                          , opts             = {})         {
  const base = opts.base ?? "/";
  const id = (term        )         => termIri(base, term);
  const graph                            = [
    {
      "@id": id(roleSchemeTerm()),
      "@type": "skos:ConceptScheme",
      label: "jsnode role vocabulary",
      hasTopConcept: ROLE_LEXICON[0] ? id(roleTerm(ROLE_LEXICON[0].role)) : undefined,
    },
    {
      "@id": id(roleTerm(c.role)),
      "@type": ["jsnode:Role", "skos:Concept"],
      inScheme: id(roleSchemeTerm()),
      label: c.role,
      prefLabel: c.role,
      definition: c.gloss,
      notation: c.stratum,
      stratum: c.stratum,
      roleClass: c.classification,
      editorialNote: `definition lifted faithfully from ${c.source}`,
    },
  ];
  for (const pkg of members) {
    const nodes = packageJsonLdNodes(base, pkg);
    const coord = packageCoordinate(pkg.name);
    const pkgNode = nodes[0] ;
    pkgNode[PREDICATE.inDomain] = id(domainTerm(coord.domain));
    if (coord.role !== null) pkgNode[PREDICATE.hasRole] = id(roleTerm(coord.role));
    graph.push(...nodes);
  }
  return `${JSON.stringify({ "@context": jsonLdContext(base), "@graph": graph }, null, 2)}\n`;
}

// ---------- type flow (the composition neighbourhood) ----------

/** The structural slice of a type-flow neighbourhood this codec serializes —
 *  matched structurally so jsnode-computer's `TypeFlowNeighbourhood` is a valid
 *  input without this package depending on it. Only the *one-hop, factual* part
 *  is rendered: the producing/consuming functions and the direct transforms-to
 *  edges. Transitive reachability and pipelines are derived inference, left to
 *  the JSON surface. */
                                             
                        
                       
                            
                                                                                  
                                                                                  
                                                                                
                                                                                  
 

/** One type's composition neighbourhood as Turtle: the type, the functions that
 *  produce and consume it (`produced-by`/`consumed-by`), and the direct
 *  `transforms-to` edges to and from its one-step neighbours. */
export function typeFlowTurtle(nb                            , opts             = {})         {
  const base = opts.base ?? "/";
  const iri = (term        )         => iriRef(termIri(base, term));
  const list = (terms                   )         => terms.map(iri).join(", ");

  const props                    = [
    `rdfs:label ${turtleLiteral(nb.name)}`,
    `jsnode:kind ${turtleLiteral(nb.typeKind)}`,
    nb.producedBy.length
      ? `jsnode:${PREDICATE.producedBy} ${list(nb.producedBy.map((f) => functionTerm(f.pkg, f.name)))}`
      : null,
    nb.consumedBy.length
      ? `jsnode:${PREDICATE.consumedBy} ${list(nb.consumedBy.map((f) => functionTerm(f.pkg, f.name)))}`
      : null,
    nb.downstream.length
      ? `jsnode:${PREDICATE.transformsTo} ${list(nb.downstream.map((t) => typeTerm(t.pkg, t.name)))}`
      : null,
  ];
  const blocks = [turtleBlock(iri(typeTerm(nb.pkg, nb.name)), "Type", props)];
  // Upstream as incoming transforms-to, so the one-hop neighbourhood is whole.
  for (const t of nb.upstream) {
    blocks.push(`${iri(typeTerm(t.pkg, t.name))} jsnode:${PREDICATE.transformsTo} ${iri(typeTerm(nb.pkg, nb.name))} .`);
  }
  return `${turtlePrefixes(base)}\n\n${blocks.join("\n\n")}\n`;
}

/** One type's composition neighbourhood as JSON-LD; mirrors {@link typeFlowTurtle}. */
export function typeFlowJsonLd(nb                            , opts             = {})         {
  const base = opts.base ?? "/";
  const id = (term        )         => termIri(base, term);
  const ids = (terms                   )           => terms.map(id);

  const node                          = {
    "@id": id(typeTerm(nb.pkg, nb.name)),
    "@type": "jsnode:Type",
    label: nb.name,
    kind: nb.typeKind,
  };
  if (nb.producedBy.length) node[PREDICATE.producedBy] = ids(nb.producedBy.map((f) => functionTerm(f.pkg, f.name)));
  if (nb.consumedBy.length) node[PREDICATE.consumedBy] = ids(nb.consumedBy.map((f) => functionTerm(f.pkg, f.name)));
  if (nb.downstream.length) node[PREDICATE.transformsTo] = ids(nb.downstream.map((t) => typeTerm(t.pkg, t.name)));

  const graph                            = [node];
  for (const t of nb.upstream) {
    graph.push({
      "@id": id(typeTerm(t.pkg, t.name)),
      "@type": "jsnode:Type",
      [PREDICATE.transformsTo]: [id(typeTerm(nb.pkg, nb.name))],
    });
  }
  return `${JSON.stringify({ "@context": jsonLdContext(base), "@graph": graph }, null, 2)}\n`;
}

// ---------- vocabulary ----------

/** The ontology document: the classes and predicates the codec emits. Served
 *  as `describedby` so a consumer can resolve the factual vocabulary. */
export function vocabulary(base = "/")         {
  const ns = vocabularyNamespace(base);
  const objectProp = (local        , label        , range        )         =>
    `jsnode:${local} a owl:ObjectProperty ; rdfs:range jsnode:${range} ; rdfs:label ${turtleLiteral(label)} .`;
  // The role concept scheme: every role is also a skos:Concept with its
  // authored definition, so the has-role IRIs resolve to a defined term instead
  // of a bare identifier. The gloss is lifted from the workspace's own prose
  // (see ROLE_LEXICON / its `source`), never synthesised here.
  const roleConcepts = [roleSchemeBlock(base), ...ROLE_LEXICON.map((c) => roleConceptBlock(base, c))].join("\n\n");
  return `${conceptPrefixes(base)}

<${ns.slice(0, -1)}> a owl:Ontology ;
  rdfs:label "561 JS Node ecosystem vocabulary" ;
  rdfs:comment "Factual structure of the JS Node package workspace: packages, their coordinates, and their API surface as morphisms over types." .

jsnode:Package a owl:Class ; rdfs:label "Package" ;
  rdfs:comment "A Node.js package: a point in the layered workspace." .
jsnode:lifecycle a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "lifecycle" ;
  rdfs:comment "The team's disposition toward a package: active, maintenance, deprecated, or abandoned (read from keywords)." .
jsnode:maturity a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "maturity" ;
  rdfs:comment "The release maturity inferred from the version: experimental (0.0.0), alpha (0.0.x), beta (0.x.y), or stable (>=1.0.0)." .
jsnode:license a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "license" .
jsnode:private a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "private" .
jsnode:moduleType a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "module type" .
jsnode:nodeEngine a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "node engine" ;
  rdfs:comment "The package's declared engines.node SemVer range." .
jsnode:repository a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "repository" .
jsnode:script a owl:DatatypeProperty ; rdfs:domain jsnode:Package ; rdfs:label "script" ;
  rdfs:comment "The name of an npm script the package defines." .
jsnode:Type a owl:Class ; rdfs:label "Type" ;
  rdfs:comment "A class, interface, type alias, or primitive a package's API references." .
jsnode:Function a owl:Class ; rdfs:label "Function" ;
  rdfs:comment "A function a package exports, read as a morphism with domain and codomain types." .
jsnode:Domain a owl:Class ; rdfs:label "Domain" ;
  rdfs:comment "The Personality facet of the (domain, role) classification a package name encodes: the subject a package treats (meme, agent, web, …), the namespace its prefix names." .
jsnode:Role a owl:Class ; rdfs:label "Role" ;
  rdfs:comment "The Energy facet: the structure a package instantiates over its domain (algebra, topology, geometry, analysis, logic, codecs, holography). Each role is also a skos:Concept in the role vocabulary below." .
jsnode:stratum a owl:DatatypeProperty ; rdfs:domain jsnode:Role ; rdfs:label "stratum" ;
  rdfs:comment "A role's declared stratum position (0 = algebra, the base)." .
jsnode:roleClass a owl:DatatypeProperty ; rdfs:domain jsnode:Role ; rdfs:label "role class" ;
  rdfs:comment "Whether a role is one of the canonical six math layers or the observed carrier sibling (holography)." .

${objectProp(PREDICATE.inLayer, "in layer", "Package")}
${objectProp(PREDICATE.hasTag, "has tag", "Package")}
${objectProp(PREDICATE.dependsOn, "depends on", "Package")}
${objectProp(PREDICATE.hasType, "has type", "Type")}
${objectProp(PREDICATE.hasFunction, "has function", "Function")}
${objectProp(PREDICATE.hasDomain, "has domain", "Type")}
${objectProp(PREDICATE.hasCodomain, "has codomain", "Type")}
${objectProp(PREDICATE.specializes, "specializes", "Type")}
${objectProp(PREDICATE.transformsTo, "transforms to", "Type")}
${objectProp(PREDICATE.producedBy, "produced by", "Function")}
${objectProp(PREDICATE.consumedBy, "consumed by", "Function")}
${objectProp(PREDICATE.inDomain, "in domain", "Domain")}
${objectProp(PREDICATE.hasRole, "has role", "Role")}

${roleConcepts}
`;
}

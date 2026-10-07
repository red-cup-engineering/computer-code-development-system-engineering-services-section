/**
 * @red-cup-engineering/jsnode-codecs — the JS Node package ecosystem as factual RDF.
 *
 * Turtle and JSON-LD serializations of JSNodePackage / JSNodeWorkspace carriers
 * over a plain-triple vocabulary, plus the term→IRI map that makes every
 * meme-floor term dereferenceable.
 */
export {
  termIri,
  vocabularyNamespace,
  packageTurtle,
  workspaceTurtle,
  packageJsonLd,
  workspaceJsonLd,
  domainTurtle,
  domainJsonLd,
  roleTurtle,
  roleJsonLd,
  typeFlowTurtle,
  typeFlowJsonLd,
  vocabulary,
} from "./rdf.mjs";
                                                                        

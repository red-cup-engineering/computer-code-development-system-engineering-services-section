import { predicate } from "./predicate.mjs";

/**
 * coordinate — the fibration coordinate of a workspace package.
 *
 * The flat `lib/` layout names every package `<domain>-<role>`: `meme-topology`,
 * `agent-algebra`, `web-codecs-http`. That hyphenated string is a point in a
 * 2-D grid — a *role* (the suffix functor: algebra, topology, geometry,
 * analysis, logic, codecs) evaluated at a *domain* base (meme, agent, web, …) —
 * but nothing reads it as such, so the grid is invisible and the layout reads
 * as an undifferentiated list. `packageCoordinate` parses the point back out:
 * it is the inverse of the naming convention, making the flat layout legible
 * as the fibration it already is.
 *
 * The role vocabulary is the live generation of common modules. `holography`
 * is included as an observed sibling; the canonical six are the math layers.
 */

/** A role is the suffix functor a package instantiates — one structure
 *  ("topology", "algebra", …) evaluated at whatever domain precedes it. */
                        
             
              
              
              
           
            
                 

/** The known roles, in stratum order: algebra (generators/relations) is the
 *  base; topology the carrier over it; geometry/analysis/logic constructions
 *  above; codecs the forgetful functor to wire formats; holography the
 *  reconstruction sibling. */
export const JSNODE_ROLES                        = Object.freeze([
  "algebra",
  "topology",
  "geometry",
  "analysis",
  "logic",
  "codecs",
  "holography",
]);

const ROLE_SET                      = new Set(JSNODE_ROLES);

/** The fibration coordinate of a package: where it sits in the (domain, role)
 *  grid the flat names encode. */
                                    
                                                                         
                         
                                                                  
                         
                                                                  
                                                                            
                                
                          
                                                                               
                                                            
                                   
                                                                         
                                                                    
                                    
 

/** Parse a package name into its (domain, role) coordinate. The role is the
 *  last hyphen segment that names a known role; the domain is everything before
 *  it; anything after is the qualifier. Pure and total — every name maps to a
 *  coordinate, with role null when the convention does not apply. */
export function packageCoordinate(name        )                    {
  let scope = "";
  let local = name;
  if (name.startsWith("@")) {
    const slash = name.indexOf("/");
    if (slash !== -1) {
      scope = name.slice(0, slash);
      local = name.slice(slash + 1);
    }
  }
  const segments = local.split("-");
  // The role is the LAST segment that is a known role: this lets a trailing
  // qualifier (web-codecs-http, meme-topology-addressing) keep its role while a
  // domain that merely contains a role word would not (there are none today).
  let roleIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (ROLE_SET.has(segments[i] ?? "")) {
      roleIndex = i;
      break;
    }
  }
  if (roleIndex === -1) {
    return Object.freeze({ scope, local, domain: local, role: null, qualifier: null });
  }
  const role = segments[roleIndex]              ;
  const domain = segments.slice(0, roleIndex).join("-");
  const qualifier = roleIndex + 1 < segments.length ? segments.slice(roleIndex + 1).join("-") : null;
  return Object.freeze({
    scope,
    local,
    // A bare role with no domain prefix (none today, but total) keeps the role
    // word as its own domain rather than emptying it.
    domain: domain === "" ? role : domain,
    role,
    qualifier,
  });
}

/** Whether a role is one of the canonical six math layers, or the observed
 *  carrier sibling (holography). coordinate's own note: "holography is included
 *  as an observed sibling; the canonical six are the math layers." */
                                                       

/** A role read as a *defined concept*: its place in the stratum, a one-line
 *  definition of the structure the suffix functor instantiates, and the in-repo
 *  source that definition is lifted from.
 *
 *  The naming convention encodes a role into every package name, but the
 *  *meaning* of each role has lived only in prose — the layer semantics authored
 *  in `LANGUAGE-MIGRATION.md` (§"Layer semantics") and this module's own stratum
 *  note above. `ROLE_LEXICON` lifts that prose into data so the vocabulary is
 *  legible to a machine and a reader, not just to whoever wrote the comment.
 *  Every gloss is taken faithfully from those authored sources — never
 *  synthesised — in keeping with the never-fabricate rule the catalogs hold to
 *  for package descriptions; `source` records the provenance. */
                              
                            
                                                                                 
                           
                                                                      
                                           
                                                                            
                                                               
                         
                                                     
                          
 

const LM = "LANGUAGE-MIGRATION.md §Layer semantics";
const NOTE = "jsnode-topology/coordinate stratum note";

/** The role vocabulary as defined concepts — the comment above freed into data.
 *  In stratum order (the order of {@link JSNODE_ROLES}). Each gloss is lifted
 *  from the workspace's own authored prose; none is invented here. */
export const ROLE_LEXICON                         = Object.freeze([
  {
    role: "algebra",
    stratum: 0,
    classification: "math-layer",
    gloss:
      "Generative and compositional operations and the signature they act on — the generators and relations at the base of the stratum.",
    source: `${LM}; ${NOTE}`,
  },
  {
    role: "topology",
    stratum: 1,
    classification: "math-layer",
    gloss:
      "The settlement engine: the carrier over the algebra — a span base with restriction maps (dependency arcs), reading settlement, descent, and cohomology (the obstruction to gluing local pieces into a global one).",
    source: `${LM}; ${NOTE}`,
  },
  {
    role: "geometry",
    stratum: 2,
    classification: "math-layer",
    gloss: "Metric and embedding structure over the carrier — similarity and distance.",
    source: LM,
  },
  {
    role: "analysis",
    stratum: 3,
    classification: "math-layer",
    gloss:
      "Semantics and discourse read off the settled carrier — roles, polarity, scope, presupposition, reference.",
    source: LM,
  },
  {
    role: "logic",
    stratum: 4,
    classification: "math-layer",
    gloss: "Well-formedness and constraint over the carrier — the admissibility (grammaticality) predicate.",
    source: LM,
  },
  {
    role: "codecs",
    stratum: 5,
    classification: "math-layer",
    gloss:
      "Reversible bridge morphisms with a round-trip law — the forgetful functor out to wire formats: render structure→surface and parse surface→structure.",
    source: `${LM}; ${NOTE}`,
  },
  {
    role: "holography",
    stratum: 6,
    classification: "sibling",
    gloss:
      "The reconstruction sibling of the carrier — observed alongside the canonical six math layers rather than being one of them.",
    source: NOTE,
  },
]                 );

const LEXICON_BY_ROLE                                       = new Map(
  ROLE_LEXICON.map((c) => [c.role, c]),
);

/** The defined concept for a role: its stratum, classification, gloss, and the
 *  source the gloss is lifted from. Total over {@link JSNodeRole}. */
export function roleConcept(role            )              {
  return LEXICON_BY_ROLE.get(role) ;
}

/** RDF term for a role, in the jsnode vocabulary used by the codecs. */
export function roleTerm(role            )         {
  return `jsnode.role.${role}`;
}

/** RDF term for the role concept scheme — the SKOS scheme the role concepts
 *  belong to. */
export function roleSchemeTerm()         {
  return "jsnode.scheme.roles";
}

/** RDF term for a domain base. */
export function domainTerm(domain        )         {
  return `jsnode.domain.${domain}`;
}

/** Predicate: a package instantiates a role. */
export const hasRolePredicate = predicate("has-role");

/** Predicate: a package belongs to a domain base. */
export const inDomainPredicate = predicate("in-domain");

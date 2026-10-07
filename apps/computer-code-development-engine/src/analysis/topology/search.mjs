/**
 * search — ranked lookup over JSNodePackages.
 *
 * Query terms are sought together in name, then tags, then description: the
 * first field that carries all of them fixes the match's rank, so a name hit
 * always outranks a tag hit which outranks a description hit. Punctuation is
 * normalized, making `cell graph` and `cell-graph` the same lookup. This is a
 * free-text read, not a meme-floor
 * operation — description is prose, not a term — so it lives beside the
 * carriers it ranks rather than in the utterance settling.
 */
                                                           

                                                                     

/** The preference order: lower rank is a stronger match. */
export const MATCH_RANK                                       = Object.freeze({
  name: 0,
  tag: 1,
  description: 2,
  "any-term": 3,
});

                               
                                  
                                                   
                             
                        
                                                                        
                        
                                                                                       
                                     
                                                                        
                                      
                                                                             
                                        
                                                                                  
                                                                       
                                                                                 
                                     
 

                                    
                        
                                       
 

                                                                 

                                         
                           
                                 
                           
                            
 

                                             
                           
                                                         
                         
 

                                     
                                                                     
                                                        
                                                        
                                                   
                                                                                 
                                      
                                                                                                                                                                       
 

                                          
                                                   
                                                                
                                              
 

function normalizedTerms(value        )                    {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function carriesEveryTerm(value        , terms                   )          {
  const haystack = normalizedTerms(value).join(" ");
  return terms.every((term) => haystack.includes(term));
}

function bestMatch(
  pkg               ,
  variants                                                                                   ,
  consumers                   ,
  consumerDeclarations                                       ,
  paths                    ,
)                           {
  const nameVariant = variants.find(({ terms }) => carriesEveryTerm(pkg.name, terms));
  if (nameVariant !== undefined) {
    return Object.freeze({
      package: pkg,
      field: "name"         ,
      rank: MATCH_RANK.name,
      reasons: Object.freeze([`package name matches "${nameVariant.label}"`, ...(nameVariant.reason === undefined ? [] : [nameVariant.reason])]),
      consumers,
      consumerDeclarations,
      paths,
    });
  }
  const tagMatch = pkg.tags.flatMap((tag) => variants
    .filter(({ terms }) => carriesEveryTerm(tag, terms))
    .map((variant) => ({ tag, variant })))[0];
  if (tagMatch !== undefined) {
    return Object.freeze({
      package: pkg,
      field: "tag"         ,
      rank: MATCH_RANK.tag,
      tag: tagMatch.tag,
      reasons: Object.freeze([`keyword "${tagMatch.tag}" matches "${tagMatch.variant.label}"`, ...(tagMatch.variant.reason === undefined ? [] : [tagMatch.variant.reason])]),
      consumers,
      consumerDeclarations,
      paths,
    });
  }
  const descriptionVariant = variants.find(({ terms }) => carriesEveryTerm(pkg.description, terms));
  if (descriptionVariant !== undefined) {
    return Object.freeze({
      package: pkg,
      field: "description"         ,
      rank: MATCH_RANK.description,
      reasons: Object.freeze([`description contains every term in "${descriptionVariant.label}"`, ...(descriptionVariant.reason === undefined ? [] : [descriptionVariant.reason])]),
      consumers,
      consumerDeclarations,
      paths,
    });
  }
  return undefined;
}

/**
 * Fallback used only when no package carries every query term in one field:
 * rank by how many distinct terms appear anywhere across name, tags, and
 * description. Returns `undefined` when the package carries none of them.
 */
function anyTermMatch(
  pkg               ,
  terms                   ,
  consumers                   ,
  consumerDeclarations                                       ,
  paths                    ,
)                           {
  const haystack = normalizedTerms([pkg.name, ...pkg.tags, pkg.description].join(" ")).join(" ");
  const matchedTermCount = terms.filter((queryTerm) => haystack.includes(queryTerm)).length;
  if (matchedTermCount === 0) return undefined;
  return Object.freeze({
    package: pkg,
    field: "any-term"         ,
    rank: MATCH_RANK["any-term"],
    matchedTermCount,
    reasons: Object.freeze([`matches ${matchedTermCount} of ${terms.length} terms`]),
    consumers,
    consumerDeclarations,
    paths,
  });
}

function queryVariants(term        , concepts                              ) {
  const query = normalizedTerms(term).join(" ");
  const variants                                                                                = [Object.freeze({ label: query, terms: normalizedTerms(query) })];
  for (const concept of concepts) {
    const names = [concept.term, ...(concept.aliases ?? [])];
    if (!names.some((name) => normalizedTerms(name).join(" ") === query)) continue;
    for (const name of names) {
      const label = normalizedTerms(name).join(" ");
      if (label === "" || variants.some((variant) => variant.label === label)) continue;
      variants.push(Object.freeze({ label, terms: normalizedTerms(label), reason: `capability vocabulary expands "${query}" through term "${concept.term}"` }));
    }
  }
  return Object.freeze(variants);
}

function pathSummary(pkg               , observations                                   , complete         )                     {
  const forPackage = observations.filter((observation) => observation.package === pkg.name);
  const published = Object.freeze(forPackage.filter(({ kind }) => kind === "published"));
  const installed = Object.freeze(forPackage.filter(({ kind }) => kind === "installed"));
  const live = Object.freeze(forPackage.filter(({ kind }) => kind === "live"));
  const sourceOnly = complete ? published.length === 0 && installed.length === 0 && live.length === 0 : null;
  const classification = live.length > 0
    ? "source-with-live-path"
    : installed.length > 0
      ? "source-with-installed-path"
      : published.length > 0
        ? "source-with-published-release"
        : sourceOnly === true
          ? "source-only"
          : "source-with-unassayed-delivery";
  return Object.freeze({
    source: Object.freeze({ status: "observed"         , version: pkg.version }),
    published,
    installed,
    live,
    sourceOnly,
    classification,
  });
}

/**
 * Rank packages carrying every normalized query term in one field: name, then
 * tag, then description. Ties within a rank break on name.
 * An empty or whitespace term matches nothing — use the workspace listing for
 * the full set rather than overloading search with "everything".
 * When no package carries every term in one field (a multi-word query too
 * strict for any single field), falls back to ranking by how many distinct
 * terms a package carries anywhere across name, tags, and description —
 * this fallback only ever runs when the all-terms match found nothing, so
 * an exact/all-term match always outranks an any-term one.
 */
export function searchPackages(
  packages                          ,
  term        ,
  context                          = {},
)                          {
  const terms = normalizedTerms(term);
  if (terms.length === 0) return Object.freeze([]);
  const consumersByPackage = new Map                                      ();
  for (const consumer of packages) {
    for (const dependency of consumer.deps) {
      const consumers = consumersByPackage.get(dependency.name) ?? [];
      consumers.push(Object.freeze({ package: consumer.name, kind: dependency.kind, range: dependency.range }));
      consumersByPackage.set(dependency.name, consumers);
    }
  }
  const variants = queryVariants(term, context.concepts ?? []);
  const matches                 = [];
  const anyTermMatches                 = [];
  for (const pkg of packages) {
    const declarations = Object.freeze([...(consumersByPackage.get(pkg.name) ?? [])]
      .sort((a, b) => a.package.localeCompare(b.package) || a.kind.localeCompare(b.kind)));
    const consumers = Object.freeze([...new Set(declarations
      .filter(({ kind }) => kind === "runtime")
      .map(({ package: consumer }) => consumer))]);
    const paths = pathSummary(pkg, context.pathObservations ?? [], context.pathObservationsComplete === true);
    const match = bestMatch(pkg, variants, consumers, declarations, paths);
    if (match !== undefined) {
      matches.push(match);
      continue;
    }
    const fallback = anyTermMatch(pkg, terms, consumers, declarations, paths);
    if (fallback !== undefined) anyTermMatches.push(fallback);
  }
  if (matches.length > 0) {
    matches.sort((a, b) => a.rank - b.rank || a.package.name.localeCompare(b.package.name));
    return Object.freeze(matches);
  }
  anyTermMatches.sort((a, b) => (b.matchedTermCount ?? 0) - (a.matchedTermCount ?? 0) || a.package.name.localeCompare(b.package.name));
  return Object.freeze(anyTermMatches);
}

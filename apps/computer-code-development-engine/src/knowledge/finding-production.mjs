/**
 * Producing findings: one work order per demanded address, and the assay a candidate must pass.
 *
 * A finding is produced from the file itself by whichever model the inference market places the
 * work with, so its producer is untrusted until assayed. The assay is grounding: every identifier
 * a claim names in backticks must occur in the source it was learned from, so a model that invents
 * an export or a parameter is refused rather than believed. A claim that names nothing of the
 * source beyond its path, or that restates the work order instead of the source, is refused too:
 * such a card tells an agent nothing the path did not.
 */
import path from "node:path";
import { gitBlobIdOf } from "@red-cup-engineering/git-services-section/git-object-id";
import { MAX_CLAIM_CHARACTERS, findingAddressOf, nonFinalFindingReason, textFindingSource } from "./anchored-findings.mjs";
import { documentSections } from "./document-sections.mjs";

/** The market class a finding is placed and priced under: routing learns whose findings are accepted. */
export const FINDING_TASK_CLASS = "knowledge-finding";
/**
 * Past this a source is its own market class: the models that card a short file well are not the
 * ones that card a long file well, so placement learns acceptance for each separately.
 */
const LARGE_SOURCE_CHARACTERS = 16_000;
/** Held under the admission bound, so a card stays a card and a model's overrun still fits. */
const CLAIM_BUDGET = 1600;
/** The output ceiling of one request for a card: the budget with room to end its sentence. */
const CLAIM_TOKENS = 700;
/**
 * The market attempts one finding may spend: agent bounds are whole-job bounds shared by every
 * route the market falls through, so a single request would leave no fallback after one refusal.
 */
const MARKET_ATTEMPTS = 8;
/** A card must name at least this many distinct identifiers found in the source itself. */
const MIN_GROUNDED_IDENTIFIERS = 2;
/** The share of a claim's word runs that may come from its work order rather than its source. */
const MAX_ECHOED_SHARE = 0.2;
/** Files read as documents: what they establish, rather than what they export. */
const DOCUMENT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".rst", ".org", ".adoc"]);
const DATA_EXTENSIONS = new Set([".json"]);
/** Words a claim may name in backticks that belong to the language, not the source. */
const LANGUAGE_WORDS = new Set([
  "string", "number", "boolean", "object", "undefined", "null", "true", "false", "void", "any",
  "Promise", "Array", "Map", "Set", "Object", "JSON", "Error", "TypeError", "async", "await",
  "function", "const", "let", "return", "new", "this", "import", "export", "default", "class",
]);

/** What a card must say, by the kind of file it describes. */
const ASKS = Object.freeze({
  source: [
    "state what it is for and what an agent needs to use or change it:",
    "its exported names with their parameters, the data it reads and writes, and any invariant a careless edit would break.",
    "Write every identifier in backticks, spelled exactly as in the source.",
  ],
  document: [
    "state what it establishes and what it asks of an agent:",
    "the decisions, definitions and obligations it states, the terms it defines, and what it says to do or never do.",
    "Write every term, name or path you cite from it in backticks, spelled exactly as in the document.",
  ],
  data: [
    "state what data it holds and what an agent needs to preserve when changing it:",
    "the actual keys, value shapes and relationships shown here, including any purpose stated by the data itself. Do not invent code exports, parameters, or unstated validation rules.",
    "Write every key or value you cite from it in backticks, spelled exactly as in the data.",
  ],
});

/**
 * The market class of one finding: its kind and size band under `knowledge-finding`, so acceptance
 * is learned per class of source rather than averaged over files a model can and cannot card.
 */
export const findingTaskClassOf = (kind, characters) => `${FINDING_TASK_CLASS}:${kind}:${characters > LARGE_SOURCE_CHARACTERS ? "large" : "small"}`;

/**
 * The work order for one address: the dispatch request (objective, source as context, a bounded
 * answer per market attempt) and what the assay and the admission need (the source and the blob it was read at), or
 * undefined when the address names no readable file or one too large to place.
 */
export function findingWorkOf({ root }, address) {
  const at = findingAddressOf(root, address);
  const [relative, ...symbol] = at.split("#");
  const text = textFindingSource(root, relative);
  if (text === undefined) return undefined;
  const { bytes } = text;
  const sections = documentSections(relative, text.source);
  if (sections.length > 0 && symbol.length === 0) return undefined;
  const section = sections.find((part) => part.address === at);
  if (symbol.length > 0 && symbol.join("#").startsWith("section-") && !section) return undefined;
  const source = section?.source ?? text.source;
  const extension = path.extname(relative).toLowerCase();
  const kind = DOCUMENT_EXTENSIONS.has(extension) ? "document" : DATA_EXTENSIONS.has(extension) ? "data" : "source";
  const about = section ? `the section ${JSON.stringify(section.title)} in \`${relative}\`` : symbol.length === 0 ? `the repository ${kind === "document" ? "document" : kind === "data" ? "data file" : "file"} \`${relative}\`` : `\`${symbol.join("#")}\` in \`${relative}\``;
  const [purpose, content, spelling] = ASKS[kind];
  const blob = gitBlobIdOf(section ? Buffer.from(source) : bytes);
  return Object.freeze({
    address: at,
    path: relative,
    kind,
    blob,
    anchor: Object.freeze({ path: relative, blob, ...(section ? { section: symbol.join("#") } : {}) }),
    source,
    request: Object.freeze({
      workType: "summarization",
      taskClass: findingTaskClassOf(kind, source.length),
      objective: [
        `Write the finding card a fleet of software agents keeps for ${about}.`,
        `An agent reads this card instead of rediscovering the ${kind === "document" ? "document" : kind === "data" ? "data" : "file"}, so ${purpose}`,
        content,
        `Use only what the ${kind === "document" ? "document" : kind === "data" ? "data" : "source"} below shows. ${spelling}`,
        `Plain sentences, no headings, no preamble, at most ${CLAIM_BUDGET} characters.`,
      ].join(" "),
      context: source,
      agentBounds: Object.freeze({ maximumRequests: MARKET_ATTEMPTS, maximumToolCalls: 0, maximumTokensPerRequest: CLAIM_TOKENS, maximumOutputTokens: CLAIM_TOKENS * MARKET_ATTEMPTS }),
    }),
  });
}

/** Identifier-like words of one backticked span: what grounding checks against the source. */
const wordsOf = (span) => span.match(/[A-Za-z_$][\w$-]*/g) ?? [];

/** The lowercase four-word runs of a text: what a restated work order shares with the order. */
const runsOf = (text) => {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  return new Set(words.slice(3).map((_, index) => words.slice(index, index + 4).join(" ")));
};

/**
 * A candidate without the packaging models add unasked: a wrapping code fence, and a lead-in such as
 * "Here is the finding card for …:" — a first paragraph that only announces what follows.
 */
function unpackaged(candidate) {
  const text = candidate.trim().replace(/^```\w*\n([\s\S]*)\n```$/, "$1").trim();
  const [first, ...rest] = text.split(/\n\s*\n/);
  return rest.length > 0 && /:\s*$/.test(first) ? rest.join("\n\n").trim() : text;
}

/**
 * The whole sentences of a text within `limit` characters. A model stopped by its output ceiling
 * ends mid-sentence, and one that overruns the budget still wrote whole sentences before the bound.
 */
function wholeSentences(text, limit) {
  const ends = /[.!?]["'`)\]]*(?=\s|$)/g;
  if (text.length <= limit && /[.!?]["'`)\]]*$/.test(text)) return text;
  const bounded = text.slice(0, limit);
  let cut = 0;
  for (const end of bounded.matchAll(ends)) cut = end.index + end[0].length;
  return bounded.slice(0, cut).trim();
}

/**
 * The assay of one candidate claim against the work order it answers: accepted, or refused with
 * its reasons. A claim may cite the file's own path, but only identifiers the source contains
 * count as what it names; runs of words shared with the objective and absent from the source mark
 * a claim that restated its order. The claim is returned without its packaging and cut to its
 * whole sentences under the admission bound.
 */
export function assayFindingCandidate({ source, path: relative, request }, candidate) {
  const raw = typeof candidate === "string" ? unpackaged(candidate) : "";
  const text = wholeSentences(raw, MAX_CLAIM_CHARACTERS);
  const reasons = [];
  if (raw === "") reasons.push("the candidate is not a text claim");
  else if (text === "") reasons.push("the claim has no whole sentence");
  const nonFinal = nonFinalFindingReason(text, relative);
  if (nonFinal !== undefined) reasons.push(nonFinal);
  // A span that cites the file itself (its path, or a tail of it such as its name) names nothing in it.
  const citesFile = (span) => relative.endsWith(span) || relative.endsWith(`${span}${path.extname(relative)}`);
  const spans = [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]).filter((span) => !citesFile(span));
  const named = [...new Set(spans.flatMap(wordsOf))].filter((word) => !LANGUAGE_WORDS.has(word));
  const invented = named.filter((word) => !source.includes(word) && !relative.includes(word));
  const grounded = named.filter((word) => source.includes(word));
  if (text !== "" && grounded.length < MIN_GROUNDED_IDENTIFIERS) reasons.push(`the claim names fewer than ${MIN_GROUNDED_IDENTIFIERS} identifiers of the source`);
  if (invented.length > 0) reasons.push(`the claim names what the source does not contain: ${invented.slice(0, 8).join(", ")}`);
  if (request?.objective) {
    // Cited spans are the source's own words; the prose around them is what may echo the order.
    const sourceRuns = runsOf(`${relative}\n${source}`);
    const orderRuns = runsOf(request.objective.replace(/`[^`\n]*`/g, " "));
    const claimRuns = [...runsOf(text.replace(/`[^`\n]*`/g, " "))];
    const echoed = claimRuns.filter((run) => orderRuns.has(run) && !sourceRuns.has(run));
    if (claimRuns.length > 0 && echoed.length / claimRuns.length > MAX_ECHOED_SHARE) reasons.push(`the claim restates its work order: "${echoed.slice(0, 3).join("\", \"")}"`);
  }
  return Object.freeze({ accepted: reasons.length === 0, claim: text, reasons: Object.freeze(reasons) });
}

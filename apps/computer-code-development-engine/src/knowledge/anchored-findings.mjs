/**
 * Anchored findings: what agents learn about the house repository, kept once for the whole fleet.
 *
 * A finding is a short claim at a proof-path address — a repository path, a section directory, or
 * `path#symbol` — anchored to the git blob ids of the files it was learned from. It is live while
 * every anchor still hashes to its blob and the claim is a final answer: an edit or exposed model
 * work trace retires it. Reads go by address prefix, so a
 * section's path yields every live finding beneath it. Findings at one address may disagree; each
 * keeps its producer, and a later finding retires an earlier one only by naming it in `supersedes`.
 * A retired finding is not knowledge but demand: an address the fleet knew and must learn again.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { gitBlobIdOf } from "@red-cup-engineering/git-services-section/git-object-id";
import { journal, openJournal } from "@red-cup-engineering/computer-system-engine/journal/journal";
import { toEavt } from "@red-cup-engineering/eavt/row";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { GATE_CHARACTERS } from "./finding-delivery.mjs";
import { documentSections } from "./document-sections.mjs";

export const ANCHORED_FINDINGS_FEED = "anchored-findings";
export const ANCHORED_FINDING_KIND = "knowledge.anchored-finding";
/** Every agent reaching an address reads its findings, so a claim is held to a card's size. */
export const MAX_CLAIM_CHARACTERS = 4000;
/** Full-file cards above this input size cost too much; those files need a section-level carrier. */
export const MAX_TEXT_FINDING_BYTES = 32_000;
const MAX_ANCHORS = 32;
const PRODUCER_FIELDS = Object.freeze(["agent", "model", "session", "work"]);
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** Only bounded UTF-8 text can enter the text finding market. Binary assets keep their own carrier. */
export function textFindingSource(root, relative) {
  try {
    const file = path.join(root, relative);
    const info = statSync(file);
    if (!info.isFile() || info.size === 0 || info.size > MAX_TEXT_FINDING_BYTES) return undefined;
    const bytes = readFileSync(file);
    if (bytes.length === 0 || bytes.length > MAX_TEXT_FINDING_BYTES) return undefined;
    const source = textDecoder.decode(bytes);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(source)) return undefined;
    return Object.freeze({ bytes, source });
  } catch {
    return undefined;
  }
}

/** The repository-relative POSIX path of `target`, refused when it leaves the repository. */
function repositoryPath(root, target) {
  const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) throw new TypeError(`${target} is not inside the repository`);
  return relative;
}

/** A proof-path address in its one spelling: repository-relative, `#symbol` kept; "" is the repository. */
export function findingAddressOf(root, address = "") {
  if (typeof address !== "string") throw new TypeError("an address is a repository path, optionally with #symbol");
  const [where, ...symbol] = address.trim().split("#");
  const place = where === "" ? "" : repositoryPath(root, where);
  return symbol.length === 0 || symbol.join("#") === "" ? place : `${place}#${symbol.join("#")}`;
}

const pathOfAddress = (address) => address.split("#")[0];

/** The git blob id of a repository file as it stands now, or undefined when it is no file. */
function currentBlob(root, relative) {
  const file = path.join(root, relative);
  try {
    if (!statSync(file).isFile()) return undefined;
    return gitBlobIdOf(readFileSync(file));
  } catch {
    return undefined;
  }
}

/** A section's content address; edits elsewhere in the same document leave it live. */
function currentSectionBlob(root, relative, section) {
  const text = textFindingSource(root, relative);
  const part = text && documentSections(relative, text.source).find((candidate) => candidate.address === `${relative}#${section}`);
  return part ? gitBlobIdOf(Buffer.from(part.source)) : undefined;
}

function claimOf(claim, address) {
  if (typeof claim !== "string" || claim.trim() === "") throw new TypeError("a finding needs a claim");
  const text = claim.trim();
  if (text.length > MAX_CLAIM_CHARACTERS) throw new TypeError(`a claim holds at most ${MAX_CLAIM_CHARACTERS} characters; admit several findings at narrower addresses`);
  const nonFinal = nonFinalFindingReason(text, address);
  if (nonFinal !== undefined) throw new TypeError(`a finding needs a final claim: ${nonFinal}`);
  return text;
}

/** Model reasoning and self-review are work traces, not a claim another agent can rely on. */
export function nonFinalFindingReason(claim, address = "") {
  if (typeof claim !== "string") return "the claim is not text";
  if (/<\/?(?:think|thought|analysis|reasoning|scratchpad)\b[^>]*>/i.test(claim)) return "model reasoning is included";
  if (/^\s*(?:bounded inference product|only source used|identifiers in backticks|plain sentences|no headings\/preamble)\s*\?/im.test(claim)) return "model self-review is included";
  if (/\.json(?:#.*)?$/i.test(address) && /^\s*[-*]?\s*(?:exported names|parameters)\s*:/im.test(claim)) return "JSON data is described as code exports or parameters";
  return undefined;
}

function producerOf(producer) {
  if (producer === undefined) return undefined;
  if (producer === null || typeof producer !== "object") throw new TypeError("a producer is { agent?, model?, session?, work? }");
  const fields = PRODUCER_FIELDS.filter((key) => typeof producer[key] === "string" && producer[key].trim() !== "");
  return fields.length === 0 ? undefined : Object.freeze(Object.fromEntries(fields.map((key) => [key, producer[key].trim()])));
}

function anchorsOf(root, address, anchorPaths) {
  const paths = anchorPaths ?? [pathOfAddress(address)];
  if (!Array.isArray(paths) || paths.length === 0) throw new TypeError("a finding names the files it was learned from");
  if (paths.length > MAX_ANCHORS) throw new TypeError(`a finding is anchored to at most ${MAX_ANCHORS} files`);
  const anchors = new Map();
  for (const target of paths) {
    // An anchor may carry the blob the claim was learned from: a file edited since then refuses the
    // finding, where anchoring it to the new blob would pin a stale claim to changed source.
    const learned = target !== null && typeof target === "object" ? target : { path: target };
    const relative = repositoryPath(root, String(learned.path));
    const section = learned.section;
    if (section !== undefined && (typeof section !== "string" || !/^section-\d+$/.test(section))) throw new TypeError("anchor section must be a document section address");
    const blob = section === undefined ? currentBlob(root, relative) : currentSectionBlob(root, relative, section);
    if (blob === undefined) throw new TypeError(`anchor ${relative} is not a repository file; anchor a finding about a directory to the files it was learned from`);
    if (learned.blob !== undefined && learned.blob !== blob) throw new TypeError(`anchor ${relative} changed since the finding was learned from it`);
    anchors.set(`${relative}${section === undefined ? "" : `#${section}`}`, { path: relative, blob, ...(section === undefined ? {} : { section }) });
  }
  return Object.freeze([...anchors].sort(([left], [right]) => left.localeCompare(right)).map(([, anchor]) => Object.freeze(anchor)));
}

/** Every admitted finding in causal order; a malformed or unreadable feed yields none. */
function admittedFindings(dataRoot) {
  try {
    const folded = journal.scanCausalSubject(dataRoot, ANCHORED_FINDINGS_FEED, "9999-12-31", [], (findings, row) => {
      const value = row[2];
      if (value?.kind === ANCHORED_FINDING_KIND) findings.push(value);
      return findings;
    });
    return folded.result;
  } catch {
    return [];
  }
}

const within = (prefix, address) => prefix === ""
  || address === prefix
  || address.startsWith(`${prefix}/`)
  || address.startsWith(`${prefix}#`);

/**
 * The selected findings, each read against the repository as it stands: `live` while every anchor
 * hashes to its blob, `retired` once one has changed, gone, or fails final-claim admission, `superseded` once a later finding
 * named it. Live findings come first by address, newest first.
 */
function foldFindings(root, dataRoot, selects, { address, limit, includeRetired }) {
  const findings = admittedFindings(dataRoot);
  const superseded = new Set(findings.flatMap((finding) => finding.supersedes ?? []));
  const blobs = new Map();
  const blobOf = (anchor) => {
    const key = `${anchor.path}${anchor.section === undefined ? "" : `#${anchor.section}`}`;
    if (!blobs.has(key)) blobs.set(key, anchor.section === undefined ? currentBlob(root, anchor.path) : currentSectionBlob(root, anchor.path, anchor.section));
    return blobs.get(key);
  };
  const live = [];
  const retired = [];
  let supersededCount = 0;
  for (const finding of findings) {
    if (!selects(finding)) continue;
    if (superseded.has(finding.id)) { supersededCount += 1; continue; }
    const changed = finding.anchors.filter((anchor) => blobOf(anchor) !== anchor.blob).map((anchor) => `${anchor.path}${anchor.section === undefined ? "" : `#${anchor.section}`}`);
    const nonFinal = nonFinalFindingReason(finding.claim, finding.address);
    if (changed.length === 0 && nonFinal === undefined) live.push(finding);
    else retired.push(Object.freeze({ id: finding.id, address: finding.address, changed: Object.freeze(changed), ...(nonFinal === undefined ? {} : { reason: nonFinal }), at: finding.at }));
  }
  const newestFirst = (left, right) => left.address.localeCompare(right.address) || right.at.localeCompare(left.at);
  live.sort(newestFirst);
  const knownAt = new Set(live.map((finding) => finding.address));
  const relearn = [...new Set(retired.map((finding) => finding.address))].filter((at) => !knownAt.has(at)).sort();
  return Object.freeze({
    kind: "knowledge.anchored-findings",
    address,
    live: Object.freeze(live.slice(0, Math.max(1, Math.trunc(limit)))),
    counts: Object.freeze({ live: live.length, retired: retired.length, superseded: supersededCount }),
    relearn: Object.freeze(relearn),
    ...(includeRetired ? { retired: Object.freeze(retired.sort(newestFirst)) } : {}),
  });
}

/** The findings at and beneath one address: a section's path yields every finding in it. */
export function readAnchoredFindings({ root, dataRoot }, { address = "", limit = 50, includeRetired = false } = {}) {
  const prefix = findingAddressOf(root, address);
  return foldFindings(root, dataRoot, (finding) => within(prefix, finding.address), { address: prefix, limit, includeRetired });
}

/**
 * What the fleet knows about one file an agent is about to read: the findings at the file and its
 * symbols, and the findings elsewhere (a section, a neighbour) that were learned from it.
 */
export function readFindingsOfFile({ root, dataRoot }, file, { limit = 50 } = {}) {
  const relative = repositoryPath(root, file);
  return foldFindings(root, dataRoot, (finding) => within(relative, finding.address)
    || finding.anchors.some((anchor) => anchor.path === relative), { address: relative, limit, includeRetired: false });
}

/**
 * What the fleet should learn next, most sessions first: the repository files its sessions read
 * that no live finding describes. A scheduled producer only learns from cross-session reuse: a
 * second Read in one session is still one task, already past the chance to use a new card. Retired
 * findings remain visible to readers, but do not trigger inference until reuse is observed again.
 * `reads` is [{ path, reads, sessions }] as the harness observed them; a directory address that was
 * retired is left to an agent, since learning it spans files.
 */
export function knowledgeDemand({ root, dataRoot }, reads, { limit = 8 } = {}) {
  const known = readAnchoredFindings({ root, dataRoot }, { limit: Number.MAX_SAFE_INTEGER });
  const relearn = new Set(known.relearn);
  const described = (address) => {
    const relative = pathOfAddress(address);
    return known.live.some((finding) => finding.address === address
      || (address !== relative && finding.address === relative)
      || (address === relative && (within(relative, finding.address)
        || finding.anchors.some((anchor) => anchor.path === relative))));
  };
  const demand = new Map();
  const eligible = new Map();
  const unitsOf = (relative) => {
    if (!eligible.has(relative)) {
      const text = textFindingSource(root, relative);
      const sections = text === undefined || text.bytes.length <= GATE_CHARACTERS
        ? [] : documentSections(relative, text.source).map((section) => section.address);
      eligible.set(relative, text === undefined || text.bytes.length <= GATE_CHARACTERS
        ? [] : sections.length > 0 ? sections : [relative]);
    }
    return eligible.get(relative);
  };
  for (const read of reads) {
    if (read.sessions < 2) continue;
    let relative;
    try { relative = repositoryPath(root, read.path); } catch { continue; }
    for (const address of unitsOf(relative)) {
      if (described(address)) continue;
      const held = demand.get(address) ?? { address, reads: 0, sessions: 0, relearn: relearn.has(address) || relearn.has(relative) };
      demand.set(address, { ...held, reads: held.reads + read.reads, sessions: held.sessions + read.sessions });
    }
  }
  const weight = (want) => want.sessions + (want.relearn ? 1 : 0);
  return Object.freeze([...demand.values()]
    .sort((left, right) => weight(right) - weight(left) || right.reads - left.reads || left.address.localeCompare(right.address))
    .slice(0, Math.max(0, Math.trunc(limit)))
    .map((want) => Object.freeze(want)));
}

/**
 * Admit one finding, anchored to its files as they stand now. An identical live finding is held
 * once: admitting it again returns the held one. `supersedes` names findings this one retires.
 */
export function admitAnchoredFinding({ root, dataRoot }, input, at) {
  if (input === null || typeof input !== "object") throw new TypeError("a finding is { address, claim, anchors?: (path | { path, blob })[], supersedes?, producer? }");
  const address = findingAddressOf(root, input.address);
  const claim = claimOf(input.claim, address);
  const anchors = anchorsOf(root, address, input.anchors);
  const id = artifactId({ address, claim, anchors });
  const held = readAnchoredFindings({ root, dataRoot }, { address, limit: Number.MAX_SAFE_INTEGER }).live.find((finding) => finding.id === id);
  if (held !== undefined) return Object.freeze({ kind: "knowledge.anchored-finding-admission", admitted: false, finding: held });
  const supersedes = Array.isArray(input.supersedes) ? [...new Set(input.supersedes.filter((ref) => typeof ref === "string" && ref !== ""))].sort() : [];
  const producer = producerOf(input.producer);
  const finding = Object.freeze({
    kind: ANCHORED_FINDING_KIND,
    id,
    address,
    claim,
    anchors,
    ...(supersedes.length === 0 ? {} : { supersedes: Object.freeze(supersedes) }),
    ...(producer === undefined ? {} : { producer }),
    at,
  });
  openJournal(dataRoot).appendRows(ANCHORED_FINDINGS_FEED, [toEavt({ e: `finding:${address}`, a: Object.freeze({ kind: ANCHORED_FINDING_KIND }), v: finding, t: at })], {
    at: at.slice(0, 10),
    subject: ANCHORED_FINDINGS_FEED,
    caller: Object.freeze({ transport: "anchored-knowledge" }),
  });
  return Object.freeze({ kind: "knowledge.anchored-finding-admission", admitted: true, finding });
}

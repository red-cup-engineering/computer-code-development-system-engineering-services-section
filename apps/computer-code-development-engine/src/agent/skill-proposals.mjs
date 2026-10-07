/** Agent skill-proposal read model. */

const DEFAULT_MIN_SUPPORT = 2;
const DEFAULT_MIN_SESSIONS = 1;

const REVIEW_GATES = Object.freeze([
  Object.freeze({ name: "strict-input-schema", state: "required" }),
  Object.freeze({ name: "strict-output-schema", state: "required" }),
  Object.freeze({ name: "authorization-scopes", state: "required" }),
  Object.freeze({ name: "effect-report", state: "required" }),
  Object.freeze({ name: "verification", state: "required" }),
  Object.freeze({ name: "human-approval", state: "required" }),
  Object.freeze({ name: "supply-chain-review", state: "required" }),
]);

const HIGH_RISK_PREFIXES = Object.freeze(["write", "delete", "remove", "trash", "commit", "push", "send", "publish", "deploy", "install", "exec", "run", "shell", "http", "mcp", "archive", "label", "calendar", "mail"]);
const MEDIUM_RISK_PREFIXES = Object.freeze(["read", "search", "fetch", "list", "summarize", "draft", "plan", "classify", "review"]);

function slugPart(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return slug.length === 0 ? "step" : slug;
}

function proposalId(candidate) {
  return `skill-proposal:${candidate.chain.map(slugPart).join("__")}`;
}

function riskOfCandidate(candidate) {
  const verbs = candidate.chain.map(slugPart);
  if (verbs.some((verb) => HIGH_RISK_PREFIXES.some((prefix) => verb.startsWith(prefix)))) return "high";
  if (verbs.some((verb) => MEDIUM_RISK_PREFIXES.some((prefix) => verb.startsWith(prefix)))) return "medium";
  return "low";
}

function stateOfCandidate(
  candidate,
  minSupport,
  minSessions,
) {
  if (candidate.excludedInvalid > 0) return "needs-failure-review";
  if (candidate.support < minSupport) return "needs-more-support";
  if (candidate.sessions.length < minSessions) return "needs-cross-session-evidence";
  return "reviewable";
}

function proposalOfCandidate(
  candidate,
  options,
) {
  const state = stateOfCandidate(candidate, options.minSupport, options.minSessions);
  const risk = riskOfCandidate(candidate);
  return Object.freeze({
    kind: "metroplat.agent.skill-proposal",
    id: proposalId(candidate),
    state,
    risk,
    chain: candidate.chain,
    support: candidate.support,
    sessions: candidate.sessions,
    argShapes: candidate.argShapes,
    excludedInvalid: candidate.excludedInvalid,
    gates: REVIEW_GATES,
    evidence: Object.freeze([
      `support:${candidate.support}`,
      `sessions:${candidate.sessions.length}`,
      `excluded-invalid:${candidate.excludedInvalid}`,
      `risk:${risk}`,
      `state:${state}`,
      "policy:proposal-only-human-approval-required",
    ]),
  });
}

function compareProposals(left, right) {
  const leftReady = left.state === "reviewable" ? 0 : 1;
  const rightReady = right.state === "reviewable" ? 0 : 1;
  if (leftReady !== rightReady) return leftReady - rightReady;
  if (left.support !== right.support) return right.support - left.support;
  if (left.sessions.length !== right.sessions.length) return right.sessions.length - left.sessions.length;
  if (left.chain.length !== right.chain.length) return right.chain.length - left.chain.length;
  return left.id.localeCompare(right.id);
}

export function agentSkillProposalDossier(
  measurement,
  options,
) {
  const minSupport = options.minSupport ?? DEFAULT_MIN_SUPPORT;
  const minSessions = options.minSessions ?? DEFAULT_MIN_SESSIONS;
  const proposals = Object.freeze(measurement.candidates
    .map((candidate) => proposalOfCandidate(candidate, { minSupport, minSessions }))
    .sort(compareProposals));
  const reviewable = proposals.filter((proposal) => proposal.state === "reviewable").length;
  return Object.freeze({
    kind: "metroplat.agent.skill-proposal-dossier",
    date: options.date,
    source: options.source ?? "sequence-recurrence",
    policy: "proposal-only-human-approval-required",
    minSupport,
    minSessions,
    candidates: measurement.candidates.length,
    reviewable,
    proposals,
    evidence: Object.freeze([
      `measurement:${measurement.kind}`,
      `candidates:${measurement.candidates.length}`,
      `reviewable:${reviewable}`,
      `min-support:${minSupport}`,
      `min-sessions:${minSessions}`,
      "gates:strict-input-schema,strict-output-schema,authorization-scopes,effect-report,verification,human-approval,supply-chain-review",
    ]),
  });
}

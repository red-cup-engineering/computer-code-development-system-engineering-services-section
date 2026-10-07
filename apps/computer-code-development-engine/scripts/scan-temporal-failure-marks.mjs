#!/usr/bin/env node
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";
import { freezeJson } from "@red-cup-engineering/json-services-section";
import { semanticIdOf } from "@red-cup-engineering/computer-content-engineering-services-section/semantic-content-identity";

const RECEIPT_KIND = "temporal-failure-territory-scan.receipt";

const semanticId = semanticIdOf(RECEIPT_KIND);

// This is a carrier-level diagnostic, not an ambient disk crawl.  A node must
// first admit the exact resources it asks the network to heal; the same action
// can consequently run over a package, a site, an archive promoted to active
// evidence, or a federated code territory without granting filesystem reach.
const word = (...parts) => parts.join("");
const pattern = (source, flags = "giu") => new RegExp(source, flags);
const FORBIDDEN = Object.freeze([
  ["abort-signal-temporal-stop", pattern(`${word("AbortSignal", ".", "time", "out")}\\s*\\(`, "gu")],
  ["timer", pattern(`\\b(?:${word("set", "Time", "out")}|${word("set", "Interval")})\\s*\\(`, "gu")],
  ["temporal-limit-field", pattern(`\\b(?:${word("time", "out", "Ms")}|${word("time", "out", "_ms")}|${word("request", "Time", "out", "Ms")}|${word("callback", "Time", "out", "Ms")}|${word("profileIdentity", "Time", "out", "Ms")}|${word("profileActivation", "Time", "out", "Ms")}|${word("secretTool", "Time", "out", "Ms")})\\b`, "gu")],
  ["temporal-boundary", pattern(`\\b${word("dead", "line")}\\b`)],
  ["time-to-live", pattern(`(?:\\b${word("t", "tl")}(?:Ms|Seconds|_|\\s*:)|${word("time", "-to-", "live")})`)],
  ["temporal-credential-state", pattern(`\\b(?:${word("ex", "pires")}|${word("ex", "pired")}|${word("ex", "pires", "At")}|${word("ex", "pires", "_at")}|${word("ex", "piration")}|${word("ex", "piry")})\\b`)],
  ["duration-failure", pattern(`\\b(?:${word("time", "[- ]", "limit")}|${word("elap", "sed", "[- ]", "time")})\\b`)],
]);

function text(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function path(value) {
  const normalized = text(value, "resource.path").replaceAll("\\\\", "/").replace(/^\.\//u, "");
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../") || normalized.includes("\0")) throw new TypeError(`resource.path escapes the admitted territory: ${value}`);
  return normalized;
}

function location(content, index) {
  const before = content.slice(0, index);
  return Object.freeze({ offset: index, line: before.split("\n").length, column: index - before.lastIndexOf("\n") });
}

function findings(resource) {
  const found = [];
  for (const [kind, expression] of FORBIDDEN) {
    expression.lastIndex = 0;
    for (let match = expression.exec(resource.content); match; match = expression.exec(resource.content)) {
      found.push(Object.freeze({ type: "TemporalFailureMark", kind, mark: match[0], at: location(resource.content, match.index) }));
      if (match[0] === "") expression.lastIndex += 1;
    }
  }
  // A transport status is a temporal failure only when this exact admitted
  // carrier declares the service's expected public status.  Ordinary 503s
  // remain observations, not global failure marks.
  try {
    const carrier = JSON.parse(resource.content);
    const expectation = carrier?.expectation;
    const observed = carrier?.observation?.projection?.observations;
    if (typeof expectation?.requirement === "string" && expectation.requirement.length > 0 && Array.isArray(expectation?.acceptedStatuses) && expectation.acceptedStatuses.length > 0 && expectation.acceptedStatuses.every(Number.isInteger) && typeof expectation?.url === "string" && Array.isArray(observed)) {
      for (const entry of observed) if (entry?.url === expectation.url && Number.isInteger(entry.status) && !expectation.acceptedStatuses.includes(entry.status)) {
        found.push(Object.freeze({ type: "TemporalFailureMark", kind: "expected-public-service-status", mark: `requirement ${expectation.requirement} accepts HTTP ${expectation.acceptedStatuses.join(",")}, received ${entry.status}`, at: Object.freeze({ offset: 0, line: 1, column: 1 }) }));
      }
    }
    // A heartbeat is a caller-admitted, finite observation of one circulation.
    // It names every axis rather than granting an ambient inventory crawl. Each
    // non-closed axis is consequently a repair obligation for the existing
    // capability-demand path.
    if (carrier?.type === "SemioticWebHeartbeatClosureObservation" && carrier.version === 1
      && carrier.axes && typeof carrier.axes === "object" && !Array.isArray(carrier.axes)) {
      const admittedAxes = ["authority", "carrier", "demandWorkIdentity", "resourceGrant", "executionResult", "chainSettlement", "nextObservation"];
      for (const [axisIndex, axis] of admittedAxes.entries()) {
        const observation = carrier.axes[axis];
        if (!observation || typeof observation !== "object" || Array.isArray(observation)
          || !["closed", "open", "unknown"].includes(observation.state)
          || typeof observation.evidence !== "string" || observation.evidence.length === 0) {
          throw new TypeError(`heartbeat axis ${axis} must name a state and evidence`);
        }
        if (observation.state !== "closed") found.push(Object.freeze({ type: "TemporalFailureMark", kind: "heartbeat-closure-axis", mark: `heartbeat axis ${axis} is ${observation.state}: ${observation.evidence}`, at: Object.freeze({ offset: axisIndex, line: axisIndex + 1, column: 1 }) }));
      }
    }
  } catch { /* Non-JSON resources remain ordinary code-territory material. */ }
  return found.sort((left, right) => left.at.offset - right.at.offset || left.kind.localeCompare(right.kind));
}

/**
 * Scan an already admitted code territory.  Every detected mark is an open
 * normalization obligation: execution must remain pending/running/observable
 * until explicit completion, cancellation, or a real transport/process error.
 */
export function scanTemporalFailureMarks({ resources }) {
  if (!Array.isArray(resources) || resources.length === 0) throw new TypeError("resources must be a non-empty admitted resource set");
  const observed = resources.map((raw, index) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError(`resources[${index}] must be an object`);
    const resource = Object.freeze({ path: path(raw.path), content: text(raw.content, `resources[${index}].content`) });
    return Object.freeze({ path: resource.path, findings: findings(resource) });
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(observed.map(({ path: value }) => value)).size !== observed.length) throw new TypeError("admitted resource paths must be unique");
  const obligations = observed.flatMap(({ path: resourcePath, findings: marks }) => marks.map((mark) => Object.freeze({
    type: "TemporalFailureNormalizationDemand", resourcePath, mark, wantedLaw: "pending-running-observable-cancellable-without-temporal-failure",
  })));
  const body = {
    type: "TemporalFailureTerritoryScanReceipt", version: 1,
    law: "pending-running-observable-cancellable-without-temporal-failure",
    denominator: { type: "admitted-resource-set", count: observed.length },
    resources: observed,
    obligations,
    conforms: obligations.length === 0,
  };
  return freezeJson({ ...body, id: semanticId(body) });
}

export function refuseTemporalFailureMarks(input) {
  const receipt = scanTemporalFailureMarks(input);
  if (!receipt.conforms) throw new Error(`temporal-failure normalization remains demanded by ${receipt.obligations.length} admitted marks`);
  return receipt;
}


if (import.meta.main) {
  const result = await runJavascriptNodeOperation({
    name: "scan-temporal-failure-marks",
    description: "Read admitted code territory for temporal failure marks.",
    operation: scanTemporalFailureMarks,
    inputSchema: {"type": "object", "required": ["resources"], "properties": {"resources": {"type": "array", "minItems": 1, "items": {"type": "object", "required": ["path", "content"], "properties": {"path": {"type": "string", "minLength": 1}, "content": {"type": "string", "minLength": 1}}}}}},
    outputSchema: {"type": "object"},
  }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}

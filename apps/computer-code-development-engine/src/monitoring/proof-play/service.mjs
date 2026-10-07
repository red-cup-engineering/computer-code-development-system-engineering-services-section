/**
 * @packageDocumentation
 *
 * Proof-Play source monitoring. This bounded reader observes filesystem
 * carriers as language fields, claims, proof status, causal support, and a
 * proof frontier. It does not choose or execute a repair.
 */
import path from "node:path";

import { schemaSiteIncidence } from "@red-cup-engineering/metrologic/settling/schema/site";
import { markdownDataform } from "@red-cup-engineering/markdown-engineering-services-section/markdown-projector";
import { walkFileCensus } from "@red-cup-engineering/computer-code-development-engine/monitoring/filesystem/file-census/service";
import { decodeLeanModule } from "@red-cup-engineering/lean-system-services-section/codec/module";
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";

import {
  proofPlayReadoutContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/proof-play/schema";
import { artifactTier } from "@red-cup-engineering/eavt/statement";

export { proofPlayReadoutContract } from "@red-cup-engineering/computer-code-development-engine/monitoring/proof-play/schema";

const FILE_CAP = 256;
const HEAD_BYTES = 128 * 1024;

function relativePath(root, target) {
  const relative = path.relative(root, target).split(path.sep).join("/");
  return relative === "" ? "." : relative;
}

function languageOf(file) {
  if (file.extension === "lean") return "lean4";
  if (file.extension === "md" || file.extension === "markdown") return "markdown";
  if (file.extension === "json" || file.extension === "jsonl") return "json";
  if (["mts", "mjs", "ts", "js"].includes(file.extension)) return "javascript";
  return file.extension === "(none)" ? "unknown" : file.extension;
}

function roleOf(relative, file) {
  if (relative.startsWith(`${artifactTier("log").pathSegment}/`)) return "statement-log";
  if (relative.startsWith("data/state/")) return "settled-state";
  if (relative.startsWith("data/records/")) return "record";
  if (relative.startsWith("content/")) return "content";
  if (file.extension === "lean") return "proof-source";
  if (file.extension === "md" || file.extension === "markdown") return "claim-text";
  if (relative.endsWith("package.json")) return "package-manifest";
  return "carrier";
}

function leanModuleName(relative) {
  return relative.replace(/\.lean$/u, "").split("/").filter(Boolean).join(".") || "Main";
}

function field(
  name,
  support,
  value,
  reading,
  evidence,
) {
  return Object.freeze({
    kind: "metroplat.proof-play.field",
    field: name,
    support,
    value,
    reading,
    evidence: Object.freeze([...evidence]),
  });
}

function claim(
  id,
  support,
  subject,
  predicate,
  reading,
  evidence,
  extra = {},
) {
  return Object.freeze({
    id,
    support,
    subject,
    predicate,
    orientation: "assert",
    ...(extra.type === undefined ? {} : { type: extra.type }),
    ...(extra.proof === undefined ? {} : { proof: extra.proof }),
    reading,
    evidence: Object.freeze([...evidence]),
  });
}

function groundFiles(root, files) {
  return Object.freeze(files.map((file) => {
    const relative = relativePath(root, file.full);
    const language = languageOf(file);
    const role = roleOf(relative, file);
    return Object.freeze({
      id: relative,
      path: relative,
      tree: file.tree,
      extension: file.extension,
      language,
      role,
      evidence: Object.freeze([
        `tree:${file.tree}`,
        `extension:${file.extension}`,
        `language:${language}`,
        `role:${role}`,
      ]),
    });
  }));
}

function groundRelations(files) {
  return Object.freeze(files.map((file) => Object.freeze({
    from: ".",
    to: file.path,
    relation: "contains",
    evidence: Object.freeze([`path:${file.path}`, `tree:${file.tree}`]),
  })));
}

/** Observe one root as bounded Proof-Play source material. */
export function readProofPlay(root, options) {
  const rootAbs = path.resolve(root);
  const walked = options.pathExists(rootAbs) ? walkFileCensus(rootAbs, options) : Object.freeze([]);
  const selected = Object.freeze([...walked]
    .sort((left, right) => relativePath(rootAbs, left.full).localeCompare(relativePath(rootAbs, right.full)))
    .slice(0, FILE_CAP));
  const files = groundFiles(rootAbs, selected);
  const fields = [];
  const claims = [];
  const conjectures = [];
  const theorems = [];

  for (const file of files) {
    fields.push(field("language", file.path, file.language, "held", [`path:${file.path}`, `role:${file.role}`]));
    fields.push(field("reading", file.path, "held", "held", [`path:${file.path}`, "observed:true"]));
    if (file.role === "statement-log" || file.role === "settled-state" || file.role === "record") {
      fields.push(field("evidence", file.path, file.role, "held", [`path:${file.path}`, `role:${file.role}`]));
    }

    const fullPath = path.join(rootAbs, file.path);
    if (file.language === "markdown") {
      try {
        const dataform = markdownDataform(options.readFileHeadUtf8(fullPath, HEAD_BYTES), { coordinate: file.path });
        for (const assertion of dataform.assertions) {
          const observed = claim(
            `${file.path}#${assertion.a}`,
            file.path,
            String(assertion.e),
            assertion.a,
            "held",
            [`markdown-assertion:${assertion.a}`, `support:${file.path}`],
          );
          claims.push(observed);
          fields.push(field("claim", file.path, assertion.a, "held", observed.evidence));
        }
      } catch (error) {
        fields.push(field("reading", file.path, "markdown-read-failed", "denied", [
          `path:${file.path}`,
          `error:${error instanceof Error ? error.message : String(error)}`,
        ]));
      }
    }

    if (file.language === "lean4") {
      try {
        const module = decodeLeanModule(options.readFileHeadUtf8(fullPath, HEAD_BYTES), leanModuleName(file.path), file.path);
        for (const declaration of module.declarations) {
          const proofStatus = declaration.proofStatus ?? "unknown";
          const theoremLike = declaration.kind === "theorem" || declaration.kind === "lemma";
          const reading = proofStatus === "proved" ? "held" : "unknown";
          const observed = claim(
            `${file.path}#${declaration.name}`,
            file.path,
            declaration.name,
            `lean.${declaration.kind}`,
            reading,
            [`lean-declaration:${declaration.name}`, `proof-status:${proofStatus}`, `support:${file.path}`],
            {
              type: declaration.kind,
              ...(proofStatus === "proved" ? { proof: declaration.name } : {}),
            },
          );
          claims.push(observed);
          fields.push(field("claim", file.path, declaration.name, reading, observed.evidence));
          fields.push(field("type", file.path, declaration.kind, reading, observed.evidence));
          if (proofStatus === "proved") {
            fields.push(field("proof", file.path, declaration.name, "held", observed.evidence));
            if (theoremLike) theorems.push(observed);
          } else if (theoremLike) {
            conjectures.push(observed);
          }
        }
      } catch (error) {
        fields.push(field("reading", file.path, "lean-read-failed", "denied", [
          `path:${file.path}`,
          `error:${error instanceof Error ? error.message : String(error)}`,
        ]));
      }
    }
  }

  const apex = `${rootAbs}#proof-play/language-cone`;
  const incidence = schemaSiteIncidence(fields.map((entry, index) => ({
    id: `field/${index}/${entry.field}`,
    domain: "proof-play/ground",
    codomain: `proof-play/field/${entry.field}`,
  })));
  const coneLegs = Object.freeze([
    ...files.map((file) => Object.freeze({
      id: `file/${file.path}`,
      from: apex,
      to: file.path,
      legKind: "file",
      evidence: Object.freeze([`file:${file.path}`]),
    })),
    ...fields.map((entry, index) => Object.freeze({
      id: `field/${index}/${entry.field}`,
      from: apex,
      to: `${entry.support}#field/${entry.field}/${index}`,
      legKind: "field",
      evidence: Object.freeze([`field:${entry.field}`, `support:${entry.support}`]),
    })),
    ...claims.map((entry) => Object.freeze({
      id: `claim/${entry.id}`,
      from: apex,
      to: entry.id,
      legKind: "claim",
      evidence: Object.freeze([`claim:${entry.id}`, `support:${entry.support}`]),
    })),
  ]);
  const coneExtrema = Object.freeze([
    ...incidence.domains.map((entry) => Object.freeze({ id: `domain/${entry.schema}`, extremumKind: "domain", support: entry.schema, evidence: Object.freeze(entry.legs.map((leg) => `leg:${leg}`)) })),
    ...incidence.codomains.map((entry) => Object.freeze({ id: `codomain/${entry.schema}`, extremumKind: "codomain", support: entry.schema, evidence: Object.freeze(entry.legs.map((leg) => `leg:${leg}`)) })),
    ...incidence.incoming.map((entry) => Object.freeze({ id: `incoming/${entry.schema}`, extremumKind: "incoming", support: entry.schema, evidence: Object.freeze(entry.legs.map((leg) => `leg:${leg}`)) })),
    ...incidence.outgoing.map((entry) => Object.freeze({ id: `outgoing/${entry.schema}`, extremumKind: "outgoing", support: entry.schema, evidence: Object.freeze(entry.legs.map((leg) => `leg:${leg}`)) })),
  ]);

  const events = fields.map((entry, index) => Object.freeze({
    id: `field/${index}/${entry.field}`,
    eventKind: "field",
    support: entry.support,
    reading: entry.reading,
    evidence: entry.evidence,
  }));
  claims.forEach((entry) => {
    const eventKind = theorems.some((theorem) => theorem.id === entry.id)
      ? "theorem"
      : conjectures.some((conjecture) => conjecture.id === entry.id) ? "conjecture" : "claim";
    events.push(Object.freeze({ id: `claim/${entry.id}`, eventKind, support: entry.support, reading: entry.reading, evidence: entry.evidence }));
  });
  const causalLinks = claims.map((entry) => Object.freeze({
    from: entry.support,
    to: `claim/${entry.id}`,
    evidence: Object.freeze([`support:${entry.support}`, `claim:${entry.id}`]),
  }));
  const readout = Object.freeze({
    kind: "metroplat.proof-play.readout",
    operation: "read-proof-play",
    ground: Object.freeze({
      kind: "metroplat.proof-play.ground",
      root: rootAbs,
      files,
      relations: groundRelations(files),
      truncated: walked.length > selected.length,
      evidence: Object.freeze([`files:${files.length}`, `relations:${files.length}`, `truncated:${walked.length > selected.length}`]),
    }),
    fields: Object.freeze(fields),
    languageCone: Object.freeze({
      kind: "metroplat.proof-play.language-cone",
      apex,
      legs: coneLegs,
      extrema: coneExtrema,
      evidence: Object.freeze([`apex:${apex}`, `legs:${coneLegs.length}`, `extrema:${coneExtrema.length}`]),
    }),
    space: Object.freeze({
      kind: "metroplat.proof-play.space",
      events: Object.freeze(events),
      causalLinks: Object.freeze(causalLinks),
      conflicts: Object.freeze([]),
      evidence: Object.freeze([`events:${events.length}`, `causal-links:${causalLinks.length}`, "conflicts:0"]),
    }),
    claims: Object.freeze(claims),
    conjectures: Object.freeze(conjectures),
    theorems: Object.freeze(theorems),
    evidence: Object.freeze([`ground-files:${files.length}`, `fields:${fields.length}`, `claims:${claims.length}`, `conjectures:${conjectures.length}`, `theorems:${theorems.length}`]),
  });
  return proofPlayReadoutContract.assert(readout, "proof-play readout");
}

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

export function proofPlayOperations(binding) {
  return Object.freeze([
    operation({
      verb: "proof-play",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Observe one filesystem root as bounded Proof-Play source material.",
      description: "Domain: { root?, id? }. The monitor reads source carriers and returns fields, claims, proof status, causal support, and frontier evidence without choosing or executing a repair.",
      codomain: proofPlayReadoutContract,
      run: (input) => {
        const record = inputRecord(input);
        const root = typeof record["root"] === "string" && record["root"].length > 0
          ? record["root"]
          : typeof record["id"] === "string" && record["id"].length > 0 ? record["id"] : binding.dataRoot;
        return readProofPlay(root, binding);
      },
    }),
  ]);
}

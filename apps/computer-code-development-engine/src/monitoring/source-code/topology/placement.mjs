/**
 * @packageDocumentation
 *
 * Categorical context/layer placement measurement for JavaScript declarations, typed by their JSDoc contracts.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";
import { lineColumnOf, walkJavaScript } from "@red-cup-engineering/javascript-node-services-section/javascript-parser";

const FUNCTION_NODE_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const isFunctionNode = (node) => FUNCTION_NODE_TYPES.has(node?.type);

import { nodeDeclarationReference, nodeBeingLayerOfFilenameSuffix, nodeBeingSpeciesFormula, nodeBeingTaxonConfidence, readNodeBeingTaxonomy, readNodeSubjectAnchor } from "@red-cup-engineering/communicating/language/jsnode/taxonomy";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import {
  nodePackageLayerNames,

} from "./schema.mjs";

const LAYERS = new Set(nodePackageLayerNames);
const CONTAINER_SEGMENTS = new Set(["src", "modules"]);

function slash(value) {
  return value.split(path.sep).join("/");
}

function layerName(segment) {
  if (LAYERS.has(segment)) return segment;
  return nodeBeingLayerOfFilenameSuffix(segment);
}

function pathForm(root, fileName)

 {
  const relative = slash(path.relative(root, fileName));
  const allSegments = relative.split("/").filter(Boolean);
  const sourceIndex = allSegments.indexOf("src");
  const segments = sourceIndex < 0 ? allSegments : allSegments.slice(sourceIndex + 1);
  const fileStem = (segments.at(-1) ?? "").replace(/\.(?:[cm]?[jt]sx?)$/u, "");
  const directories = segments.slice(0, -1);
  const head = directories[0];
  const region = head === "integrations" ? "integration"
    : head === "lib" ? "library"
      : head === "apps" ? "application"
        : "source";
  const regionPrefix = region === "source" ? 0 : 1;
  let layer;
  let layerIndex = -1;
  for (let index = regionPrefix; index < directories.length; index += 1) {
    const candidate = layerName(directories[index]);
    if (candidate !== undefined) {
      layer = candidate;
      layerIndex = index;
      break;
    }
  }
  const fileLayer = nodeBeingLayerOfFilenameSuffix(fileStem.split(".").at(-1) ?? "");
  if (layer === undefined) layer = fileLayer;

  const contextCandidates = directories.filter((segment, index) =>
    index >= regionPrefix
    && !CONTAINER_SEGMENTS.has(segment)
    && layerName(segment) === undefined
    && !(layerIndex >= 0 && index === layerIndex));
  const context = contextCandidates[0];
  const contextIndex = context === undefined ? -1 : directories.indexOf(context, regionPrefix);
  const convention = contextCandidates.length !== 1 || layer === undefined
    ? undefined
    : layerIndex < 0 && fileLayer !== undefined
      ? "context-directory-layer-filename"
      : contextIndex < layerIndex
        ? "context-layer-directories"
        : "layer-context-directories";
  return Object.freeze({
    region,
    ...(layer === undefined ? {} : { layer }),
    ...(context === undefined ? {} : { context }),
    subjects: Object.freeze(contextCandidates),
    ...(convention === undefined ? {} : { convention }),
  });
}

/** Observe only the carrier's project-level nesting color. Semantic placement
 * remains a separate declaration judgment below. */
export function nodePackageLayoutConventionOfPath(root, fileName) {
  return pathForm(root, fileName).convention;
}

function subjectsByDeclaration(anchors) {
  const subjects = new Map();
  for (const candidate of anchors) {
    const anchor = readNodeSubjectAnchor(candidate);
    for (const declaration of anchor.declarations) {
      const values = subjects.get(declaration) ?? new Set();
      values.add(anchor.subject);
      subjects.set(declaration, values);
    }
  }
  return new Map([...subjects].map(([declaration, values]) => [declaration, new Set(values)]));
}

function declarationReference(root, source, symbol) {
  const relative = slash(path.relative(root, source.fileName));
  if (relative.startsWith("../") || path.isAbsolute(relative)) return undefined;
  return nodeDeclarationReference(relative, symbol);
}

function typeSubjects(
  root,
  corpus,
  module,
  typeText,
  anchors,
) {
  const subjects = new Set();
  if (!module || !typeText) return subjects;
  for (const declaration of corpus.typeDeclarations(module, typeText)) {
    const declaringModule = corpus.moduleOf(declaration);
    if (!declaringModule) continue;
    const reference = declarationReference(root, declaringModule, corpus.declarationName(declaration));
    if (reference !== undefined) for (const subject of anchors.get(reference) ?? []) subjects.add(subject);
  }
  return subjects;
}

function signatureOf(corpus, node) {
  const callable = isFunctionNode(node) ? node : node.type === "VariableDeclarator" && isFunctionNode(node.init) ? node.init : undefined;
  if (!callable) return undefined;
  return corpus.contractOf(node);
}

function parameterNodes(node) {
  if (isFunctionNode(node)) return node.params;
  if (node.type === "VariableDeclarator" && isFunctionNode(node.init)) return node.init.params;
  return Object.freeze([]);
}

function importedModuleOf(corpus, identifier) {
  return identifier === undefined ? undefined : corpus.importSpecifierOf(identifier);
}

function rootIdentifier(expression) {
  let current = expression;
  while (current.type === "MemberExpression") current = current.object;
  return current.type === "Identifier" ? current : undefined;
}

/** A syntax node belongs to one corpus index, so its direct observation is
 * stable for that node's lifetime and reusable by every caller whose closure
 * crosses it. */
const directEffectCache = new WeakMap();
const transitiveEffectCache = new WeakMap();

const EFFECTFUL_NODE_MODULES = new Set([
  "async_hooks", "child_process", "cluster", "dgram", "diagnostics_channel",
  "dns", "fs", "http", "http2", "https", "net", "perf_hooks", "readline", "repl",
  "stream", "tls", "tty", "v8", "vm", "worker_threads", "zlib",
]);

/** `node:crypto` is not one effect. Hashing is deterministic computation over
 * its arguments, while random generation and process-wide engine/FIPS state
 * are genuine host observations or mutations. Treating the whole module as
 * one concrete port makes content addressing look like I/O and consequently
 * misplaces any caller whose transitive closure computes an artifact address. */
const CRYPTO_RANDOMNESS_CALLS = new Set([
  "generateKey", "generateKeyPair", "generateKeyPairSync", "generateKeySync",
  "generatePrime", "generatePrimeSync", "getRandomValues", "pseudoRandomBytes",
  "randomBytes", "randomFill", "randomFillSync", "randomInt", "randomUUID",
]);
const CRYPTO_PROCESS_STATE_CALLS = new Set([
  "getFips", "secureHeapUsed", "setEngine", "setFips",
]);
const DETERMINISTIC_CRYPTO_CALLS = new Set([
  "createHash", "createHmac", "timingSafeEqual",
]);

function resolvedSymbolName(corpus, declarations) {
  return declarations.length === 0 ? undefined : corpus.declarationName(declarations[0]);
}

function cryptoEffectOfCall(name) {
  if (name !== undefined && CRYPTO_RANDOMNESS_CALLS.has(name)) return "node:crypto:randomness";
  if (name !== undefined && CRYPTO_PROCESS_STATE_CALLS.has(name)) return "node:crypto:process-state";
  return undefined;
}

function calledDeclarations(corpus, expression) {
  if (expression.type === "Identifier") return corpus.declarationsOf(expression);
  if (expression.type === "MemberExpression" && !expression.computed && expression.object.type === "Identifier") {
    const namespace = corpus.declarationsOf(expression.object).find((declaration) => declaration.type === "Program");
    if (namespace) {
      const module = corpus.moduleOf(namespace);
      return module ? corpus.exportedDeclarations(module.fileName, expression.property.name) : [];
    }
  }
  return [];
}

function integrationPortOf(corpus, declarations, root, source) {
  const sourceRelative = slash(path.relative(root, source.fileName));
  const sourceIntegration = /(?:^|\/)src\/integrations\/([^/]+)/u.exec(sourceRelative)?.[1];
  for (const declaration of declarations) {
    const module = corpus.moduleOf(declaration);
    if (!module) continue;
    const relative = slash(path.relative(root, module.fileName));
    const match = /(?:^|\/)src\/integrations\/([^/]+)/u.exec(relative);
    if (match?.[1] !== undefined && match[1] !== sourceIntegration) return `integration:${match[1]}`;
  }
  return undefined;
}

function parameterTypeText(corpus, declaration, parameter) {
  if (parameter.type !== "Identifier") return undefined;
  return corpus.contractOf(declaration).params.find((entry) => entry.name === parameter.name)?.type ?? undefined;
}

function abstractPortName(corpus, declaration, parameter) {
  const module = corpus.moduleOf(declaration);
  const typeText = parameterTypeText(corpus, declaration, parameter);
  if (!module || !typeText) return undefined;
  const [type] = corpus.typeDeclarations(module, typeText);
  if (type === undefined) return undefined;
  const name = corpus.declarationName(type);
  if (["Array", "ReadonlyArray", "Map", "ReadonlyMap", "Set", "ReadonlySet", "Promise", "String", "Number", "Boolean", "Object"].includes(name)) return undefined;
  // JavaScript does not reify an effect row. An arbitrary typedef parameter
  // may be a pure algebra/data view, so its method calls do not by themselves
  // witness a Kleisli port. In the heuristic regime, require the declared type
  // to state a conventional port role in its name and to be a type definition.
  return /(?:Repository|Port|Gateway|Client|Transport|Store|Clock|Logger)$/u.test(name) && type.type === "JSDocTypedef" ? name : undefined;
}

function callableBody(node) {
  if (node.type === "VariableDeclarator" && isFunctionNode(node.init)) return node.init;
  return isFunctionNode(node) ? node : undefined;
}

function callableName(node) {
  if (node.type === "VariableDeclarator" && node.id.type === "Identifier") return node.id.name;
  if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration" || node.type === "FunctionExpression") && node.id) return node.id.name;
  return "<anonymous>";
}

function callableLabel(root, corpus, node) {
  const module = corpus.moduleOf(node);
  const line = module ? lineColumnOf(module.text, node.start).line : 0;
  return `${slash(path.relative(root, module?.fileName ?? ""))}#${callableName(node)}:${line}`;
}

function packageCallable(root, corpus, declaration) {
  const module = corpus.moduleOf(declaration);
  if (!module) return undefined;
  const relative = path.relative(root, module.fileName);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(`${path.sep}node_modules${path.sep}`)) return undefined;
  return callableBody(declaration) === undefined ? undefined : declaration;
}

/** Read only the effects and internal call arrows stated directly by one
 * callable. The finite least closure over those arrows is computed below. */
function directEffectsOf(input, declaration) {
  const corpus = input.checker;
  const parameters = parameterNodes(declaration);
  const parameterNames = new Set(parameters
    .map((parameter) => parameter.type === "Identifier" ? parameter.name : undefined)
    .filter((name) => name !== undefined));
  const abstract = new Set();
  const concrete = new Set();
  const unknown = new Set();
  const internal = new Map();
  let requestResponse = false;
  let continuation = false;
  const module = corpus.moduleOf(declaration);
  const text = module?.text ?? "";

  for (const parameter of parameters) {
    const name = parameter.type === "Identifier" ? parameter.name : "";
    const rendered = parameterTypeText(corpus, declaration, parameter) ?? "any";
    if (/^(?:req|request|res|response)$/iu.test(name) || /(?:Request|Response)/u.test(rendered)) requestResponse = true;
    if (/^(?:next|continuation|proceed)$/iu.test(name)) continuation = true;
  }

  const addInternal = (candidates) => {
    for (const candidate of candidates) {
      const target = packageCallable(input.root, corpus, candidate);
      if (target !== undefined) internal.set(target, Object.freeze({ node: target, label: callableLabel(input.root, corpus, target) }));
    }
  };
  const body = callableBody(declaration);
  const visit = (node) => {
    if (
      node.type === "MemberExpression"
      && !node.computed
      && node.object.type === "Identifier"
      && node.object.name === "globalThis"
      && ["fetch", "setTimeout", "setInterval", "queueMicrotask"].includes(node.property.name)
    ) {
      concrete.add(`host:${node.property.name}`);
    }
    if (node.type === "CallExpression" || node.type === "NewExpression") {
      const expression = node.callee;
      const root = rootIdentifier(expression);
      if (root !== undefined) {
        const directPortCall = expression.type === "MemberExpression"
          && expression.object.type === "Identifier"
          && expression.object.name === root.name;
        if (directPortCall && parameterNames.has(root.name)) {
          const parameter = parameters.find((candidate) => candidate.type === "Identifier" && candidate.name === root.name);
          const port = /^(?:req|request|res|response)$/iu.test(root.name)
            ? "request-response"
            : parameter === undefined ? undefined : abstractPortName(corpus, declaration, parameter);
          if (port !== undefined) abstract.add(port);
        }
        const declarations = calledDeclarations(corpus, expression.type === "MemberExpression" && expression.object.type !== "Identifier" ? root : expression);
        const resolvedCalledName = resolvedSymbolName(corpus, declarations);
        const calledName = resolvedCalledName === undefined || resolvedCalledName === "*"
          ? (expression.type === "MemberExpression" && !expression.computed ? expression.property.name : root.name)
          : resolvedCalledName;
        const importedFrom = importedModuleOf(corpus, root);
        const integration = integrationPortOf(corpus, declarations, input.root, module ?? input.source);
        if (integration !== undefined) concrete.add(integration);
        else if (importedFrom !== undefined) {
          const nodeModule = importedFrom.replace(/^node:/u, "").split("/")[0];
          const cryptoEffect = nodeModule === "crypto" ? cryptoEffectOfCall(calledName) : undefined;
          if (cryptoEffect !== undefined) concrete.add(cryptoEffect);
          else if (EFFECTFUL_NODE_MODULES.has(nodeModule)) concrete.add(`node:${nodeModule}`);
          else if (nodeModule === "crypto" && calledName !== undefined && DETERMINISTIC_CRYPTO_CALLS.has(calledName)) {
            // Known deterministic cryptographic computation is part of the
            // pure carrier, not a host port. Its returned object's methods are
            // followed below as ordinary local calls.
          }
          else {
            const targets = declarations.map((candidate) => packageCallable(input.root, corpus, candidate)).filter((candidate) => candidate !== undefined);
            if (targets.length === 0) unknown.add(`call:${importedFrom}`);
            addInternal(targets);
          }
        } else {
          addInternal(declarations);
        }
        if (["fetch", "setTimeout", "setInterval", "queueMicrotask"].includes(root.name)) concrete.add(`host:${root.name}`);
        if (["Date", "process", "console"].includes(root.name)) concrete.add(`host:${root.name}`);
        if (root.name === "crypto") {
          const cryptoEffect = cryptoEffectOfCall(calledName);
          if (cryptoEffect !== undefined) concrete.add(`host:${cryptoEffect.slice("node:".length)}`);
        }
        if (root.name === "globalThis" && text.slice(node.start, node.end).startsWith("globalThis.crypto.")) {
          const cryptoEffect = cryptoEffectOfCall(calledName);
          if (cryptoEffect !== undefined) concrete.add(`host:${cryptoEffect.slice("node:".length)}`);
        }
      }
    }
  };
  if (body !== undefined) {
    walkJavaScript(body, (node) => {
      if (node !== body && isFunctionNode(node)) return false;
      visit(node);
      return true;
    });
  }
  return Object.freeze({
    concrete: Object.freeze([...concrete].sort()),
    abstract: Object.freeze([...abstract].sort()),
    unknown: Object.freeze([...unknown].sort()),
    requestResponse,
    continuation,
    internal: Object.freeze([...internal.values()].sort((left, right) => left.label.localeCompare(right.label))),
  });
}

function reachesCycle(start, graph) {
  const visited = new Set();
  const active = new Set();
  const visit = (node) => {
    if (active.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    active.add(node);
    for (const target of graph.get(node)?.internal ?? []) if (visit(target.node)) return true;
    active.delete(node);
    return false;
  };
  return visit(start);
}

function reachableCallablesOf(start, graph) {
  const reached = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const target of graph.get(node)?.internal ?? []) {
      if (!reached.has(target.node)) {
        reached.add(target.node);
        queue.push(target.node);
      }
    }
  }
  return reached.size - 1;
}

function closureRoundsOf(start, graph) {
  const visiting = new Set();
  const settled = new Map();
  const visit = (node) => {
    const known = settled.get(node);
    if (known !== undefined) return known;
    if (visiting.has(node)) return 1;
    visiting.add(node);
    let rounds = 0;
    for (const target of graph.get(node)?.internal ?? []) rounds = Math.max(rounds, 1 + visit(target.node));
    visiting.delete(node);
    settled.set(node, rounds);
    return rounds;
  };
  return visit(start);
}

/** Compute the least fixed point of named effects over the package-internal
 * call graph. Monotone set union settles recursive SCCs without erasure or an
 * order-dependent recursion cutoff. */
function effectsOf(input) {
  const cached = transitiveEffectCache.get(input.node);
  if (cached !== undefined) return cached;
  const graph = new Map();
  const queue = [input.node];
  while (queue.length > 0) {
    const declaration = queue.shift();
    if (graph.has(declaration)) continue;
    const direct = directEffectCache.get(declaration) ?? directEffectsOf(input, declaration);
    directEffectCache.set(declaration, direct);
    graph.set(declaration, direct);
    for (const target of direct.internal) if (!graph.has(target.node)) queue.push(target.node);
  }

  const values = new Map([...graph].map(([node, direct]) => [node, {
    concrete: new Set(direct.concrete),
    abstract: new Set(direct.abstract),
    unknown: new Set(direct.unknown),
  }]));
  let rounds = 0;
  while (true) {
    let changed = false;
    for (const [node, direct] of graph) {
      const value = values.get(node);
      for (const target of direct.internal) {
        const inherited = values.get(target.node);
        for (const entry of inherited.concrete) if (!value.concrete.has(entry)) { value.concrete.add(entry); changed = true; }
        for (const entry of inherited.abstract) if (!value.abstract.has(entry)) { value.abstract.add(entry); changed = true; }
        for (const entry of inherited.unknown) if (!value.unknown.has(entry)) { value.unknown.add(entry); changed = true; }
      }
    }
    if (!changed) break;
    rounds += 1;
  }

  for (const [node, direct] of graph) {
    const settled = values.get(node);
    const material = Object.freeze({
      kind: "metroplat.language.jsnode.effect-closure",
      directPorts: Object.freeze([...direct.abstract.map((port) => `abstract:${port}`), ...direct.concrete.map((port) => `concrete:${port}`)].sort()),
      ports: Object.freeze([...settled.abstract].map((port) => `abstract:${port}`).concat([...settled.concrete].map((port) => `concrete:${port}`)).sort()),
      callables: Object.freeze(direct.internal.map((call) => call.label)),
      reachableCallables: reachableCallablesOf(node, graph),
      unresolved: Object.freeze([...settled.unknown].sort()),
      rounds: closureRoundsOf(node, graph),
      recursive: reachesCycle(node, graph),
    });
    const closure = Object.freeze({ ...material, identity: artifactId(material) });
    transitiveEffectCache.set(node, Object.freeze({
      concrete: Object.freeze([...settled.concrete].sort()),
      abstract: Object.freeze([...settled.abstract].sort()),
      unknown: material.unresolved,
      requestResponse: direct.requestResponse,
      continuation: direct.continuation,
      closure,
    }));
  }
  return transitiveEffectCache.get(input.node);
}

function isCallable(node) {
  return isFunctionNode(node) || (node.type === "VariableDeclarator" && isFunctionNode(node.init));
}

/** Translate host syntax into the atomic predicates consumed by the SEN
 * formal context. These are observations, not placement verdicts: all layer
 * names and species formulae remain owned by `lib/language/jsnode`.
 */
function predicateEvidence(
  predicate,
  basis,
  confidence,
) {
  return Object.freeze({ predicate, basis, confidence });
}

function structuralPredicateEvidence(input) {
  const evidence = [];
  if (isCallable(input.node)) {
    if (/^use[A-Z]/u.test(input.name)) evidence.push(predicateEvidence("hook:reified", "identifier-convention", "heuristic"));
    if (/^(?:validate|assert|is[A-Z])/u.test(input.name)) evidence.push(predicateEvidence("admission:checking", "identifier-convention", "heuristic"));
    if (/(?:Command)$/u.test(input.name)) evidence.push(predicateEvidence("port:command", "identifier-convention", "heuristic"));
    if (/^(?:to|from|map)[A-Z]/u.test(input.name) || /Mapper$/u.test(input.name)) evidence.push(predicateEvidence("mapping:reified", "identifier-convention", "heuristic"));
    return Object.freeze(evidence);
  }
  if (input.kind === "interface" || input.kind === "type") {
    evidence.push(predicateEvidence("being:type-object", "syntax", "reified"));
    if (/(?:Request|Response|Input|Output|Dto)$/u.test(input.name)) evidence.push(predicateEvidence("boundary:transfer", "identifier-convention", "heuristic"));
    return Object.freeze(evidence);
  }
  if (input.kind === "class") {
    evidence.push(
      predicateEvidence("being:class", "syntax", "reified"),
      predicateEvidence("coalgebra:reified", "syntax", "reified"),
    );
    const heritage = input.node.type === "ClassDeclaration" && input.node.superClass
      ? `extends ${input.source.text.slice(input.node.superClass.start, input.node.superClass.end)}`
      : "";
    if (/\bError\b/u.test(heritage)) evidence.push(predicateEvidence("error:reified", "type-system", "reified"));
    else if (/Error$/u.test(input.name)) evidence.push(predicateEvidence("error:reified", "identifier-convention", "heuristic"));
    return Object.freeze(evidence);
  }
  evidence.push(predicateEvidence("being:binding", "syntax", "reified"));
  if (/(?:Schema|Contract)$/u.test(input.name)) evidence.push(predicateEvidence("admission:reified", "identifier-convention", "heuristic"));
  if (/(?:Routes?|Router)$/u.test(input.name)) evidence.push(predicateEvidence("automaton:route-table", "identifier-convention", "heuristic"));
  if (/(?:Plugin)$/u.test(input.name)) evidence.push(predicateEvidence("signature:extension", "identifier-convention", "heuristic"));
  if (/(?:State|Store|Registry|Cache)$/u.test(input.name)) evidence.push(predicateEvidence("reference-cell:reified", "identifier-convention", "heuristic"));
  return Object.freeze(evidence);
}

function beingOf(
  input,
  contextStatus,
  effects,
) {
  const ports = effects === undefined
    ? []
    : [...effects.abstract.map((port) => `abstract:${port}`), ...effects.concrete.map((port) => `concrete:${port}`)];
  const effectCount = effects === undefined ? undefined : new Set(ports).size;
  const effectConfidence = effects?.unknown.length === 0 ? "reified" : "heuristic";
  const predicates = [
    predicateEvidence(`form:${input.kind}`, "syntax", "reified"),
    ...(isCallable(input.node) ? [predicateEvidence("being:callable", "syntax", "reified")] : []),
    ...structuralPredicateEvidence(input),
    contextStatus === "anchored" ? predicateEvidence("context:anchored", "subject-anchor", "reified")
      : contextStatus === "cross-cutting" ? predicateEvidence("context:none", "subject-anchor", "reified")
        : predicateEvidence("context:unresolved", "subject-anchor", "heuristic"),
    ...(effects === undefined ? []
      : effects.unknown.length > 0 && effectCount < 2
        ? [predicateEvidence("effects:unknown", "type-system", "heuristic")]
        : effectCount === 0 ? [
          predicateEvidence("effects:none", "type-system", effectConfidence),
          predicateEvidence("model:none", "type-system", effectConfidence),
        ]
          : effectCount === 1 ? [predicateEvidence("effects:one", "type-system", effectConfidence)]
            : [predicateEvidence("effects:multiple", "type-system", effectConfidence)]),
    ...(effects === undefined || effectCount === 0 ? []
      : effects.abstract.length > 0 && effects.concrete.length > 0 ? [predicateEvidence("model:mixed", "type-system", effectConfidence)]
        : effects.abstract.length > 0 ? [predicateEvidence("model:abstract", "type-system", effectConfidence)]
          : [predicateEvidence("model:concrete", "type-system", effectConfidence)]),
    ...(effects?.requestResponse === true ? [predicateEvidence("port:request-response", "identifier-convention", "heuristic")] : []),
    ...(effects?.continuation === true ? [predicateEvidence("continuation:reified", "identifier-convention", "heuristic")] : []),
    ...(effects === undefined ? [] : [predicateEvidence("effects:closed", "type-system", "reified")]),
    ...(effects === undefined ? [] : effects.closure.callables.length === 0
      ? [predicateEvidence("composition:direct", "type-system", "reified")]
      : [predicateEvidence("composition:composed", "type-system", "reified")]),
    ...(effects?.closure.recursive === true ? [predicateEvidence("composition:recursive", "type-system", "reified")] : []),
    ...ports.map((port) => predicateEvidence(`port:${port}`, "type-system", effectConfidence)),
    ...(effects?.unknown.map((port) => predicateEvidence(`unresolved:${port}`, "type-system", "heuristic")) ?? []),
  ];
  return Object.freeze({
    kind: "metroplat.language.jsnode.being",
    subject: `${slash(path.relative(input.root, input.source.fileName))}#${input.name}:${lineColumnOf(input.source.text, input.node.start).line}`,
    predicates: Object.freeze([...new Map(predicates.map((evidence) => [
      `${evidence.predicate}\u0000${evidence.basis}\u0000${evidence.confidence}`,
      evidence,
    ])).values()].sort((left, right) => left.predicate.localeCompare(right.predicate) || left.basis.localeCompare(right.basis))),
    ports: Object.freeze([...ports].sort()),
    ...(effects === undefined ? {} : { effectClosure: effects.closure }),
  });
}

function primaryTaxon(readings) {
  // More structurally specific species precede their general carrier. A
  // boundary-transfer object is still a type object; an Error is still a
  // class; a schema, route table, plugin, or state cell is still a binding.
  const priority = [
    "middleware", "controller", "command", "service", "repository-port", "adapter",
    "validator", "mapper", "hook", "domain-morphism", "generic-utility",
    "schema", "boundary-transfer-object", "type-object", "error", "entity",
    "route-table", "plugin", "state-binding", "domain-value", "generic-value",
  ];
  for (const name of priority) {
    const reading = readings.find((candidate) => candidate.taxon === name && candidate.reading === "held");
    if (reading !== undefined) return reading;
  }
  return undefined;
}

function classification(input, contextStatus)

 {
  const effects = isCallable(input.node) ? effectsOf(input) : undefined;
  const being = beingOf(input, contextStatus, effects);
  const taxa = readNodeBeingTaxonomy(being);
  const taxon = primaryTaxon(taxa);
  const confidence = taxon === undefined ? "heuristic" : nodeBeingTaxonConfidence(being, taxon.taxon);
  const callableEffects = effects;
  const signals = [
    ...(callableEffects === undefined ? [] : [
      `concrete-effects:${callableEffects.concrete.length}`,
      `abstract-ports:${callableEffects.abstract.length}`,
      `unresolved-calls:${callableEffects.unknown.length}`,
      ...callableEffects.concrete.map((effect) => `concrete:${effect}`),
      ...callableEffects.abstract.map((effect) => `port:${effect}`),
    ]),
    ...(taxon === undefined ? ["JSNode being taxon unresolved"] : [`taxon:${taxon.taxon}`, `taxon-reading:${taxon.reading}`]),
  ];
  return Object.freeze({
    signals: Object.freeze(signals),
    confidence,
    being,
    ...(taxon === undefined ? {} : { taxon }),
  });
}

/**
 * Derive the research note's two independent placement axes. Existing path
 * names are observations of the current carrier only. Semantic subjects come
 * from addressed JSNode subject anchors; target layers come from the SEN-read
 * being taxonomy, never from the directory being judged.
 */
/** Verify one anchor presentation and retain its index for this read only. */
export function createPlacementReader(subjectAnchors) {
  const anchors = subjectsByDeclaration(subjectAnchors);
  return {
    subjectsByDeclaration: anchors,
    read: (input) => readPlacement(input, anchors),
  };
}

export function placementOfSymbol(input) {
  return createPlacementReader(input.subjectAnchors).read(input);
}

function readPlacement(input, anchors) {
  const reference = declarationReference(input.root, input.source, input.name);
  const declaration = new Set(reference === undefined ? [] : anchors.get(reference) ?? []);
  const signature = input.checker === undefined ? undefined : signatureOf(input.checker, input.node);
  const codomain = new Set();
  const module = input.checker?.moduleOf(input.node);
  if (signature !== undefined) {
    for (const subject of typeSubjects(input.root, input.checker, module, signature.returns, anchors)) codomain.add(subject);
  }
  const domain = new Set();
  if (signature !== undefined) {
    for (const parameter of signature.params) {
      for (const subject of typeSubjects(input.root, input.checker, module, parameter.type, anchors)) domain.add(subject);
    }
  }
  if (signature === undefined && (input.kind === "interface" || input.kind === "type" || input.kind === "class")) {
    if (reference !== undefined) for (const subject of anchors.get(reference) ?? []) domain.add(subject);
  }
  const candidates = declaration.size > 0 ? declaration : codomain.size > 0 ? codomain : domain;
  const ordered = [...candidates].sort();
  const context = ordered.length === 1 ? ordered[0] : undefined;
  const contextStatus = ordered.length === 0
    ? input.subjectAnchorCoverage === "complete" ? "cross-cutting" : "unknown"
    : ordered.length === 1 ? "anchored"
      : "contested";
  const contextReason = declaration.size > 0
    ? "stated declaration subject anchor"
    : codomain.size > 0 ? "stated codomain subject anchor"
    : domain.size > 0 ? "stated domain subject anchor"
      : input.subjectAnchorCoverage === "complete"
        ? "the complete subject-anchor vocabulary has no anchor in the declaration domain or codomain; the being is cross-cutting"
        : "the partial subject-anchor vocabulary has no observed anchor in the declaration domain or codomain; subject context remains unknown";
  const classified = classification(input, contextStatus);
  const actual = pathForm(input.root, input.source.fileName);
  const placementObstructions = [
    ...(classified.taxon === undefined ? [
      "no JSNode species has held evidence; unknown or contested taxonomy cannot authorize a package layer",
    ] : []),
    ...(contextStatus === "unknown" ? [contextReason] : []),
    ...(contextStatus === "contested" ? [
      `multiple subject anchors prevent a single context coordinate: ${ordered.join(", ")}`,
    ] : []),
  ];
  const ambiguityCauses = [
    ...(contextStatus === "unknown" ? [contextReason] : []),
    ...(ordered.length > 1 ? [`multiple ${contextReason}s: ${ordered.join(", ")}`] : []),
    ...(classified.taxon === undefined ? ["JSNode being taxon unresolved"] : []),
    ...(actual.subjects.length > 1 ? [`nested package subjects are not yet represented by the placement pair: ${actual.subjects.join("/")}`] : []),
  ];
  const nearest = classified.taxon
    ?? [...readNodeBeingTaxonomy(classified.being)].sort((left, right) => left.defect - right.defect || left.taxon.localeCompare(right.taxon))[0];
  const being = Object.freeze({
    ...classified.being,
    confidence: classified.confidence,
    formula: nodeBeingSpeciesFormula(classified.being),
    taxon: classified.taxon?.taxon ?? "unresolved",
    taxonIdentity: nearest.taxonIdentity,
    taxonReading: classified.taxon?.reading ?? nearest.reading,
    taxonomicDefect: nearest.defect,
    taxonSupport: nearest.support,
    taxonMissing: nearest.missing,
    taxonObstructions: nearest.obstructions,
  });
  const observed = {
    contextStatus,
    ...(context === undefined ? {} : { context }),
    contextReason,
    signals: Object.freeze([...classified.signals]),
    confidence: classified.confidence,
    ambiguous: ambiguityCauses.length > 0,
    ambiguityCauses: Object.freeze(ambiguityCauses),
    actualPackageRegion: actual.region,
    ...(actual.layer === undefined ? {} : { actualLayer: actual.layer }),
    ...(actual.context === undefined ? {
      ...(contextStatus === "cross-cutting" ? { contextMatches: true } : {}),
    } : {
      actualContext: actual.context,
      ...(contextStatus === "unknown" || contextStatus === "contested"
        ? {}
        : { contextMatches: contextStatus === "anchored" && actual.context === context }),
    }),
  };
  const placement = placementObstructions.length > 0
    ? Object.freeze({
      kind: "metroplat.monitoring.source-code.placement:obstruction",
      ...observed,
      ambiguous: true,
      obstructions: Object.freeze(placementObstructions),
    })
    : (() => {
      const layer = classified.taxon.layer;
      const realizesHostBoundary = layer === "adapters" || layer === "clients" || layer === "plugins";
      const belongsToAnchoredIntegration = actual.region === "integration"
        && contextStatus === "anchored"
        && actual.context === context;
      const packageRegion = realizesHostBoundary || belongsToAnchoredIntegration
        ? "integration"
        : "source";
      const packageRegionReason = realizesHostBoundary
        ? `${layer} realizes a concrete host integration boundary`
        : belongsToAnchoredIntegration
          ? `${context} is an anchored integration context; its ${layer} layer remains with that complete boundary`
          : "the measured being neither realizes a concrete host integration boundary nor belongs to an anchored integration context";
      return Object.freeze({
        kind: "metroplat.monitoring.source-code.placement:witness",
        ...observed,
        layer,
        packageRegion,
        packageRegionReason,
        ...(actual.layer === undefined ? {} : { layerMatches: actual.layer === layer }),
      });
    })();
  return Object.freeze({ placement, being });
}

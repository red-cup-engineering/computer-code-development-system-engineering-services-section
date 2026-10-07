/**
 * @packageDocumentation
 *
 * monitoring/source-code/topology - live package source-tree scale and import topology.
 *
 * This monitor consumes the source-code filesystem adapter's one traversal of a
 * package and parses each file through the TypeScript compiler's own AST. Structural
 * facts (line counts, declared functions, declared classes, import edges) are
 * read from the parse tree, not pattern-matched from text — the same discipline
 * src/integrations/anthropic/services and src/integrations/openai/codex/services use for their host formats.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";
import { jsdocOf, lineColumnOf, parseJavaScript, parseJsdoc, walkJavaScript } from "@red-cup-engineering/javascript-node-services-section/javascript-parser";

import {
  moduleTopologyReadContract as moduleTopologyReadSchemaContract,
  moduleTopologyPageContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/schema";
import { nodePackageLayoutConventionOfPath, createPlacementReader } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/placement";

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { nodeDeclarationReference, nodeBeingFormalContext, nodeBeingTaxa, nodeSubjectAnchor, nodeSubjectJSDocTag, readNodeBeingSpeciesConcepts, readNodeSubjectAnchor } from "@red-cup-engineering/communicating/language/jsnode/taxonomy";
import { projectNodeBeingDocumentation } from "@red-cup-engineering/communicating/language/jsnode/documentation";

import {
  DEFAULT_SOURCE_DIRECTORIES,
  DEFAULT_SOURCE_FILE_LIMIT,
  readSourceModuleCorpus,
  sourceModuleProgram,
  sourceModuleSpecifierPath,
  sourceModuleRelativePath,
  sourceModuleSyntax,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/filesystem";
import { moduleCohesionOfCorpus } from "../cohesion/service.mjs";

function countLines(content) {
  const lines = content.split("\n");
  const loc = lines.length;
  const sloc = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
  }).length;
  return Object.freeze({ loc, sloc });
}

function hasPlacementWitness(symbol) {
  return symbol.placement.kind === "metroplat.monitoring.source-code.placement:witness";
}

const declarationOfStatement = (statement) =>
  (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") && statement.declaration ? statement.declaration : statement;
const isExportStatement = (statement) => statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration";
const moduleName = (node) => (node.type === "Identifier" ? node.name : node.value);

/** The first non-empty, non-`@tag` line of a node's leading `/** … *\/` comment,
 *  if it has one — the same summary a human would read first in an editor. */
function jsDocSummaryOf(source, node) {
  const block = jsdocOf(source.program, node);
  if (!block) return undefined;
  for (const line of block.value.slice(1).split("\n")) {
    const trimmed = line.replace(/^\s*\*\s?/, "").trim();
    if (trimmed.length > 0 && !trimmed.startsWith("@")) return trimmed;
  }
  return undefined;
}

/** Resolve one import specifier to the module-path form used elsewhere in this
 *  read (relative imports normalized to the source's own directory; external
 *  package specifiers passed through unchanged). */
function resolveImportModule(corpus, specifier, sourcePath) {
  if (!specifier.startsWith(".")) return specifier;
  const resolved = sourceModuleSpecifierPath(corpus, specifier, sourcePath);
  return resolved.split(path.sep).join("/");
}

/** Every local name a file's import declarations bind (default, namespace, and
 *  named bindings, aliases included), mapped to the module it was imported
 *  from — the missing link between "this file imports X" (file-level) and
 *  "this specific function/class uses X" (symbol-level). */
function collectImportBindings(corpus, source, sourcePath) {
  const bindings = new Map();
  for (const statement of source.program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const moduleValue = resolveImportModule(corpus, statement.source.value, sourcePath);
    for (const specifier of statement.specifiers) {
      const imported = specifier.type === "ImportDefaultSpecifier" ? "default" : specifier.type === "ImportNamespaceSpecifier" ? "*" : moduleName(specifier.imported);
      bindings.set(specifier.local.name, Object.freeze({ module: moduleValue, imported }));
    }
  }
  return bindings;
}

/** Exact public names projected by `export ... from` declarations. This makes
 * package assembly visible as evidence instead of collapsing a barrel into an
 * unexplained module edge. `*` denotes the source module's complete export set. */
function collectReexports(corpus, source, sourcePath) {
  const reexports = [];
  for (const statement of source.program.body) {
    if (statement.type === "ExportAllDeclaration") {
      const module = resolveImportModule(corpus, statement.source.value, sourcePath);
      reexports.push(Object.freeze({ module, imported: "*", exported: statement.exported ? moduleName(statement.exported) : "*", typeOnly: false }));
    } else if (statement.type === "ExportNamedDeclaration" && statement.source) {
      const module = resolveImportModule(corpus, statement.source.value, sourcePath);
      for (const specifier of statement.specifiers) {
        reexports.push(Object.freeze({ module, imported: moduleName(specifier.local), exported: moduleName(specifier.exported), typeOnly: false }));
      }
    }
  }
  return Object.freeze(reexports);
}

/** Every name a top-level declaration in this file binds, exported or not —
 *  a symbol calling a private helper is still a real same-file dependency. */
function collectTopLevelLocalNames(source) {
  const names = new Set();
  for (const outer of source.program.body) {
    const statement = declarationOfStatement(outer);
    if ((statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") && statement.id) names.add(statement.id.name);
    else if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations) if (declaration.id.type === "Identifier") names.add(declaration.id.name);
    }
  }
  return names;
}

/** Every identifier a declaration's own subtree references, excluding the
 *  declaration's own name — an approximate but syntax-grounded read of "what
 *  does this specific symbol touch," not the whole file's import list. */
function referencedIdentifierNames(node, ownName) {
  const names = new Set();
  walkJavaScript(node, (child) => {
    if (child !== node && child.type === "Identifier" && child.name !== ownName) names.add(child.name);
  });
  return names;
}

function pushSymbol(
  symbols,
  source,
  statement,
  node,
  name,
  kind,
  exported,
  importBindings,
  localNames,
  checker,
  root,
  readPlacement,
  subjectAnchorCoverage,
) {
  const line = lineColumnOf(source.text, statement.start).line;
  const summary = jsDocSummaryOf(source, statement);
  const referenced = referencedIdentifierNames(node, name);
  const dependsOnModules = new Set();
  const dependsOnImportedSymbols = new Set();
  const dependsOnLocal = new Set();
  for (const identifier of referenced) {
    const binding = importBindings.get(identifier);
    if (binding !== undefined) {
      dependsOnModules.add(binding.module);
      dependsOnImportedSymbols.add(`${binding.module}#${binding.imported}`);
    }
    else if (localNames.has(identifier)) dependsOnLocal.add(identifier);
  }
  const classified = readPlacement({
    checker,
    root,
    source,
    node,
    name,
    kind,
    dependsOnModules: Object.freeze([...dependsOnModules].sort()),
    subjectAnchorCoverage,
  });
  symbols.push(Object.freeze({
    name,
    kind,
    line,
    exported,
    ...(summary === undefined ? {} : { summary }),
    dependsOnModules: Object.freeze([...dependsOnModules].sort()),
    dependsOnImportedSymbols: Object.freeze([...dependsOnImportedSymbols].sort()),
    dependsOnLocal: Object.freeze([...dependsOnLocal].sort()),
    referencedBySymbols: Object.freeze([]),
    being: classified.being,
    placement: classified.placement,
  }));
}

/** Every top-level declaration's name, visibility, kind, line, doc summary, and
 *  its own symbol-level dependency footprint (which imported modules and
 *  which same-file helpers ITS body actually references) — read from the
 *  same syntax pass as the counts, so "what does this file have, and does it
 *  actually belong together" is answerable per symbol, not just per file. */
function readFileSymbols(
  corpus,
  source,
  sourcePath,
  checker,
  root,
  readPlacement,
  subjectAnchorCoverage,
) {
  const importBindings = collectImportBindings(corpus, source, sourcePath);
  const localNames = collectTopLevelLocalNames(source);
  const symbols = [];
  for (const outer of source.program.body) {
    const exported = isExportStatement(outer);
    const node = declarationOfStatement(outer);
    if (node.type === "FunctionDeclaration" && node.id) {
      pushSymbol(symbols, source, outer, node, node.id.name, "function", exported, importBindings, localNames, checker, root, readPlacement, subjectAnchorCoverage);
    } else if (node.type === "ClassDeclaration" && node.id) {
      pushSymbol(symbols, source, outer, node, node.id.name, "class", exported, importBindings, localNames, checker, root, readPlacement, subjectAnchorCoverage);
    } else if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        if (declaration.id.type === "Identifier") {
          pushSymbol(symbols, source, outer, declaration, declaration.id.name, "const", exported, importBindings, localNames, checker, root, readPlacement, subjectAnchorCoverage);
        }
      }
    }
  }
  return Object.freeze(symbols);
}

const FUNCTION_NODE_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

function readFileTopology(
  corpus,
  source,
  sourcePath,
  checker,
  root,
  readPlacement,
  subjectAnchorCoverage,
) {
  let functions = 0;
  let classes = 0;
  const imports = [];
  const externalImports = [];
  walkJavaScript(source.program, (node) => {
    if (FUNCTION_NODE_TYPES.has(node.type)) functions += 1;
    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") classes += 1;
    if ((node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) {
      const specifier = node.source.value;
      if (specifier.startsWith(".")) imports.push(resolveImportModule(corpus, specifier, sourcePath).split(path.sep).join("/"));
      else externalImports.push(specifier);
    }
  });

  const { loc, sloc } = countLines(source.text);
  const summary = source.program.body.length === 0
    ? undefined
    : jsDocSummaryOf(source, source.program.body[0]);
  return Object.freeze({
    ...(summary === undefined ? {} : { summary }),
    loc,
    sloc,
    functions,
    classes,
    imports: Object.freeze([...new Set(imports)].sort()),
    typeImports: Object.freeze([]),
    externalImports: Object.freeze([...new Set(externalImports)].sort()),
    externalTypeImports: Object.freeze([]),
    reexports: collectReexports(corpus, source, sourcePath),
    symbols: checker === undefined
      ? Object.freeze([])
      : readFileSymbols(corpus, source, sourcePath, checker, root, readPlacement, subjectAnchorCoverage),
  });
}

function jsdocTagsOf(source, node) {
  const block = jsdocOf(source.program, node);
  return block ? parseJsdoc(block.value).tags : [];
}

function declaredSubjects(source, node, coordinate) {
  const subjects = [];
  for (const tag of jsdocTagsOf(source, node)) {
    if (tag.tag !== nodeSubjectJSDocTag) continue;
    const subject = (tag.text ?? "").trim();
    if (subject.length === 0) throw new TypeError(`${coordinate} has an empty @${nodeSubjectJSDocTag} declaration`);
    subjects.push(subject);
  }
  return Object.freeze([...new Set(subjects)].sort());
}

/** Translate JSDoc-declared JSNode subjects from the admitted source corpus
 * into the same addressed language artifacts callers may pass. */
function sourceSubjectAnchors(corpus, program) {
  const anchors = new Map();
  const admit = (module, symbol, subjects) => {
    const declaration = nodeDeclarationReference(module, symbol);
    for (const subject of subjects) {
      const anchor = nodeSubjectAnchor(subject, [declaration]);
      anchors.set(anchor.identity, anchor);
    }
  };
  for (const file of corpus.files) {
    const source = program.modules.get(file.absolutePath);
    if (source === undefined) continue;
    const firstStatement = source.program.body[0];
    const moduleCoordinate = `${file.path}:1`;
    const moduleSubjects = firstStatement !== undefined
      && jsdocTagsOf(source, firstStatement).some((tag) => tag.tag === "packageDocumentation")
      ? declaredSubjects(source, firstStatement, moduleCoordinate)
      : Object.freeze([]);
    const moduleDeclarations = [];
    const record = (symbol, subjects) => {
      moduleDeclarations.push(nodeDeclarationReference(file.path, symbol));
      admit(file.path, symbol, subjects);
    };
    for (const outer of source.program.body) {
      const coordinate = `${file.path}:${lineColumnOf(source.text, outer.start).line}`;
      const statementSubjects = outer === firstStatement && moduleSubjects.length > 0
        ? Object.freeze([])
        : declaredSubjects(source, outer, coordinate);
      const statement = declarationOfStatement(outer);
      if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") {
        if (statement.id) record(statement.id.name, statementSubjects);
      } else if (statement.type === "VariableDeclaration") {
        for (const declaration of statement.declarations) {
          if (declaration.id.type !== "Identifier") continue;
          record(declaration.id.name, statementSubjects);
        }
      } else if (statementSubjects.length > 0) {
        throw new TypeError(`${coordinate} attaches @${nodeSubjectJSDocTag} to an unsupported top-level declaration`);
      }
    }
    if (moduleSubjects.length > 0 && moduleDeclarations.length === 0) {
      throw new TypeError(`${moduleCoordinate} declares a module @${nodeSubjectJSDocTag} without a top-level declaration`);
    }
    for (const subject of moduleSubjects) {
      const anchor = nodeSubjectAnchor(subject, moduleDeclarations);
      anchors.set(anchor.identity, anchor);
    }
  }
  return Object.freeze([...anchors.values()].sort((left, right) => left.identity.localeCompare(right.identity)));
}

/** Read the finite set of nesting colors actually carried by the package.
 * Zero colors is knowledge-bottom; one is a held convention; more than one is
 * contested evidence and therefore cannot authorize a target path. */
function layoutConventionReading(
  root,
  files,
) {
  const pathsByConvention = new Map();
  for (const file of files) {
    const convention = nodePackageLayoutConventionOfPath(root, file.absolutePath);
    if (convention === undefined) continue;
    const paths = pathsByConvention.get(convention);
    if (paths === undefined) pathsByConvention.set(convention, [file.path]);
    else paths.push(file.path);
  }
  const candidates = Object.freeze([...pathsByConvention.keys()].sort());
  const observations = Object.freeze(candidates.map((convention) => Object.freeze({
    convention,
    paths: Object.freeze([...pathsByConvention.get(convention)].sort()),
  })));
  const reading = candidates.length === 0 ? "unknown"
    : candidates.length === 1 ? "held"
      : "contested";
  const reasons = Object.freeze(reading === "unknown"
    ? ["the observed tree carries no unambiguous context/layer nesting convention"]
    : reading === "held"
      ? [`every observed context/layer nesting witness uses ${candidates[0]}`]
      : [`the observed tree carries incompatible nesting conventions: ${candidates.join(", ")}`]);
  const material = Object.freeze({
    kind: "metroplat.monitoring.source-code.layout-convention",
    reading,
    ...(reading === "held" ? { convention: candidates[0] } : {}),
    candidates,
    observations,
    reasons,
  });
  return Object.freeze({ ...material, identity: artifactId(material) });
}

/** One graph color for one proposed carrier: subject × layer × host region. */
function placementColorOf(symbol) {
  return [
    symbol.placement.packageRegion,
    symbol.placement.context ?? `_${symbol.placement.contextStatus}`,
    symbol.placement.layer,
  ].join("|");
}

/**
 * FOUR-valued metry over every formulaic Node species in the observed tree.
 * Counts are derived from each being's content-addressed FCA formula rather
 * than from its current path or the single primary placement projection.
 */
function speciesCensusOf(symbols) {
  const count = (taxon, reading) =>
    symbols.filter((symbol) => symbol.being.formula[reading].includes(taxon)).length;
  return Object.freeze(nodeBeingTaxa.map((taxon) => Object.freeze({
    taxon: taxon.name,
    taxonIdentity: taxon.identity,
    layer: taxon.layer,
    held: count(taxon.name, "held"),
    denied: count(taxon.name, "denied"),
    contested: count(taxon.name, "contested"),
    unknown: count(taxon.name, "unknown"),
  })));
}

/** Every maximal runtime-import component whose members mutually depend on one
 * another. Unlike the causal-order obstruction, this reports the complete
 * dependency knot rather than selecting one representative cycle witness. */
function directedCyclicComponents(
  modules,
) {
  const paths = new Set(modules.map((module) => module.path));
  const edges = new Map(modules.map((module) => [
    module.path,
    Object.freeze(module.imports.filter((target) => paths.has(target)).sort()),
  ]));
  const indexByPath = new Map();
  const lowlinkByPath = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let nextIndex = 0;

  const connect = (modulePath) => {
    const index = nextIndex;
    nextIndex += 1;
    indexByPath.set(modulePath, index);
    lowlinkByPath.set(modulePath, index);
    stack.push(modulePath);
    onStack.add(modulePath);
    for (const target of edges.get(modulePath) ?? []) {
      if (!indexByPath.has(target)) {
        connect(target);
        lowlinkByPath.set(modulePath, Math.min(lowlinkByPath.get(modulePath), lowlinkByPath.get(target)));
      } else if (onStack.has(target)) {
        lowlinkByPath.set(modulePath, Math.min(lowlinkByPath.get(modulePath), indexByPath.get(target)));
      }
    }
    if (lowlinkByPath.get(modulePath) !== indexByPath.get(modulePath)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== modulePath);
    component.sort();
    if (component.length > 1 || (edges.get(modulePath) ?? []).includes(modulePath)) components.push(component);
  };

  for (const modulePath of [...paths].sort()) if (!indexByPath.has(modulePath)) connect(modulePath);
  return Object.freeze(components
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map((component) => Object.freeze(component)));
}

/** Read one package's own source-tree scale and import dependency graph from the TypeScript AST. */
export function readModuleTopology(root, options = {}) {
  const rootAbs = path.resolve(root);
  const sourceDirs = options.sourceDirs ?? DEFAULT_SOURCE_DIRECTORIES;
  const maxFiles = options.maxFiles ?? DEFAULT_SOURCE_FILE_LIMIT;
  return moduleTopologyOfCorpus(readSourceModuleCorpus(rootAbs, sourceDirs, maxFiles, options), {
    ...(options.subjectAnchors === undefined ? {} : { subjectAnchors: options.subjectAnchors }),
    ...(options.subjectAnchorCoverage === undefined ? {} : { subjectAnchorCoverage: options.subjectAnchorCoverage }),
  });
}

/** Read topology from one already-admitted corpus without repeating filesystem I/O. */
export function moduleTopologyOfCorpus(
  corpus,
  options

 = {},
) {
  const rootAbs = corpus.root;
  const includeSymbols = options.includeSymbols ?? true;
  const program = includeSymbols ? sourceModuleProgram(corpus) : undefined;
  const cohesionByPath = new Map(moduleCohesionOfCorpus(corpus, { minSymbols: 1 }).modules
    .map((moduleEntry) => [moduleEntry.path, moduleEntry.components]));
  const anchorByIdentity = new Map();
  if (program !== undefined) for (const anchor of sourceSubjectAnchors(corpus, program)) anchorByIdentity.set(anchor.identity, anchor);
  for (const candidate of options.subjectAnchors ?? []) {
    const anchor = readNodeSubjectAnchor(candidate);
    anchorByIdentity.set(anchor.identity, anchor);
  }
  const subjectAnchors = Object.freeze([...anchorByIdentity.values()].sort((left, right) => left.identity.localeCompare(right.identity)));
  const { read: readPlacement, subjectsByDeclaration: anchoredSubjectsByDeclaration } = createPlacementReader(subjectAnchors);
  const subjectAnchorIdentities = Object.freeze(subjectAnchors.map((anchor) => anchor.identity));
  const subjectAnchorCoverage = options.subjectAnchorCoverage ?? "partial";
  const layoutConvention = layoutConventionReading(rootAbs, corpus.files);
  const checker = program;
  const modulesWithoutConsumers = [];
  let totalLoc = 0;
  let totalSloc = 0;
  let totalFunctions = 0;
  let totalClasses = 0;

  for (const file of corpus.files) {
    const source = program === undefined
      ? Object.freeze({ fileName: file.absolutePath, text: file.content, program: parseJavaScript(file.content) })
      : sourceModuleSyntax(program, file);
    const topology = readFileTopology(
      corpus,
      source,
      file.absolutePath.split(path.sep).join("/"),
      checker,
      rootAbs,
      readPlacement,
      subjectAnchorCoverage,
    );
    const symbols = Object.freeze(topology.symbols.map((symbol) => Object.freeze({
      ...symbol,
      dependsOnModules: Object.freeze(symbol.dependsOnModules.map(
        (ref) => path.isAbsolute(ref) ? sourceModuleRelativePath(rootAbs, ref) : ref,
      )),
      dependsOnImportedSymbols: Object.freeze(symbol.dependsOnImportedSymbols.map((ref) => {
        const separator = ref.lastIndexOf("#");
        const module = separator < 0 ? ref : ref.slice(0, separator);
        const name = separator < 0 ? "" : ref.slice(separator + 1);
        const normalized = path.isAbsolute(module) ? sourceModuleRelativePath(rootAbs, module) : module;
        return name.length === 0 ? normalized : `${normalized}#${name}`;
      })),
    })));
    totalLoc += topology.loc;
    totalSloc += topology.sloc;
    totalFunctions += topology.functions;
    totalClasses += topology.classes;
    const symbolClusters = cohesionByPath.get(file.path) ?? Object.freeze([]);
    const placedSymbols = symbols.filter(hasPlacementWitness);
    const subjectAnchorCounts = symbols.map((symbol) =>
      anchoredSubjectsByDeclaration.get(`${file.path}#${symbol.name}`)?.size ?? 0);
    const placementColors = Object.freeze([...new Set(placedSymbols.map(placementColorOf))].sort());
    modulesWithoutConsumers.push(Object.freeze({
      path: file.path,
      ...(topology.summary === undefined ? {} : { summary: topology.summary }),
      identity: file.identity,
      loc: topology.loc,
      sloc: topology.sloc,
      functions: topology.functions,
      classes: topology.classes,
      imports: Object.freeze(topology.imports.map((abs) => sourceModuleRelativePath(rootAbs, abs))),
      typeImports: Object.freeze(topology.typeImports.map((abs) => sourceModuleRelativePath(rootAbs, abs))),
      externalImports: topology.externalImports,
      externalTypeImports: topology.externalTypeImports,
      reexports: Object.freeze(topology.reexports.map((reexport) => Object.freeze({
        ...reexport,
        module: path.isAbsolute(reexport.module)
          ? sourceModuleRelativePath(rootAbs, reexport.module)
          : reexport.module,
      }))),
      symbols,
      symbolClusters,
      subjectAnchoredSymbols: subjectAnchorCounts.filter((count) => count > 0).length,
      subjectUnanchoredSymbols: subjectAnchorCounts.filter((count) => count === 0).length,
      multiplySubjectAnchoredSymbols: subjectAnchorCounts.filter((count) => count > 1).length,
      placementObstructions: symbols.length - placedSymbols.length,
      placementLayers: Object.freeze([...new Set(placedSymbols.map((symbol) => symbol.placement.layer))].sort()),
      placementContexts: Object.freeze([...new Set(symbols.flatMap((symbol) => symbol.placement.context === undefined ? [] : [symbol.placement.context]))].sort()),
      placementColors,
      carrierChromaticNumber: placementColors.length,
      mixedPlacement: placementColors.length > 1,
    }));
  }

  const runtimeConsumers = new Map();
  const typeConsumers = new Map();
  const symbolConsumers = new Map();
  for (const moduleEntry of modulesWithoutConsumers) {
    for (const target of moduleEntry.imports) {
      const consumers = runtimeConsumers.get(target) ?? [];
      consumers.push(moduleEntry.path);
      runtimeConsumers.set(target, consumers);
    }
    for (const target of moduleEntry.typeImports) {
      const consumers = typeConsumers.get(target) ?? [];
      consumers.push(moduleEntry.path);
      typeConsumers.set(target, consumers);
    }
    for (const symbol of moduleEntry.symbols) {
      for (const target of symbol.dependsOnImportedSymbols) {
        const consumers = symbolConsumers.get(target) ?? [];
        consumers.push(`${moduleEntry.path}#${symbol.name}`);
        symbolConsumers.set(target, consumers);
      }
    }
  }
  const modules = modulesWithoutConsumers.map((moduleEntry) => Object.freeze({
    ...moduleEntry,
    symbols: Object.freeze(moduleEntry.symbols.map((symbol) => Object.freeze({
      ...symbol,
      referencedBySymbols: Object.freeze([...(symbolConsumers.get(`${moduleEntry.path}#${symbol.name}`) ?? [])].sort()),
    }))),
    importedBy: Object.freeze([...(runtimeConsumers.get(moduleEntry.path) ?? [])].sort()),
    typeImportedBy: Object.freeze([...(typeConsumers.get(moduleEntry.path) ?? [])].sort()),
  }));

  const modulesWithDisconnectedSymbolClusters = modules.filter((moduleEntry) => moduleEntry.symbolClusters.length > 1).length;
  const maxSymbolClusters = modules.reduce((max, moduleEntry) => Math.max(max, moduleEntry.symbolClusters.length), 0);
  const cyclicComponents = directedCyclicComponents(modules);
  const allSymbols = modules.flatMap((moduleEntry) => moduleEntry.symbols);
  const symbols = allSymbols.length;
  const subjectAnchoredSymbols = modules.reduce((total, moduleEntry) => total + moduleEntry.subjectAnchoredSymbols, 0);
  const subjectUnanchoredSymbols = modules.reduce((total, moduleEntry) => total + moduleEntry.subjectUnanchoredSymbols, 0);
  const multiplySubjectAnchoredSymbols = modules.reduce((total, moduleEntry) => total + moduleEntry.multiplySubjectAnchoredSymbols, 0);
  const speciesContext = nodeBeingFormalContext(allSymbols.map((symbol) => symbol.being.formula));
  const speciesConcepts = readNodeBeingSpeciesConcepts(speciesContext);
  const speciesCensus = speciesCensusOf(allSymbols);
  const speciesFormulas = speciesContext.formulas.length;
  const placementObstructions = allSymbols.filter((symbol) =>
    symbol.placement.kind === "metroplat.monitoring.source-code.placement:obstruction").length;
  const ambiguousPlacements = allSymbols.filter((symbol) => symbol.placement.ambiguous).length;
  const layerMismatches = allSymbols.filter((symbol) =>
    hasPlacementWitness(symbol) && symbol.placement.layerMatches === false).length;
  const contextMismatches = allSymbols.filter((symbol) => symbol.placement.contextMatches === false).length;
  const mixedPlacementModules = modules.filter((moduleEntry) => moduleEntry.mixedPlacement).length;
  const multicoloredCarriers = modules.filter((moduleEntry) => moduleEntry.carrierChromaticNumber > 1).length;
  const maxCarrierChromaticNumber = modules.reduce((maximum, moduleEntry) => Math.max(maximum, moduleEntry.carrierChromaticNumber), 0);
  const crossCuttingContexts = allSymbols.filter((symbol) => symbol.placement.contextStatus === "cross-cutting").length;
  const unresolvedContexts = allSymbols.filter((symbol) =>
    symbol.placement.contextStatus === "unknown" || symbol.placement.contextStatus === "contested").length;
  const observation = artifactId(Object.freeze({
    source: corpus.source,
    subjectAnchors: subjectAnchorIdentities,
    subjectAnchorCoverage,
    layoutConvention,
    modules: Object.freeze(modules.map((moduleEntry) => artifactId(moduleEntry))),
    loc: totalLoc,
    sloc: totalSloc,
    functions: totalFunctions,
    classes: totalClasses,
    modulesWithDisconnectedSymbolClusters,
    maxSymbolClusters,
    cyclicComponents,
    symbols,
    subjectAnchoredSymbols,
    subjectUnanchoredSymbols,
    multiplySubjectAnchoredSymbols,
    speciesContext,
    speciesConcepts,
    speciesCensus,
    speciesFormulas,
    placementObstructions,
    ambiguousPlacements,
    layerMismatches,
    contextMismatches,
    mixedPlacementModules,
    multicoloredCarriers,
    maxCarrierChromaticNumber,
    crossCuttingContexts,
    unresolvedContexts,
  }));
  return moduleTopologyReadSchemaContract.assert(Object.freeze({
    kind: "metroplat.module-topology.read",
    operation: "read-module-topology",
    source: corpus.source,
    observation,
    root: rootAbs,
    sourceDirs: corpus.sourceDirs,
    subjectAnchors,
    subjectAnchorCoverage,
    layoutConvention,
    files: modules.length,
    ...(corpus.truncated ? { truncated: true } : {}),
    loc: totalLoc,
    sloc: totalSloc,
    functions: totalFunctions,
    classes: totalClasses,
    modules: Object.freeze(modules),
    modulesWithDisconnectedSymbolClusters,
    maxSymbolClusters,
    cyclicComponents,
    symbols,
    subjectAnchoredSymbols,
    subjectUnanchoredSymbols,
    multiplySubjectAnchoredSymbols,
    speciesContext,
    speciesConcepts,
    speciesCensus,
    speciesFormulas,
    placementObstructions,
    ambiguousPlacements,
    layerMismatches,
    contextMismatches,
    mixedPlacementModules,
    multicoloredCarriers,
    maxCarrierChromaticNumber,
    crossCuttingContexts,
    unresolvedContexts,
  }), "Module topology read");
}

function requestedTopologyPathMatches(modulePath, requestedPath) {
  const prefix = requestedPath.endsWith("/") ? requestedPath : `${requestedPath}/`;
  return modulePath === requestedPath || modulePath.startsWith(prefix);
}

/** Project a complete topology observation into a deterministic bounded RPC page. */
export function moduleTopologyPage(
  read,
  options = {},
) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 25;
  if (!Number.isInteger(offset) || offset < 0) throw new TypeError("module topology offset must be a nonnegative integer");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError("module topology limit must be an integer from 1 through 50");
  const includeSymbols = options.includeSymbols === true;
  const paths = options.paths === undefined ? undefined : Object.freeze([...new Set(options.paths)].sort());
  const selectedSet = paths === undefined
    ? read.modules
    : read.modules.filter((moduleEntry) => paths.some((requestedPath) =>
      requestedTopologyPathMatches(moduleEntry.path, requestedPath)));
  const selected = selectedSet.slice(offset, offset + limit);
  const modules = Object.freeze(selected.map((moduleEntry) => Object.freeze({
    path: moduleEntry.path,
    ...(moduleEntry.summary === undefined ? {} : { summary: moduleEntry.summary }),
    identity: moduleEntry.identity,
    loc: moduleEntry.loc,
    sloc: moduleEntry.sloc,
    functions: moduleEntry.functions,
    classes: moduleEntry.classes,
    imports: moduleEntry.imports,
    typeImports: moduleEntry.typeImports,
    importedBy: moduleEntry.importedBy,
    typeImportedBy: moduleEntry.typeImportedBy,
    externalImports: moduleEntry.externalImports,
    externalTypeImports: moduleEntry.externalTypeImports,
    reexports: moduleEntry.reexports,
    symbolCount: moduleEntry.symbols.length,
    symbolClusterCount: moduleEntry.symbolClusters.length,
    subjectAnchoredSymbols: moduleEntry.subjectAnchoredSymbols,
    subjectUnanchoredSymbols: moduleEntry.subjectUnanchoredSymbols,
    multiplySubjectAnchoredSymbols: moduleEntry.multiplySubjectAnchoredSymbols,
    placementObstructions: moduleEntry.placementObstructions,
    placementLayers: moduleEntry.placementLayers,
    placementContexts: moduleEntry.placementContexts,
    placementColors: moduleEntry.placementColors,
    carrierChromaticNumber: moduleEntry.carrierChromaticNumber,
    mixedPlacement: moduleEntry.mixedPlacement,
    ...(includeSymbols ? {
      symbols: Object.freeze(moduleEntry.symbols.map((symbol) => Object.freeze({
        ...symbol,
        documentation: projectNodeBeingDocumentation({
          declaration: nodeDeclarationReference(moduleEntry.path, symbol.name),
          declarationKind: symbol.kind,
          exported: symbol.exported,
          ...(symbol.summary === undefined ? {} : { sourceSummary: symbol.summary }),
          being: symbol.being,
        }),
      }))),
      symbolClusters: moduleEntry.symbolClusters,
    } : {}),
  })));
  const nextOffset = offset + modules.length < selectedSet.length ? offset + modules.length : undefined;
  return moduleTopologyPageContract.assert(Object.freeze({
    kind: "metroplat.monitoring.source-code.module-topology",
    operation: "read-module-topology",
    source: read.source,
    observation: read.observation,
    root: read.root,
    sourceDirs: read.sourceDirs,
    subjectAnchors: read.subjectAnchors,
    subjectAnchorCoverage: read.subjectAnchorCoverage,
    layoutConvention: read.layoutConvention,
    files: read.files,
    ...(read.truncated === true ? { truncated: true } : {}),
    loc: read.loc,
    sloc: read.sloc,
    functions: read.functions,
    classes: read.classes,
    modulesWithDisconnectedSymbolClusters: read.modulesWithDisconnectedSymbolClusters,
    maxSymbolClusters: read.maxSymbolClusters,
    cyclicComponents: read.cyclicComponents,
    symbols: read.symbols,
    subjectAnchoredSymbols: read.subjectAnchoredSymbols,
    subjectUnanchoredSymbols: read.subjectUnanchoredSymbols,
    multiplySubjectAnchoredSymbols: read.multiplySubjectAnchoredSymbols,
    speciesContext: read.speciesContext,
    speciesConcepts: read.speciesConcepts,
    speciesCensus: read.speciesCensus,
    speciesFormulas: read.speciesFormulas,
    placementObstructions: read.placementObstructions,
    ambiguousPlacements: read.ambiguousPlacements,
    layerMismatches: read.layerMismatches,
    contextMismatches: read.contextMismatches,
    mixedPlacementModules: read.mixedPlacementModules,
    multicoloredCarriers: read.multicoloredCarriers,
    maxCarrierChromaticNumber: read.maxCarrierChromaticNumber,
    crossCuttingContexts: read.crossCuttingContexts,
    unresolvedContexts: read.unresolvedContexts,
    totalModules: read.modules.length,
    ...(paths === undefined ? {} : { paths, matchedModules: selectedSet.length }),
    offset,
    limit,
    returned: modules.length,
    ...(nextOffset === undefined ? {} : { nextOffset }),
    includeSymbols,
    modules,
  }), "Module topology page");
}

/** One exported symbol matching a capability search, with the file it lives in. */

/**
 * Search a module-topology read for exported symbols whose name or doc
 * summary mentions a term — "does this codebase already have X" as a real
 * query over the AST-derived index, not a guess from directory names.
 * Answer this before writing a function that might already exist.
 */
export function searchModuleTopologySymbols(read, query) {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return Object.freeze([]);
  const hits = [];
  for (const moduleEntry of read.modules) {
    for (const symbol of moduleEntry.symbols) {
      const haystack = `${symbol.name} ${symbol.summary ?? ""}`.toLowerCase();
      if (haystack.includes(needle)) {
        hits.push(Object.freeze({
          path: moduleEntry.path,
          name: symbol.name,
          kind: symbol.kind,
          line: symbol.line,
          exported: symbol.exported,
          ...(symbol.summary === undefined ? {} : { summary: symbol.summary }),
        }));
      }
    }
  }
  return Object.freeze(hits);
}

/**
 * Project the canonical module-cohesion partition carried by this topology
 * readout. Cohesion owns the persistent-H0 filtration over declaration
 * references and consumer co-import evidence; topology does not calculate a
 * second connectivity graph.
 */
export function symbolClustersOf(moduleEntry) {
  return moduleEntry.symbolClusters;
}

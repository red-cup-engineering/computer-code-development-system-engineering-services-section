/**
 * @packageDocumentation
 *
 * monitoring/source-code/cohesion - live package per-module declaration cohesion.
 *
 * This monitor consumes the same filesystem-adapter policy and TypeScript-AST
 * discipline as the sibling topology monitor, over the same source trees, but
 * reads a different structural fact: for each module, do its own top-level
 * exported declarations form one connected object, or does the available
 * evidence also preserve separations among them? Connectivity is read by the existing persistent-H0
 * union-find law in lib/math/graphs/module-cohesion.mts — this service's
 * own job is admitting the two evidence graphs that law consumes (internal
 * cross-reference, cross-file co-import), not computing components itself.
 *
 * "Internal cross-reference" has two sources, both same-file, both strong
 * evidence: one declaration's body naming another declaration's identifier,
 * and one declaration's schema literal `$ref`-ing another declaration's
 * `$id`. Those addresses are structural dependency evidence even though
 * cross-contract validation remains a loose slot until an explicit composition
 * boundary supplies both contracts. Reading only identifiers and ignoring `$ref`/`$id` address
 * composition over-reports fragmentation for every schema file that
 * uses this (deliberate, correct) addressing style.
 *
 * Obsmetrologia's `Calculus.Order.components_only_merge` proves the monotone
 * filtration fact used to interpret added evidence: connectivity can merge but
 * cannot split as graph edges accumulate. It does not certify this adapter's
 * TypeScript declaration extraction or its choice of evidence edges; those
 * remain explicitly tested implementation obligations.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";
import { walkJavaScript } from "@red-cup-engineering/javascript-node-services-section/javascript-parser";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";

import { moduleCohesionReceipt,
 } from "@red-cup-engineering/metrologic/models/graphs/module-cohesion";
import {
  moduleCohesionReadContract as moduleCohesionReadSchemaContract,
  moduleCohesionPageContract,

  } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/cohesion/schema";

import {
  DEFAULT_SOURCE_DIRECTORIES,
  DEFAULT_SOURCE_FILE_LIMIT,
  readSourceModuleCorpus,
  sourceModuleProgram,
  sourceModuleRelativePath,
  sourceModuleSyntax,

  } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/filesystem";
import { finiteClosureRegime, zeroOrdinal } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/closure";
import {
  evidenceRecord,
  evidenceRecordTopMass,
  addEvidenceRecords,
} from "@red-cup-engineering/metrologic/articulation/predicating/positing/evidence-record";
import { readingOfSides } from "@red-cup-engineering/computer-data-services-section/four";

const DEFAULT_MIN_SYMBOLS = 5;

function resolveRelativeSpecifier(sourcePath, specifier) {
  const resolved = path.normalize(path.join(path.dirname(sourcePath), specifier));
  return resolved.split(path.sep).join("/");
}

function topLevelDeclarationNodes(source) {
  const declarations = new Map();
  for (const outer of source.program.body) {
    const statement = (outer.type === "ExportNamedDeclaration" || outer.type === "ExportDefaultDeclaration") && outer.declaration ? outer.declaration : outer;
    if ((statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") && statement.id) {
      declarations.set(statement.id.name, statement);
    } else if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations) {
        if (declarator.id.type === "Identifier") declarations.set(declarator.id.name, declarator);
      }
    }
  }
  return declarations;
}

function identifiersReferencedBy(node, ownName) {
  const referenced = new Set();
  walkJavaScript(node, (current) => {
    if (current !== node && current.type === "Identifier" && current.name !== ownName) referenced.add(current.name);
  });
  return referenced;
}

function propertyAssignmentKey(node) {
  if (node.computed) return undefined;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value;
  return undefined;
}

/** Every `$id`/`$ref` string literal anywhere inside a declaration's own schema literal. */
function refIdFactsOf(node) {
  const ids = [];
  const refs = [];
  walkJavaScript(node, (current) => {
    if (current.type === "Property" && current.value.type === "Literal" && typeof current.value.value === "string") {
      const key = propertyAssignmentKey(current);
      if (key === "$id") ids.push(current.value.value);
      else if (key === "$ref") refs.push(current.value.value);
    }
  });
  return Object.freeze({ ids: Object.freeze(ids), refs: Object.freeze(refs) });
}

function readFileDeclarations(source, sourcePath) {
  const declarationNodes = topLevelDeclarationNodes(source);
  const symbolNames = new Set(declarationNodes.keys());
  const identifierReferenceEdges = [];
  const refIdFactsBySymbol = new Map();
  for (const [name, node] of declarationNodes) {
    const referenced = identifiersReferencedBy(node, name);
    for (const other of referenced) {
      if (symbolNames.has(other)) identifierReferenceEdges.push(Object.freeze([name, other]));
    }
    refIdFactsBySymbol.set(name, refIdFactsOf(node));
  }

  const namedImportsByModule = new Map();
  for (const node of source.program.body) {
    if (node.type !== "ImportDeclaration" || !node.source.value.startsWith(".")) continue;
    const named = node.specifiers.filter((specifier) => specifier.type === "ImportSpecifier");
    if (named.length === 0) continue;
    const modulePath = resolveRelativeSpecifier(sourcePath, node.source.value);
    const names = named.map((specifier) => specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value);
    const existing = namedImportsByModule.get(modulePath) ?? [];
    existing.push(...names);
    namedImportsByModule.set(modulePath, existing);
  }

  return Object.freeze({
    symbols: Object.freeze([...symbolNames]),
    identifierReferenceEdges: Object.freeze(identifierReferenceEdges),
    refIdFactsBySymbol,
    namedImportsByModule: namedImportsByModule,
  });
}

/** Every declaration's own `$id`, resolved once across the whole tree, so a `$ref` can be traced to its owner. */
function idOwnersAcross(declarationsByFile) {
  const owners = new Map();
  for (const [file, declarations] of declarationsByFile) {
    for (const [symbol, facts] of declarations.refIdFactsBySymbol) {
      for (const id of facts.ids) owners.set(id, Object.freeze({ file, symbol }));
    }
  }
  return owners;
}

/** Same-file edges from one declaration's `$ref` to another declaration's `$id` — the address-composed twin of an identifier reference. */
function refResolvedEdgesFor(
  file,
  declarations,
  idOwners,
) {
  const edges = [];
  for (const [symbol, facts] of declarations.refIdFactsBySymbol) {
    for (const ref of facts.refs) {
      const owner = idOwners.get(ref);
      if (owner !== undefined && owner.file === file && owner.symbol !== symbol) {
        edges.push(Object.freeze([symbol, owner.symbol]));
      }
    }
  }
  return Object.freeze(edges);
}

function coImportEdgesFor(targetPath, importerNamedImports) {
  const edges = [];
  for (const namedImportsByModule of importerNamedImports.values()) {
    const names = namedImportsByModule.get(targetPath);
    if (names === undefined || names.length < 2) continue;
    for (let left = 0; left < names.length; left += 1) {
      for (let right = left + 1; right < names.length; right += 1) {
        edges.push(Object.freeze([names[left], names[right]]));
      }
    }
  }
  return Object.freeze(edges);
}

/** Read one package's own per-module declaration-cohesion partition from its syntax trees. */
export function readModuleCohesion(root, options = {}) {
  const rootAbs = path.resolve(root);
  const sourceDirs = options.sourceDirs ?? DEFAULT_SOURCE_DIRECTORIES;
  const maxFiles = options.maxFiles ?? DEFAULT_SOURCE_FILE_LIMIT;
  return moduleCohesionOfCorpus(readSourceModuleCorpus(rootAbs, sourceDirs, maxFiles, options), options);
}

/** Read cohesion from one already-admitted corpus without repeating filesystem I/O. */
export function moduleCohesionOfCorpus(
  corpus,
  options = {},
) {
  const rootAbs = corpus.root;
  const minSymbols = options.minSymbols ?? DEFAULT_MIN_SYMBOLS;
  const identityByFile = new Map(corpus.files.map((file) => [file.absolutePath, file.identity]));
  const program = sourceModuleProgram(corpus);

  const declarationsByFile = new Map();
  for (const file of corpus.files) {
    const posixPath = file.absolutePath.split(path.sep).join("/");
    const source = sourceModuleSyntax(program, file);
    declarationsByFile.set(posixPath, readFileDeclarations(source, posixPath));
  }

  const importerNamedImports = new Map(
    [...declarationsByFile.entries()].map(([file, declarations]) => [file, declarations.namedImportsByModule]),
  );
  const idOwners = idOwnersAcross(declarationsByFile);

  const modules = [];
  for (const [file, declarations] of declarationsByFile) {
    if (declarations.symbols.length < minSymbols) continue;
    const ownSymbols = new Set(declarations.symbols);
    // A consumer may import a name this file only re-exports (`export type
    // { X } from "./other"`), which is not one of this file's own top-level
    // declarations and so is not a vertex in its graph; drop such edges.
    const coImportEdges = coImportEdgesFor(file, importerNamedImports)
      .filter(([source, target]) => ownSymbols.has(source) && ownSymbols.has(target));
    const internalReferenceEdges = [
      ...declarations.identifierReferenceEdges,
      ...refResolvedEdgesFor(file, declarations, idOwners),
    ];
    const receipt = moduleCohesionReceipt({
      path: file,
      symbols: declarations.symbols,
      internalReferenceEdges,
      coImportEdges,
    });
    modules.push(Object.freeze({
      path: sourceModuleRelativePath(rootAbs, file),
      identity: identityByFile.get(file),
      symbols: declarations.symbols,
      componentCount: receipt.componentCount,
      components: receipt.components,
      valuation: Object.freeze({
        ...receipt.valuation,
        ordinal: Object.freeze({
          kind: "ordinal.closure.ordinal.successor",
          predecessor: zeroOrdinal,
        }),
        regime: finiteClosureRegime,
      }),
    }));
  }
  modules.sort((left, right) => right.componentCount - left.componentCount || right.symbols.length - left.symbols.length);

  const record = modules.reduce(
    (accumulator, moduleEntry) => addEvidenceRecords(accumulator, moduleEntry.valuation.record),
    evidenceRecord(0, 0),
  );
  const valuation = Object.freeze({
    kind: "metroplat.module-cohesion.valuation",
    record,
    reading: readingOfSides("knowledge", record.pos > 0, record.neg > 0),
    topMass: evidenceRecordTopMass(record),
    ordinal: Object.freeze({
      kind: "ordinal.closure.ordinal.successor",
      predecessor: zeroOrdinal,
    }),
    regime: finiteClosureRegime,
    evidence: Object.freeze([
      `modules:${modules.length}`,
      `record-sum:pos:${record.pos};neg:${record.neg}`,
    ]),
  });
  const observation = artifactId(Object.freeze({
    source: corpus.source,
    minSymbols,
    modules: Object.freeze(modules.map((moduleEntry) => artifactId(moduleEntry))),
    valuation,
  }));

  return moduleCohesionReadSchemaContract.assert(Object.freeze({
    kind: "metroplat.module-cohesion.read",
    operation: "read-module-cohesion",
    source: corpus.source,
    observation,
    root: rootAbs,
    sourceDirs: corpus.sourceDirs,
    files: declarationsByFile.size,
    ...(corpus.truncated ? { truncated: true } : {}),
    minSymbols,
    modules: Object.freeze(modules),
    valuation,
  }), "Module cohesion read");
}

/** Project a complete cohesion observation into a deterministic bounded RPC page. */
export function moduleCohesionPage(
  read,
  options = {},
) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 25;
  if (!Number.isInteger(offset) || offset < 0) throw new TypeError("module cohesion offset must be a nonnegative integer");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError("module cohesion limit must be an integer from 1 through 50");
  const includeSymbols = options.includeSymbols === true;
  const selected = read.modules.slice(offset, offset + limit);
  const modules = Object.freeze(selected.map((moduleEntry) => Object.freeze({
    path: moduleEntry.path,
    identity: moduleEntry.identity,
    symbolCount: moduleEntry.symbols.length,
    componentCount: moduleEntry.componentCount,
    valuation: moduleEntry.valuation,
    ...(includeSymbols ? { symbols: moduleEntry.symbols, components: moduleEntry.components } : {}),
  })));
  const nextOffset = offset + modules.length < read.modules.length ? offset + modules.length : undefined;
  return moduleCohesionPageContract.assert(Object.freeze({
    kind: "metroplat.monitoring.source-code.module-cohesion",
    operation: "read-module-cohesion",
    source: read.source,
    observation: read.observation,
    root: read.root,
    sourceDirs: read.sourceDirs,
    files: read.files,
    ...(read.truncated === true ? { truncated: true } : {}),
    minSymbols: read.minSymbols,
    valuation: read.valuation,
    totalModules: read.modules.length,
    offset,
    limit,
    returned: modules.length,
    ...(nextOffset === undefined ? {} : { nextOffset }),
    includeSymbols,
    modules,
  }), "Module cohesion page");
}

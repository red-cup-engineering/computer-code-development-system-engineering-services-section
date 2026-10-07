import { defineType } from "@red-cup-engineering/computer-data-engineering-services-section/type-system";
import { declareCapabilityOperation, executeOperation } from "@red-cup-engineering/computer-code-engineering-services-section/typed-operation";
import { execute as executeEavt, row as admitRow } from "@red-cup-engineering/eavt";
import { foldFabricationReceiptIntoWorldRows } from "./receipts.mjs";
import { readJsnodeOperationArguments } from "@red-cup-engineering/javascript-node-services-section/syntax";
import { inspectInstalledNpmPackageResolution } from "@red-cup-engineering/inspect-installed-npm-package-service";
import { walkPosixPaths } from "@red-cup-engineering/computer-filepath-engineering-services-section/walk-posix-paths";
import { readTextFile } from "@red-cup-engineering/file-services/read-text-file";
import { CATALOG_PROFILE, classifyResource, compileCatalog } from "@red-cup-engineering/computer-content-engineering-services-section/catalog";
import { realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export { readJsnodeOperationArguments };


function refusal(reason, detail) {
  const error = new Error(reason);
  error.code = reason;
  error.refusal = Object.freeze({ reason, ...detail });
  return error;
}

function operationOrigin(rows, address) {
  const value = rows.find((row) => row.e === address && row.a === "constituted")?.v;
  if (value === null || typeof value !== "object" || Array.isArray(value) || typeof value.name !== "string" || value.name.length === 0) {
    throw refusal("OPERATION_PACKAGE_IDENTITY_INVALID", { address });
  }
  if (value.version !== null && typeof value.version !== "string") throw refusal("OPERATION_PACKAGE_IDENTITY_INVALID", { address });
  return Object.freeze({ address, packageName: value.name, packageVersion: value.version ?? null });
}

function admittedOperation(value, origin) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || typeof value.path !== "string" || value.path.length === 0
    || typeof value.exportName !== "string" || value.exportName.length === 0) {
    throw refusal("OPERATION_CONTRACT_INVALID", origin);
  }
  return value;
}

function operationIdentity(origin, operation) {
  return `operation/${origin.address}/${operation.path}/${operation.exportName}`;
}

function inside(root, candidate) {
  const displacement = relative(root, candidate);
  return displacement === "" || (displacement !== ".." && !displacement.startsWith("../"));
}

function sameDeclaredContract(admitted, current) {
  // Schemas are an explicit contract carried by admission, never an inferred
  // property of JavaScript/JSDoc source.  Source re-reading can only verify
  // the callable declaration it actually observes.
  return ["path", "exportName", "isAsync", "description", "params", "returns", "throws"]
    .every((field) => isDeepStrictEqual(admitted[field], current[field]));
}

async function readFabricationReceipt(receiptPath) {
  let text;
  try {
    ({ text } = await readTextFile({ path: receiptPath }));
  } catch (error) {
    throw refusal("RECEIPT_UNREADABLE", { path: receiptPath, cause: error?.message ?? String(error) });
  }
  let receipt;
  try {
    receipt = JSON.parse(text);
  } catch (error) {
    throw refusal("RECEIPT_UNREADABLE", { path: receiptPath, cause: error?.message ?? String(error) });
  }
  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw refusal("NOT_A_FABRICATION_RECEIPT", { path: receiptPath });
  }
  const creation = receipt.jsnodeOperationPackageCreationReceipt ?? receipt;
  if (typeof creation.packageName !== "string" || creation.packageName.length === 0) {
    throw refusal("NOT_A_FABRICATION_RECEIPT", { path: receiptPath });
  }
  return Object.freeze({
    receipt,
    packageName: creation.packageName,
    packageVersion: creation.packageVersion ?? null,
    destination: creation.destination ?? null,
  });
}

async function listFabricatedOperationSources(destination) {
  try {
    const result = await walkPosixPaths({
      root: destination,
      maxDepth: 1,
      extensions: [".mjs"],
      excludes: ["node_modules", ".git"],
      includeFile: (file) => file.path.startsWith("scripts/"),
      paths: "absolute",
      result: "paths",
    });
    return result.files;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

/**
 * Admits a fabricated Node operation package into one EAVT package catalog.
 * The function composes the existing receipt fold, operation-contract reader,
 * and EAVT append boundary; it owns no duplicate receipt or row algebra.
 * @param {{flatfilePath: string, receiptPath: string, workingDirectory?: string}} input
 * @returns {Promise<{address: string, rows: number}>}
 */
export async function admitFabricationReceipt({ flatfilePath, receiptPath, workingDirectory = process.cwd() }) {
  if (typeof flatfilePath !== "string" || flatfilePath.length === 0 || typeof receiptPath !== "string" || receiptPath.length === 0 || typeof workingDirectory !== "string" || workingDirectory.length === 0) {
    throw new TypeError("admitFabricationReceipt: flatfilePath, receiptPath, and workingDirectory are required");
  }
  const admission = await readFabricationReceipt(receiptPath);
  const rows = executeEavt({ operation: "read", path: flatfilePath });
  const already = rows.find((row) => row.a === "constituted" && row.v?.name === admission.packageName && (row.v?.version ?? null) === admission.packageVersion);
  if (already) {
    throw refusal("ALREADY_ADMITTED", { address: already.e, name: admission.packageName, version: admission.packageVersion });
  }
  if (typeof admission.destination !== "string" || admission.destination.length === 0) {
    throw refusal("DESTINATION_ABSENT", { destination: null });
  }
  const destination = admission.destination.startsWith("/") ? admission.destination : resolve(workingDirectory, admission.destination);
  const sources = await listFabricatedOperationSources(destination);
  if (sources === null) throw refusal("DESTINATION_ABSENT", { destination });

  const startT = rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.t)) + 1;
  const folded = foldFabricationReceiptIntoWorldRows({ receipt: admission.receipt, t: startT });
  let t = folded.rows[folded.rows.length - 1].t + 1;
  const operationRows = [];
  for (const source of sources) {
    const path = `scripts/${source.split("/").pop()}`;
    let operation;
    try {
      const { text } = await readTextFile({ path: source });
      operation = readJsnodeOperationArguments({ text, path });
    } catch (error) {
      throw refusal("OPERATION_UNREADABLE", { source, path, cause: error?.message ?? String(error) });
    }
    if (operation.exportCount !== 1 || operation.exportName === null) {
      throw refusal("OPERATION_EXPORT_CARDINALITY", { source, path: operation.path, exportCount: operation.exportCount });
    }
    operationRows.push({
      e: folded.address,
      a: "has-operation",
      v: {
        path: operation.path,
        exportName: operation.exportName,
        isAsync: operation.isAsync,
        description: operation.description,
        params: operation.params,
        returns: operation.returns,
        inputSchema: operation.inputSchema,
        outputSchema: operation.outputSchema,
        throws: operation.throws,
      },
      t,
    });
    t += 1;
    for (const imported of new Set(operation.imports.map((one) => one.source))) {
      operationRows.push({ e: folded.address, a: "imports", v: imported, t });
      t += 1;
    }
  }
  const admissionRows = [...folded.rows, ...operationRows];
  for (const row of admissionRows) admitRow(row);
  for (const row of admissionRows) {
    executeEavt({ operation: "append", path: flatfilePath, row });
  }
  return Object.freeze({ address: folded.address, rows: t - startT });
}

function graphOperations(rows) {
  const identities = new Set();
  return Object.freeze(rows.filter((row) => row.a === "has-operation").map((row) => {
    const origin = operationOrigin(rows, row.e);
    const operation = admittedOperation(row.v, origin);
    if (!Object.hasOwn(operation, "inputSchema")) throw refusal("OPERATION_CONTRACT_INVALID", origin);
    const identity = operationIdentity(origin, operation);
    if (identities.has(identity)) throw new TypeError(`duplicate package operation identity: ${identity}`);
    identities.add(identity);
    return Object.freeze({ ...operation, identity, origin });
  }));
}

function catalogDeclaration(operation) {
  return Object.freeze({
    profile: CATALOG_PROFILE,
    nodes: [
      { type: "resource", parent: null, corner: "data", rung: "strict", recognize: { op: "true" } },
      ...(operation === null ? [] : [{
        type: operation.identity,
        parent: "resource",
        corner: "data",
        rung: "strict",
        recognize: { op: "json-schema", schema: operation.inputSchema },
      }]),
    ],
  });
}

/**
 * Purely classifies a supplied resource against operation contracts recorded in a FERN.
 * It does not load packages or execute admitted operations.
 * @param {{fernPath: string, resource: {path: string, content: string}}} input
 * @returns {Promise<{resource: Readonly<{path: string, content: string}>, classification: object, operations: readonly object[]}>}
 */
export async function inspectPackageResource({ fernPath, resource }) {
  if (typeof fernPath !== "string" || fernPath.length === 0) throw new TypeError("inspectPackageResource: fernPath is required");
  const inspectedResource = Object.freeze({ path: resource?.path, content: resource?.content });
  const classification = classifyResource(compileCatalog(catalogDeclaration(null), { closed: true }), inspectedResource);
  const operations = graphOperations(executeEavt({ operation: "read", path: fernPath })).map((operation) => {
    if (operation.inputSchema === null) {
      return Object.freeze({ identity: operation.identity, origin: operation.origin, path: operation.path, exportName: operation.exportName, model: null, classification: null, matched: null });
    }
    const model = compileCatalog(catalogDeclaration(operation), { closed: true });
    const operationClassification = classifyResource(model, inspectedResource);
    return Object.freeze({
      identity: operation.identity,
      origin: operation.origin,
      path: operation.path,
      exportName: operation.exportName,
      model: model.declaration,
      classification: operationClassification,
      matched: operationClassification.classification === operation.identity,
    });
  });
  return Object.freeze({ resource: inspectedResource, classification, operations: Object.freeze(operations) });
}

/**
 * Binds only FERN-admitted Node operations whose installed package identity and
 * declared callable contract still match the graph. Package loading is delayed
 * until the complete admitted contract has been checked.
 * @param {{fernPath: string, operationsRoot: string}} input The bound FERN and trusted installed-package root.
 * @returns {Promise<readonly {identity: string, operation: object, origin: {address: string, packageName: string, packageVersion: string}, path: string, exportName: string, description: string|null, inputSchema: object|null, outputSchema: object|null, run: (input: unknown) => unknown|Promise<unknown>}[]>}
 */
export async function readBoundPackageOperations({ fernPath, operationsRoot }) {
  if (typeof fernPath !== "string" || fernPath.length === 0 || typeof operationsRoot !== "string" || operationsRoot.length === 0) {
    throw new TypeError("readBoundPackageOperations: fernPath and operationsRoot are required");
  }
  const rows = executeEavt({ operation: "read", path: fernPath });
  const root = resolve(operationsRoot);
  let trustedPackagesRoot;
  try {
    trustedPackagesRoot = await realpath(join(root, "node_modules"));
  } catch (error) {
    throw refusal("OPERATION_PACKAGE_NOT_INSTALLED", { root, defects: [{ law: "operations-root-unreadable", cause: error?.message ?? String(error) }] });
  }
  const candidates = [];
  for (const address of [...new Set(rows.filter((row) => row.a === "has-operation").map((row) => row.e))]) {
    const origin = operationOrigin(rows, address);
    if (origin.packageVersion === null) {
      throw refusal("OPERATION_PACKAGE_IDENTITY_MISMATCH", { ...origin, root, defects: [{ law: "admitted-package-version-absent" }] });
    }
    const inspection = await inspectInstalledNpmPackageResolution({
      type: "InstalledNpmPackageInspectionRequest",
      version: 1,
      projectRoot: root,
      packageRoot: null,
      expectedName: origin.packageName,
      expectedVersion: origin.packageVersion,
    });
    if (!inspection.conformant || inspection.packageRoot === null) {
      throw refusal(inspection.packageVersion === null ? "OPERATION_PACKAGE_NOT_INSTALLED" : "OPERATION_PACKAGE_IDENTITY_MISMATCH", { ...origin, root, defects: inspection.defects });
    }
    const packageRoot = await realpath(inspection.packageRoot);
    if (!inside(trustedPackagesRoot, packageRoot)) {
      throw refusal("OPERATION_PATH_OUTSIDE_PACKAGE", { ...origin, path: packageRoot });
    }
    for (const row of rows.filter((candidate) => candidate.e === address && candidate.a === "has-operation")) {
      const admitted = admittedOperation(row.v, origin);
      if (admitted.path.startsWith("/") || admitted.path.split("/").includes("..")) {
        throw refusal("OPERATION_PATH_OUTSIDE_PACKAGE", { ...origin, path: admitted.path });
      }
      const requestedPath = resolve(packageRoot, admitted.path);
      let installedPath;
      try {
        installedPath = await realpath(requestedPath);
      } catch (error) {
        throw refusal("OPERATION_PATH_UNREADABLE", { ...origin, path: admitted.path, cause: error?.message ?? String(error) });
      }
      if (!inside(packageRoot, installedPath)) {
        throw refusal("OPERATION_PATH_OUTSIDE_PACKAGE", { ...origin, path: admitted.path });
      }
      let current;
      try {
        const { text } = await readTextFile({ path: installedPath });
        current = readJsnodeOperationArguments({ text, path: admitted.path });
      } catch (error) {
        throw refusal("OPERATION_PATH_UNREADABLE", { ...origin, path: admitted.path, cause: error?.message ?? String(error) });
      }
      if (current.exportCount !== 1 || current.exportName !== admitted.exportName) {
        throw refusal("OPERATION_EXPORT_MISMATCH", { ...origin, path: admitted.path, exportName: admitted.exportName });
      }
      if (!sameDeclaredContract(admitted, current)) {
        throw refusal("OPERATION_CONTRACT_MISMATCH", { ...origin, path: admitted.path });
      }
      candidates.push({ origin, admitted, installedPath, current });
    }
  }
  const identities = new Set();
  for (const candidate of candidates) {
    const identity = operationIdentity(candidate.origin, candidate.admitted);
    if (identities.has(identity)) throw refusal("OPERATION_ACTION_COLLISION", { ...candidate.origin, path: candidate.admitted.path, verb: identity });
    identities.add(identity);
    const declareType = (side, schema) => {
      const result = defineType({ id: `${identity}/${side}`, name: `${candidate.origin.packageName} ${candidate.admitted.exportName} ${side}`, description: `Admitted installed package ${side} predicate.`, parents: [], schema: schema ?? {} });
      if (!result.ok) throw refusal("OPERATION_CONTRACT_INVALID", { ...candidate.origin, path: candidate.admitted.path, cause: result.refusal.message });
      return result.value;
    };
    const declaration = declareCapabilityOperation({
      id: identity,
      domain: declareType("input", candidate.admitted.inputSchema),
      codomain: declareType("output", candidate.admitted.outputSchema),
      effects: ["installed-package:invoke"],
    });
    if (!declaration.ok) throw refusal("OPERATION_CONTRACT_INVALID", { ...candidate.origin, path: candidate.admitted.path, cause: declaration.refusal.message });
    candidate.operation = declaration.value;
  }
  const bound = [];
  for (const candidate of candidates) {
    const imported = await import(pathToFileURL(candidate.installedPath).href);
    const run = imported[candidate.admitted.exportName];
    if (typeof run !== "function") throw refusal("OPERATION_EXPORT_MISMATCH", { ...candidate.origin, path: candidate.admitted.path, exportName: candidate.admitted.exportName });
    const parameterNames = Array.isArray(candidate.current.params)
      ? candidate.current.params.map((parameter) => parameter?.name).filter((name) => typeof name === "string" && name.length > 0)
      : [];
    const callable = parameterNames.length <= 1
      ? run
      : (input) => {
        if (input === null || typeof input !== "object" || Array.isArray(input) || !parameterNames.every((name) => Object.hasOwn(input, name))) {
          throw refusal("OPERATION_INPUT_PARAMETERS_ABSENT", { ...candidate.origin, path: candidate.admitted.path, parameters: parameterNames });
        }
        return run(...parameterNames.map((name) => input[name]));
      };
    const identity = operationIdentity(candidate.origin, candidate.admitted);
    const operation = candidate.operation;
    const resultValue = (result) => {
      if (result.ok) return result.value;
      const error = refusal(result.refusal.code, { message: result.refusal.message, ...candidate.origin, path: candidate.admitted.path });
      error.code = result.refusal.code;
      error.message = result.refusal.message;
      throw error;
    };
    const execute = (input) => {
      const result = executeOperation(operation, input, { allowedEffects: operation.effects, resolveHost: (capability) => capability === identity ? callable : undefined });
      return result instanceof Promise ? result.then(resultValue) : resultValue(result);
    };
    bound.push(Object.freeze({
      identity,
      operation,
      origin: candidate.origin,
      path: candidate.admitted.path,
      exportName: candidate.admitted.exportName,
      description: candidate.admitted.description ?? null,
      inputSchema: candidate.admitted.inputSchema ?? null,
      outputSchema: candidate.admitted.outputSchema ?? null,
      run: execute,
    }));
  }
  return Object.freeze(bound);
}

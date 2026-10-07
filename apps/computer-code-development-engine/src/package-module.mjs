import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}


function requireText(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`JSNode package module ${field} must be nonempty text`);
  return value;
}

function requireExactVersion(value, field) {
  const version = requireText(value, field);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new TypeError(`JSNode package module ${field} must be an exact package version`);
  }
  return version;
}

function admitBehavior(value, index) {
  if (!isRecord(value)) throw new TypeError(`JSNode package module behaviors[${index}] must be an object`);
  const path = requireText(value.path, `behaviors[${index}].path`);
  if (!path.startsWith("scripts/") || path.includes("..") || path.startsWith("/")) {
    throw new TypeError(`JSNode package module behaviors[${index}].path must name an in-package scripts/ file`);
  }
  const effect = requireText(value.effect, `behaviors[${index}].effect`);
  return Object.freeze({
    id: requireText(value.id, `behaviors[${index}].id`),
    path,
    exportName: requireText(value.exportName, `behaviors[${index}].exportName`),
    inputSchema: value.inputSchema ?? null,
    outputSchema: value.outputSchema ?? null,
    effect,
  });
}

/**
 * Admits the portable declaration of one npm package as a JSNode module.
 * It has no filesystem or package-loading effect: a behavior becomes callable
 * only through the separately receipt-backed flatfile operation binder.
 */
export function admitPackageModule(value) {
  if (!isRecord(value)) throw new TypeError("JSNode package module must be an object");
  if (value.kind !== "jsnode.package-module") throw new TypeError("JSNode package module kind must be jsnode.package-module");
  if (value.version !== 1) throw new TypeError("JSNode package module version must be 1");
  if (!isRecord(value.package)) throw new TypeError("JSNode package module package must be an object");
  if (!isRecord(value.model)) throw new TypeError("JSNode package module model must be an object");
  if (!Array.isArray(value.behaviors)) throw new TypeError("JSNode package module behaviors must be an array");
  const behaviors = value.behaviors.map(admitBehavior);
  const ids = new Set(behaviors.map(({ id }) => id));
  if (ids.size !== behaviors.length) throw new TypeError("JSNode package module behavior ids must be unique");
  const dependencies = value.dependencies ?? [];
  if (!Array.isArray(dependencies) || !dependencies.every((dependency) => isRecord(dependency) && typeof dependency.name === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(dependency.version))) {
    throw new TypeError("JSNode package module dependencies must name exact package versions");
  }
  const declaration = Object.freeze({
    kind: value.kind,
    version: value.version,
    package: Object.freeze({ name: requireText(value.package.name, "package.name"), version: requireExactVersion(value.package.version, "package.version") }),
    model: Object.freeze({ ...value.model }),
    behaviors: Object.freeze(behaviors),
    dependencies: Object.freeze(dependencies.map(({ name, version }) => Object.freeze({ name: requireText(name, "dependencies[].name"), version: requireExactVersion(version, "dependencies[].version") }))),
  });
  return Object.freeze({ ...declaration, receipt: Object.freeze({ contentIdentity: makeNiUri(Buffer.from(canonicalJson(declaration), "utf8")) }) });
}

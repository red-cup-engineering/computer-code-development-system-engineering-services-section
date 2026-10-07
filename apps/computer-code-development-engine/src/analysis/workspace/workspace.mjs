/**
 * workspace — filesystem reading into node-topology carriers.
 *
 * `javascript-computer.eachWorkspacePackageDir` supplies the manifest walk everything else is
 * built on: every directory with a readable package.json, minus exclusions
 * honoured everywhere at once. `discoverWorkspace` collects them all; layer
 * comes from directory position, not manifest content.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { eachWorkspacePackageDir } from "@red-cup-engineering/javascript-computer";
import { JSNODE_LAYERS, jsNodePackage, jsNodeWorkspace, } from "@red-cup-engineering/computer-code-development-engine/analysis/topology/index";
import { introspectDeclarations, discoverJavaScriptPackageSources } from "@red-cup-engineering/javascript-computer";
// The same authored-source selection feeds single-package and workspace reads.
function readPackageApi(dir, manifest) {
    const catalog = introspectDeclarations(discoverJavaScriptPackageSources(dir, manifest).files);
    return catalog.types.length || catalog.functions.length ? catalog : undefined;
}
function classifyLayer(dir) {
    const parts = dir.split(path.sep);
    for (const layer of JSNODE_LAYERS) {
        if (parts.includes(layer))
            return layer;
    }
    return "lib";
}
function extractExports(manifest) {
    const raw = manifest["exports"];
    if (raw === null || typeof raw !== "object")
        return [];
    return Object.keys(raw).filter((k) => k !== "./package.json");
}
function extractDependencies(manifest) {
    const deps = manifest["dependencies"];
    if (deps === null || typeof deps !== "object")
        return [];
    return Object.keys(deps);
}
// A package's `keywords` are its tags on the meme floor: the `deprecated`
// keyword is what the deprecated-sweep reads to find packages slated for
// retirement. Without this, `tags` was always empty and `searchPackages`'
// tag-rank and the sweep had nothing to match.
function extractTags(manifest) {
    const kw = manifest["keywords"];
    if (!Array.isArray(kw))
        return [];
    return kw.filter((k) => typeof k === "string");
}
// ---------- the plain manifest facts (the normie metadata) ----------
const DEP_FIELDS = [
    ["dependencies", "runtime"],
    ["devDependencies", "dev"],
    ["peerDependencies", "peer"],
    ["optionalDependencies", "optional"],
];
// Every declared dependency across all four kinds, each with its version range —
// the superset of the runtime name-list. The drift and consistency tools read
// this; the dependency graph still reads only the runtime names.
function extractDeps(manifest) {
    const out = [];
    for (const [field, kind] of DEP_FIELDS) {
        const raw = manifest[field];
        if (raw === null || typeof raw !== "object")
            continue;
        for (const [name, range] of Object.entries(raw)) {
            out.push({ name, range: typeof range === "string" ? range : "*", kind });
        }
    }
    return out;
}
function extractEngines(manifest) {
    const raw = manifest["engines"];
    if (raw === null || typeof raw !== "object")
        return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string")
            out[k] = v;
    }
    return out;
}
function extractScriptNames(manifest) {
    const raw = manifest["scripts"];
    if (raw === null || typeof raw !== "object")
        return [];
    return Object.keys(raw);
}
// A repository can be a string or { type, url }; normalize to a URL-ish string.
function extractRepository(manifest) {
    const raw = manifest["repository"];
    if (typeof raw === "string")
        return raw;
    if (raw !== null && typeof raw === "object") {
        const url = raw["url"];
        if (typeof url === "string")
            return url;
    }
    return null;
}
function extractModuleType(manifest) {
    const t = manifest["type"];
    return t === "module" || t === "commonjs" ? t : null;
}
// Build a carrier from an already-parsed manifest (the strata walk hands these
// over), so discovery never re-reads a file it has already read.
function manifestToPackage(dir, manifest, opts) {
    const name = typeof manifest["name"] === "string" ? manifest["name"] : path.basename(dir);
    const version = typeof manifest["version"] === "string" ? manifest["version"] : "0.0.0";
    const description = typeof manifest["description"] === "string" ? manifest["description"] : "";
    const api = opts.introspect ? readPackageApi(dir, manifest) : undefined;
    const license = typeof manifest["license"] === "string" ? manifest["license"] : null;
    return jsNodePackage({
        name,
        version,
        description,
        layer: classifyLayer(dir),
        tags: extractTags(manifest),
        exports: extractExports(manifest),
        dependencies: extractDependencies(manifest),
        deps: extractDeps(manifest),
        license,
        private: manifest["private"] === true,
        moduleType: extractModuleType(manifest),
        engines: extractEngines(manifest),
        scripts: extractScriptNames(manifest),
        repository: extractRepository(manifest),
        homepage: typeof manifest["homepage"] === "string" ? manifest["homepage"] : null,
        ...(api !== undefined ? { api } : {}),
    });
}
export async function readJSNodePackage(dir, opts = {}) {
    const manifestPath = path.join(dir, "package.json");
    let raw;
    try {
        raw = await readFile(manifestPath, "utf8");
    }
    catch {
        return undefined;
    }
    let manifest;
    try {
        manifest = JSON.parse(raw);
    }
    catch {
        return undefined;
    }
    return manifestToPackage(dir, manifest, opts);
}
export async function discoverWorkspace(root, opts = {}) {
    return workspaceFromDiscoveredPackages(root, eachWorkspacePackageDir(root, opts), opts);
}
/** Projects one already-read workspace package snapshot without filesystem reads. */
export function workspaceFromDiscoveredPackages(root, discoveredPackages, opts = {}) {
    return jsNodeWorkspace(root, [...discoveredPackages].map(({ dir, manifest }) => manifestToPackage(dir, manifest, opts)));
}

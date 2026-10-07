import path from "node:path";

import { workspaceTypeIndex, eachWorkspacePackageDir } from "@red-cup-engineering/javascript-computer";

export function observeJavaScriptContextSurfaces(repoRoot, { includeTypes = true } = {}) {
  const discovered = [...eachWorkspacePackageDir(repoRoot)];
  const packages = discovered.map((pkg) => ({
    name: pkg.name,
    packagePath: relativePackagePath(repoRoot, pkg.dir),
    manifest: pkg.manifest,
  }));
  if (!includeTypes) return Object.freeze({ packages: Object.freeze(packages), functions: null, types: null, source: "workspace-manifests" });
  const index = workspaceTypeIndex(repoRoot, {}, discovered);
  return Object.freeze({ packages: Object.freeze(packages), functions: index.functions, types: index.types, source: "workspace-manifests-and-source" });
}

export function projectContextRelevance(observation, params = {}) {
  const prompt = rawText(params.prompt ?? params.q ?? params.intent) ?? "coding context relevance";
  const query = optionalText(prompt) ?? "coding context relevance";
  const focus = optionalText(params.focus) ?? focusFromPrompt(prompt, observation.packages);
  const limit = boundedInteger(params.limit, { min: 1, max: 48, fallback: 12 });
  const maxBytes = boundedInteger(params.maxBytes, { min: 512, max: 24_000, fallback: 12_000 });
  const metadata = plainObject(params.metadata) ?? {};
  const keywords = keywordTerms(withoutLiteralPaths(query));
  const packagePaths = new Map(observation.packages.map((pkg) => [pkg.name, pkg.packagePath]));
  const functions = relevantFunctions(observation.functions ?? [], packagePaths, keywords, limit, focus);
  const types = relevantTypes(observation.types ?? [], packagePaths, keywords, limit, focus);
  const scripts = relevantScripts(observation.packages, keywords, limit, focus);
  const packages = relevantPackages(observation.packages, keywords, limit, focus);

  return fitBudget({
    kind: "coding-context.relevance",
    prompt,
    query,
    focus,
    keywords,
    source: Object.freeze({ packages: "observed-manifest", functions: observation.functions === null ? "unavailable" : "observed-source-index", types: observation.types === null ? "unavailable" : "observed-source-index" }),
    metadata: Object.freeze(metadata),
    functions,
    types,
    scripts,
    packages,
    keywordSurfaces: keywordSurfaces(functions, types, scripts, keywords),
  }, maxBytes, { packages: observation.packages.length, functions: observation.functions?.length ?? null, types: observation.types?.length ?? null });
}

export function deriveContextRelevance(repoRoot, params = {}) {
  return projectContextRelevance(observeJavaScriptContextSurfaces(repoRoot), params);
}

function relevantFunctions(values, packagePaths, keywords, limit, focus) {
  const candidates = values.flatMap((value) => {
    const packagePath = packagePaths.get(value.pkg) ?? "";
    const signature = `${value.name}(${value.domain.join(", ")})${value.codomain ? `: ${value.codomain}` : ""}`;
    const match = matchedKeywords([value.name, signature, value.pkg, packagePath, ...(value.imports ?? []).flatMap((entry) => [entry.name, entry.specifier])], keywords);
    return match.length === 0 ? [] : [Object.freeze({
      package: value.pkg,
      packagePath,
      name: value.name,
      import: value.imports?.[0]?.specifier ?? null,
      importName: value.imports?.[0]?.name ?? null,
      imports: value.imports ?? [],
      source: value.source ?? null,
      ...(value.declaration ? { declaration: value.declaration } : {}),
      signature,
      keywords: match,
    })];
  });
  return rankAndBalance(candidates, keywords, limit, focus, (item) => item.name, (item) => item.signature);
}

function relevantTypes(values, packagePaths, keywords, limit, focus) {
  const candidates = values.flatMap((value) => {
    const packagePath = packagePaths.get(value.pkg) ?? "";
    const signature = `${value.kind} ${value.name}`;
    const match = matchedKeywords([value.name, signature, value.pkg, packagePath, ...(value.imports ?? []).flatMap((entry) => [entry.name, entry.specifier])], keywords);
    return match.length === 0 ? [] : [Object.freeze({
      package: value.pkg,
      packagePath,
      name: value.name,
      import: value.imports?.[0]?.specifier ?? null,
      importName: value.imports?.[0]?.name ?? null,
      imports: value.imports ?? [],
      source: value.source ?? null,
      ...(value.declaration ? { declaration: value.declaration } : {}),
      signature,
      keywords: match,
    })];
  });
  return rankAndBalance(candidates, keywords, limit, focus, (item) => item.name, (item) => item.signature);
}

function relevantScripts(packages, keywords, limit, focus) {
  const candidates = packages.flatMap((pkg) => binEntries(pkg.manifest.bin).flatMap(([bin, target]) => {
    const match = matchedKeywords([bin, target, pkg.name, pkg.packagePath], keywords);
    return match.length === 0 ? [] : [Object.freeze({
      package: pkg.name,
      packagePath: pkg.packagePath,
      bin,
      target,
      keywords: match,
    })];
  }));
  return rankAndBalance(candidates, keywords, limit, focus, (item) => item.bin, (item) => item.target);
}

function relevantPackages(packages, keywords, limit, focus) {
  const candidates = packages.flatMap((pkg) => {
    const description = typeof pkg.manifest.description === "string" ? pkg.manifest.description : "";
    const bins = binEntries(pkg.manifest.bin).map(([bin, target]) => Object.freeze({ bin, target }));
    const exports = exportedPaths(pkg.manifest.exports);
    const match = matchedKeywords([pkg.name, pkg.packagePath, description, ...bins.flatMap((entry) => [entry.bin, entry.target]), ...exports], keywords);
    if (match.length === 0 && focusWeight(pkg.name, pkg.packagePath, focus) === 0) return [];
    return [Object.freeze({ package: pkg.name, packagePath: pkg.packagePath, description, bins: Object.freeze(bins), exports: Object.freeze(exports), source: "observed-manifest", keywords: match })];
  });
  return rankAndBalance(candidates, keywords, limit, focus, (item) => item.package, (item) => `${item.description} ${item.exports.join(" ")}`);
}

function exportedPaths(exportsField) {
  if (typeof exportsField === "string") return ["."];
  if (exportsField === null || typeof exportsField !== "object") return [];
  if (Array.isArray(exportsField)) return exportsField.some((value) => exportedPaths(value).includes(".")) ? ["."] : [];
  const keys = Object.keys(exportsField);
  const subpaths = keys.filter((key) => key === "." || key.startsWith("./")).filter((key) => exportsField[key] !== null);
  if (subpaths.length > 0) return subpaths.sort();
  return keys.some((key) => exportedPaths(exportsField[key]).includes(".")) ? ["."] : [];
}

function rankAndBalance(candidates, keywords, limit, focus, nameOf, detailOf) {
  const sorted = [...candidates].sort((left, right) =>
    score(right, keywords, focus, nameOf, detailOf) - score(left, keywords, focus, nameOf, detailOf)
    || left.package.localeCompare(right.package)
    || nameOf(left).localeCompare(nameOf(right)));
  if (keywords.length <= 1) return Object.freeze(sorted.slice(0, limit));

  const selected = [];
  const seen = new Set();
  const keyOf = (item) => `${item.package}:${nameOf(item)}:${detailOf(item)}`;
  const quota = Math.max(2, Math.floor(limit / keywords.length));
  const add = (items, cap = Infinity) => {
    for (const item of items) {
      if (selected.length >= limit || cap <= 0) break;
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(item);
      cap -= 1;
    }
  };
  for (const keyword of keywords) add(sorted.filter((item) => item.keywords.includes(keyword)), quota);
  add(sorted);
  return Object.freeze(selected.slice(0, limit));
}

function score(value, keywords, focus, nameOf, detailOf) {
  const nameMatches = matchCount(surfaceTerms([nameOf(value)]), keywords);
  const detailMatches = matchCount(surfaceTerms([detailOf(value)]), keywords);
  const packageMatches = matchCount(surfaceTerms([value.package, value.packagePath]), keywords);
  return nameMatches * 12 + detailMatches * 5 + packageMatches * 5 + value.keywords.length * 8
    + focusWeight(value.package, value.packagePath, focus);
}

function keywordSurfaces(functions, types, scripts, keywords) {
  return Object.freeze(keywords.map((keyword) => Object.freeze({
    keyword,
    functions: Object.freeze(functions.flatMap((item, index) => item.keywords.includes(keyword) ? [index] : []).slice(0, 6)),
    types: Object.freeze(types.flatMap((item, index) => item.keywords.includes(keyword) ? [index] : []).slice(0, 4)),
    scripts: Object.freeze(scripts.flatMap((item, index) => item.keywords.includes(keyword) ? [index] : []).slice(0, 4)),
  })).filter((surface) => surface.functions.length > 0 || surface.types.length > 0 || surface.scripts.length > 0));
}

function binEntries(bin) {
  if (typeof bin === "string") return [["command", bin]];
  if (bin === null || typeof bin !== "object" || Array.isArray(bin)) return [];
  return Object.entries(bin).filter(([name, target]) => name !== "" && typeof target === "string");
}

function matchedKeywords(values, keywords) {
  const terms = surfaceTerms(values);
  return Object.freeze(keywords.filter((keyword) => terms.some((term) => termMatches(term, keyword))));
}

function keywordTerms(value) {
  const stop = new Set(["about", "agent", "and", "are", "codex", "context", "emsenn", "for", "from", "function", "group", "into", "operation", "package", "please", "relevance", "script", "service", "services", "that", "the", "these", "this", "with", "561"]);
  return Object.freeze([...new Set(identifierTerms(value).map(normalizeKeywordTerm)
    .filter((term) => term.length >= 3 && /[a-z]/u.test(term) && !stop.has(term)))].slice(0, 16));
}

function surfaceTerms(values) {
  return [...new Set(values.flatMap(identifierTerms).map(normalizeKeywordTerm).filter(Boolean))];
}

function identifierTerms(value) {
  return String(value ?? "").replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2").toLowerCase()
    .split(/[^a-z0-9]+/u).filter(Boolean);
}

function matchCount(terms, keywords) {
  return keywords.filter((keyword) => terms.some((term) => termMatches(term, keyword))).length;
}

function termMatches(term, keyword) {
  return term === keyword || (keyword.length >= 4 && term.startsWith(keyword));
}

function normalizeKeywordTerm(term) {
  if (term.endsWith("ies") && term.length > 5) return `${term.slice(0, -3)}y`;
  if (term.endsWith("s") && term.length > 4 && !term.endsWith("ss")) return term.slice(0, -1);
  return term;
}

function focusWeight(packageName, packagePath, focus) {
  if (focus === null) return 0;
  const normalizedFocus = normalizeFocus(focus);
  const normalizedPath = normalizeFocus(packagePath);
  if (normalizedPath === normalizedFocus) return 36;
  if (normalizedFocus.endsWith(`/${normalizedPath}`) || normalizedPath.endsWith(`/${normalizedFocus}`)) return 30;
  if (normalizeFocus(packageName) === normalizedFocus) return 36;
  return 0;
}

function normalizeFocus(value) {
  return String(value).trim().toLowerCase().replace(/^\.\//u, "").replace(/\/+$/u, "");
}

function focusFromPrompt(prompt, packages) {
  const normalized = normalizeFocus(prompt);
  return packages.map((pkg) => pkg.packagePath).filter((packagePath) => packagePath !== "" && normalized.includes(normalizeFocus(packagePath))).sort((left, right) => right.length - left.length)[0] ?? null;
}

function fitBudget(result, maxBytes, observed) {
  const mutable = { ...result, functions: [...result.functions], types: [...result.types], scripts: [...result.scripts], packages: [...result.packages] };
  const omitted = { functions: 0, types: 0, scripts: 0, packages: 0 };
  const payload = () => ({ ...mutable, keywordSurfaces: keywordSurfaces(mutable.functions, mutable.types, mutable.scripts, mutable.keywords), completeness: { observed, selected: { functions: mutable.functions.length, types: mutable.types.length, scripts: mutable.scripts.length, packages: mutable.packages.length }, omitted, maxBytes } });
  while (Buffer.byteLength(JSON.stringify(payload()), "utf8") > maxBytes) {
    // Retain the strongest observed evidence regardless of which section owns it.
    // Remove a whole record: coordinates and import routes must remain usable together.
    const candidates = ["functions", "types", "scripts", "packages"].flatMap((section) =>
      mutable[section].map((item, index) => ({ section, index, item,
        score: score(item, mutable.keywords, mutable.focus,
          (value) => value.name ?? value.bin ?? value.package,
          (value) => value.signature ?? value.target ?? value.description ?? ""),
      })));
    candidates.sort((left, right) => left.score - right.score
      || Buffer.byteLength(JSON.stringify(right.item)) - Buffer.byteLength(JSON.stringify(left.item))
      || right.index - left.index);
    const candidate = candidates[0];
    if (!candidate) break;
    mutable[candidate.section].splice(candidate.index, 1);
    omitted[candidate.section] += 1;
  }
  const finalPayload = payload();
  const bytes = Buffer.byteLength(JSON.stringify(finalPayload), "utf8");
  if (bytes > maxBytes) return Object.freeze({ kind: "coding-context.relevance.refusal", reason: "output-budget-too-small", maxBytes, requiredBytes: bytes, promptBytes: Buffer.byteLength(result.prompt, "utf8") });
  return Object.freeze({ ...finalPayload, functions: Object.freeze(mutable.functions), types: Object.freeze(mutable.types), scripts: Object.freeze(mutable.scripts), packages: Object.freeze(mutable.packages), keywordSurfaces: Object.freeze(finalPayload.keywordSurfaces), completeness: Object.freeze({ ...finalPayload.completeness, omitted: Object.freeze(omitted) }) });
}

function relativePackagePath(repoRoot, packageDir) {
  return path.relative(repoRoot, packageDir).split(path.sep).join("/");
}

function optionalText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

function rawText(value) {
  return typeof value === "string" ? value : null;
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function withoutLiteralPaths(value) {
  return value.replace(/(?:[A-Za-z0-9._-]+\/){2,}[A-Za-z0-9._-]+/gu, " ");
}

function boundedInteger(value, { min, max, fallback }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

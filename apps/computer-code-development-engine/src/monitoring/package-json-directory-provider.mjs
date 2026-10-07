import { eachWorkspacePackageDir } from "@red-cup-engineering/javascript-computer";
import path from "node:path";
import { readJSNodePackage } from "../analysis/workspace/workspace.mjs";
import { reviewJsnodePackageDirectory } from "@red-cup-engineering/javascript-normalization-services-section/review-jsnode-package";
import { makeCell } from "@red-cup-engineering/flatfile-resource-graph-service/kernel/cells";
import { projectAttributeCells } from "@red-cup-engineering/flatfile-resource-graph-service/attribute-projection";
import { defineProvider } from "@red-cup-engineering/flatfile-resource-graph-service/provider";
import { DEFAULT_EXCLUDES } from "@red-cup-engineering/flatfile-resource-graph-service/substrate/store";

const JSNODE_PACKAGE_TYPE = "urn:fars:type:package-json-flatfile";
const JSNODE_CARRIER = "urn:fars:jsnode-carrier";

function packageFocus(value, manifestPath) {
  return typeof value?.name === "string" && value.name.trim() !== "" ? value.name : manifestPath;
}

function posixRelative(root, absolutePath) {
  return path.relative(path.resolve(root), absolutePath).split(path.sep).join("/");
}

// JSNode owns the recursive workspace walk. This compatibility filter only
// narrows its observations through its supplied path-exclusion option; it does
// not acquire, read, or parse packages independently.
function pathIsExcluded(relativePath, excludes) {
  const segments = relativePath.split("/");
  return excludes.some((excluded) => segments.includes(excluded));
}

function relationFromUtterance(utterance) {
  const pair = utterance?.token?.mark?.value;
  const predicate = utterance?.claim?.mark?.value;
  if (pair === null || typeof pair !== "object" || Array.isArray(pair)) return null;
  if (typeof pair.subject !== "string" || typeof pair.object !== "string" || typeof predicate !== "string") return null;
  return makeCell({ subject: pair.subject, predicate, object: pair.object });
}

function carrierCells(carrier, resource) {
  const cells = [makeCell({ subject: resource, predicate: JSNODE_CARRIER, object: carrier.term })];
  for (const utterance of carrier.utterances) {
    const relation = relationFromUtterance(utterance);
    if (relation !== null) cells.push(relation);
  }
  return cells;
}

/**
 * Compatibility provider for package.json directories.
 *
 * JSNode owns package discovery, manifest acquisition, and interpretation.
 * The flatfile engine only projects JSNode's native carrier plus its lossless raw manifest into
 * provider cells, which the compositor then admits to the shared DREW web.
 */
export function packageJsonDirectoryProvider({ id, root, excludes = DEFAULT_EXCLUDES }) {
  return defineProvider({ id, async observe({ observedAt } = {}) {
    if (typeof observedAt !== "string" || observedAt === "") throw new TypeError("observe: observedAt is required");
    const resources = [];
    const diagnostics = [];
    for (const discovered of eachWorkspacePackageDir(root)) {
      const manifestPath = posixRelative(root, path.join(discovered.dir, "package.json"));
      if (pathIsExcluded(manifestPath, excludes)) continue;
      const resource = `urn:fars:flatfile:${encodeURIComponent(manifestPath)}`;
      const focus = packageFocus(discovered.manifest, manifestPath);
      const carrier = await readJSNodePackage(discovered.dir);
      const packageReview = reviewJsnodePackageDirectory(discovered.dir);
      if (carrier === undefined) {
        diagnostics.push(Object.freeze({
          code: "jsnode-package-read",
          path: manifestPath,
          message: "JSNode discovered the manifest but could not interpret it as a package",
        }));
        continue;
      }
      try {
        const cells = [
          makeCell({ subject: resource, predicate: "urn:fars:type", object: JSNODE_PACKAGE_TYPE }),
          makeCell({ subject: resource, predicate: "urn:fars:path", object: manifestPath }),
          ...carrierCells(carrier, resource),
          // The normalized JSNode carrier intentionally omits unknown manifest
          // fields. Keep its original parsed manifest beside the carrier so the flatfile engine
          // remains lossless for arbitrary package metadata.
          ...projectAttributeCells({ subject: focus, resource, attributes: { ...discovered.manifest, packageReview } }),
        ];
        resources.push(Object.freeze({ resource, focus, observedAt, cells: Object.freeze(cells), diagnostics: Object.freeze([]) }));
      } catch (error) {
        diagnostics.push(Object.freeze({ code: "package-json-attribute", path: manifestPath, message: error.message }));
      }
    }
    return Object.freeze({ resources: Object.freeze(resources), diagnostics: Object.freeze(diagnostics) });
  } });
}

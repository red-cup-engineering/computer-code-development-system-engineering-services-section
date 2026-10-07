#!/usr/bin/env node
// Extracts one directory of the house repository, with its history, to its own repository and
// composes it back at the same path as a submodule, committed by its exact paths. The target
// repository must exist and be empty; landing the commit on origin/main is the caller's.
//
//   node extract-submodule.mjs --repository <checkout> --directory <path> --name <name> --url <url> --message <message>
import path from "node:path";
import { parseArgs } from "node:util";

import { extractSubmodule } from "../src/workspace/extraction.mjs";

if (import.meta.main) {
  const { values } = parseArgs({ options: { repository: { type: "string", default: process.cwd() }, directory: { type: "string" }, name: { type: "string" }, url: { type: "string" }, message: { type: "string" } } });
  for (const required of ["directory", "name", "url", "message"]) if (!values[required]) throw new Error(`--${required} is required`);
  const result = await extractSubmodule({ repository: path.resolve(values.repository), directory: values.directory, name: values.name, url: values.url, message: values.message });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

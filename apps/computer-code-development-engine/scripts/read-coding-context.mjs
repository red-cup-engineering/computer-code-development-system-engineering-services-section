#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { readCodingContext } from "../src/coding-context/read-coding-context.mjs";
if (import.meta.main) process.stdout.write(`${JSON.stringify(readCodingContext(JSON.parse(readFileSync(0, "utf8"))))}\n`);

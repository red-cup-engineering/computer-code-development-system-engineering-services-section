#!/usr/bin/env node
/**
 * Fabricate one JSNode package from a work order that is a meaning-closure: the jsnode line
 * (jsnode-package-services-section fabricateMarkdownJsnodeOperationPackage) derives its tests from
 * the admitted examples and its sources from the order alone, through the house inference market as
 * this node's machine client (MCP_ORIGIN, MCP_CLIENT_ID, MCP_CLIENT_SECRET), and judges every lot
 * back to the market by what the package's birth found. This script only composes the two: the
 * fabrication line is code, and the market is the system it runs in.
 *
 * Usage: fabricate-jsnode-closure --order <work-order.md> --destination <package dir> [--registry <url>]
 * Prints the fabrication receipt, or the refusal with every derivation attempt, as JSON.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { remoteInferenceMarketFromEnv } from "@red-cup-engineering/computer-inference-engine/dispatch/remote-inference-market";
import { fabricateMarkdownJsnodeOperationPackage } from "@red-cup-engineering/jsnode-package-services-section/fabricate-markdown-jsnode-operation-package";

const { values } = parseArgs({ options: { order: { type: "string" }, destination: { type: "string" }, registry: { type: "string", default: "https://registry.npmjs.org/" } } });
if (!values.order || !values.destination) throw new TypeError("usage: fabricate-jsnode-closure --order <work-order.md> --destination <package dir> [--registry <url>]");

const market = remoteInferenceMarketFromEnv();
const order = path.resolve(values.order);
const result = await fabricateMarkdownJsnodeOperationPackage({
  type: "MarkdownJsnodeOperationPackageFabricationRequest",
  version: 1,
  destination: path.resolve(values.destination),
  registry: values.registry,
  source: { type: "MarkdownDocumentSource", path: order, text: readFileSync(order, "utf8") },
}, {
  infer: ({ taskClass, objective, messages, json, requiredCapabilities, difficulty }) => market.chat({ taskClass, objective, messages, json, requiredCapabilities, difficulty }),
  judge: (lot, outcome, evidence) => market.judge(lot, outcome, evidence),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.type !== "MarkdownJsnodeOperationPackageFabricationReceipt") process.exitCode = 1;

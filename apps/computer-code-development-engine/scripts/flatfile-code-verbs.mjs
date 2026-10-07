import { admitFabricationReceipt } from "../src/operations.mjs";
import { inspectFlatfileResourceWithProviders } from "../src/inspect-flatfile-resource.mjs";

const USAGE = `flatfile-code-verbs <verb>

  admit-fabrication-receipt
  inspect-resource
`;

async function readText(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const VERBS = Object.freeze({
  "inspect-resource": inspectFlatfileResourceWithProviders,
  "admit-fabrication-receipt": admitFabricationReceipt,
});

/** Run one code verb whose request JSON arrives on standard input; the result is the exit status. */
async function main({ argv, stdin, stdout, stderr }) {
  const [verb, ...rest] = argv;
  if (verb === undefined || verb === "help" || verb === "--help" || verb === "-h") {
    stdout.write(USAGE);
    return verb === undefined ? 2 : 0;
  }
  const run = VERBS[verb];
  if (run === undefined) {
    stderr.write(`unknown verb: ${verb}\n\n${USAGE}`);
    return 2;
  }
  if (rest.length !== 0) {
    stderr.write(`${verb}: request JSON must arrive on standard input\n\n${USAGE}`);
    return 2;
  }
  try {
    stdout.write(`${JSON.stringify(await run(JSON.parse(await readText(stdin))))}\n`);
    return 0;
  } catch (error) {
    stderr.write(`flatfile-code-verbs ${verb}: ${error.message}\n`);
    return 1;
  }
}

export const command = Object.freeze({
  run: main,
  resultExitCode: (status) => status,
  formatError: (error) => `${error.message}\n`,
  exitCode: 2,
});

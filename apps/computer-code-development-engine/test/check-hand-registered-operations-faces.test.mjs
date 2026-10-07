import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkHandRegisteredOperations } from "../scripts/check-hand-registered-operations.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "a package manifest carries no hand-registered yields",
    "input": {
      "catalogPath": "package.json",
      "baseline": 0
    },
    "output": {
      "kind": "check-hand-registered-operations",
      "count": 0,
      "baseline": 0,
      "ok": true,
      "families": []
    }
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await checkHandRegisteredOperations(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/check-hand-registered-operations.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}

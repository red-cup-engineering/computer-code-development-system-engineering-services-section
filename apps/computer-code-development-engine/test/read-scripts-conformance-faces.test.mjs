import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readScriptsConformance } from "../scripts/read-scripts-conformance.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "a package without scripts has zero totals",
    "input": {
      "packageDir": "/nonexistent-package-for-the-example"
    },
    "output": {
      "type": "ScriptsConformance",
      "packageDir": "/nonexistent-package-for-the-example",
      "scripts": [],
      "totals": {
        "scripts": 0,
        "conformant": 0,
        "nonconformant": 0,
        "lines": 0
      }
    }
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await readScriptsConformance(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/read-scripts-conformance.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}

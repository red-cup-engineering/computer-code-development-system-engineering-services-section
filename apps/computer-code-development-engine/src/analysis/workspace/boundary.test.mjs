import { test } from "node:test";
import assert from "node:assert/strict";
import { packageBoundaryFailures } from "./boundary.mjs";

const ok = {
  manifest: {
    name: "@x/good",
    main: "./src/index.mjs",
    exports: { ".": "./src/index.mjs", "./package.json": "./package.json" },
    bin: { good: "./src/cli.mjs" },
  },
  srcFiles: ["src/index.mjs", "src/index.test.mjs", "src/cli.mjs"],
};

test("a direct-Node package has no boundary failures", () => {
  assert.deepEqual(packageBoundaryFailures(ok), []);
});

test("main or exports pointing at TypeScript is a failure", () => {
  const failures = packageBoundaryFailures({
    manifest: { name: "@x/leaky", main: "./src/index.mts", exports: { ".": "./src/index.mts" } },
    srcFiles: ["src/index.mts"],
  });
  assert.ok(failures.some((message) => message.includes("main") && message.includes("./src/index.mts")));
  assert.ok(failures.some((message) => message.includes(".") && message.includes("TypeScript")));
});

test("a runtime source tree holding TypeScript is a failure", () => {
  const failures = packageBoundaryFailures({ ...ok, srcFiles: ["src/index.mjs", "src/leaked.mts"] });
  assert.ok(failures.some((message) => message.startsWith("src contains TypeScript runtime files")));
});

test("a bin must point to a JavaScript module", () => {
  const failures = packageBoundaryFailures({ ...ok, manifest: { ...ok.manifest, bin: { good: "./src/cli.mts" } } });
  assert.ok(failures.some((message) => message.startsWith("bin good")));
});

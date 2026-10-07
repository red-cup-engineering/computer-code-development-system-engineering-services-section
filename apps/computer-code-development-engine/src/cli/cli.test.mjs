import assert from "node:assert/strict";
import test from "node:test";
import { formatDuplicationReport, parseArgs } from "./cli.mjs";
test("parses compact duplication limits", () => {
    const parsed = parseArgs(["duplication", "services", "--limit", "12", "--compact"]);
    assert.equal(parsed.command, "duplication");
    assert.equal(parsed.operand, "services");
    assert.equal(parsed.limit, 12);
    assert.equal(parsed.compact, true);
});
test("parses an optional duplication cache directory", () => {
    const parsed = parseArgs(["duplication", "services", "--cache-dir", ".jsnode-duplication-cache"]);
    assert.equal(parsed.cacheDir, ".jsnode-duplication-cache");
    assert.throws(() => parseArgs(["duplication", "--cache-dir"]), /--cache-dir needs a directory/u);
});
test("rejects missing, zero, negative, fractional, and unsafe duplication limits", () => {
    for (const value of [undefined, "0", "-1", "1.5", "9007199254740992"]) {
        const argv = value === undefined ? ["duplication", "--limit"] : ["duplication", "--limit", value];
        assert.throws(() => parseArgs(argv), /--limit must be/u);
    }
});
test("compact duplication projection omits candidate arrays and keeps totals", () => {
    const report = {
        root: "/workspace",
        analyzedPackages: 2,
        analyzedFiles: 2,
        analyzedBehaviors: 2,
        nestedPackageSourceFilesExcluded: 0,
        artifactSourceFilesExcluded: 0,
        unanalyzableSourceFiles: [],
        replicatedPackageCopiesExcluded: 0,
        candidateCount: 8_007,
        candidates: [{
                semanticFingerprint: "abc",
                implementations: [{
                        package: "@x/one",
                        packageDir: "/workspace/one",
                        file: "src/index.mjs",
                        name: "readText",
                        kind: "function",
                        line: 1,
                        bytes: 80,
                        semanticFingerprint: "abc",
                        implementationFingerprint: "variant",
                    }],
                implementationCount: 1,
                implementationVariants: 1,
                packages: ["@x/one"],
                consumers: ["@x/consumer"],
                exactDuplicateBytes: 0,
                removableBytes: 80,
                packageLocalRemovableBytes: 0,
                largestPackageConcentration: {
                    package: "@x/one",
                    implementationCount: 1,
                    totalBytes: 80,
                    removableBytes: 0,
                },
                estimatedSharedOwnerBytes: 80,
                estimatedReferenceOverheadBytes: 256,
                estimatedNetByteSavings: -256,
                owner: null,
                ownerBasis: null,
                ownerEvidence: [],
                classification: "semantic-duplication",
            }],
    };
    const projected = JSON.parse(formatDuplicationReport(report, true));
    assert.equal(projected.candidateCount, 8_007);
    assert.equal(projected.returnedCandidateCount, 1);
    assert.equal(projected.candidates[0]?.implementationCount, 1);
    assert.equal(projected.candidates[0]?.packageCount, 1);
    assert.equal(projected.candidates[0]?.consumerCount, 1);
    assert.equal(projected.candidates[0]?.packageLocalRemovableBytes, 0);
    assert.deepEqual(projected.candidates[0]?.largestPackageConcentration, {
        package: "@x/one",
        implementationCount: 1,
        totalBytes: 80,
        removableBytes: 0,
    });
    for (const key of ["implementations", "packages", "consumers"]) {
        assert.equal(key in (projected.candidates[0] ?? {}), false);
    }
    assert.equal(formatDuplicationReport(report, false), JSON.stringify(report, null, 2) + "\n");
});

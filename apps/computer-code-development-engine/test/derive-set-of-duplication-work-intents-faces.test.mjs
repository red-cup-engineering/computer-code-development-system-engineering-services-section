import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deriveSetOfDuplicationWorkIntents } from "../scripts/derive-set-of-duplication-work-intents.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "one cross-package candidate with an owner-republish plan",
    "input": {
      "candidates": [
        {
          "semanticFingerprint": "c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2",
          "implementations": [
            {
              "name": "praxisFeedbackInterpretation"
            }
          ],
          "packages": [
            "@red-cup-engineering/agentic-knowledge-engine",
            "@red-cup-engineering/metroplat"
          ],
          "consumers": [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g",
            "h"
          ],
          "removableBytes": 2119,
          "owner": "@red-cup-engineering/agentic-knowledge-engine"
        }
      ],
      "plans": [
        {
          "candidate": {
            "semanticFingerprint": "c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2"
          },
          "owner": "@red-cup-engineering/agentic-knowledge-engine",
          "ownerExport": {
            "name": "praxisFeedbackInterpretation"
          },
          "refusals": [
            {
              "reason": "owner-republish-required",
              "detail": "@red-cup-engineering/agentic-knowledge-engine's published 0.1.2 does not yet export \"praxisFeedbackInterpretation\" — publish it, then re-run"
            }
          ]
        }
      ],
      "chain": [
        {
          "cell": "endeavor:ops-561-group",
          "text": "ops.561.group: the ERP/ICS control plane for agents and humans."
        },
        {
          "cell": "campaign:internal-compute-market",
          "parent": "endeavor:ops-561-group",
          "text": "Sell every compute on the internal market."
        },
        {
          "cell": "project:core-stability",
          "parent": "campaign:internal-compute-market",
          "text": "Get the core stable."
        },
        {
          "cell": "plan:2026-09-03-core-stability",
          "parent": "project:core-stability",
          "text": "This week's plan."
        }
      ],
      "derivedAt": "2026-09-05T00:00:00.000Z"
    },
    "output": {
      "type": "DuplicationWorkIntentSet",
      "version": 1,
      "derivedAt": "2026-09-05T00:00:00.000Z",
      "considered": 1,
      "skippedSinglePackage": 0,
      "intents": [
        {
          "kind": "metroplat.work.structured-intent",
          "id": "swi:2026-09-05:migrate-c5d74f3ac47b",
          "producer": {
            "id": "derive-set-of-duplication-work-intents",
            "revision": "0.1.1"
          },
          "sources": [
            {
              "id": "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS",
              "kind": "chain-items-source",
              "locator": "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS"
            },
            {
              "id": "jsnode_duplication#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2",
              "kind": "jsnode-duplication-candidate",
              "locator": "jsnode_duplication#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2"
            },
            {
              "id": "jsnode.duplication-migration.plan#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2",
              "kind": "jsnode-duplication-migration-plan",
              "locator": "jsnode.duplication-migration.plan#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2"
            }
          ],
          "items": [
            {
              "cell": "endeavor:ops-561-group",
              "text": "ops.561.group: the ERP/ICS control plane for agents and humans.",
              "evidence": [
                "chain item admitted verbatim from CHAIN_ITEMS: ops.561.group: the ERP/ICS control plane for agents and humans."
              ],
              "provenance": [
                {
                  "source": "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS",
                  "evidence": [
                    "ops.561.group: the ERP/ICS control plane for agents and humans."
                  ]
                }
              ]
            },
            {
              "cell": "campaign:internal-compute-market",
              "parent": "endeavor:ops-561-group",
              "text": "Sell every compute on the internal market.",
              "evidence": [
                "chain item admitted verbatim from CHAIN_ITEMS: Sell every compute on the internal market."
              ],
              "provenance": [
                {
                  "source": "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS",
                  "evidence": [
                    "Sell every compute on the internal market."
                  ]
                }
              ]
            },
            {
              "cell": "project:core-stability",
              "parent": "campaign:internal-compute-market",
              "text": "Get the core stable.",
              "evidence": [
                "chain item admitted verbatim from CHAIN_ITEMS: Get the core stable."
              ],
              "provenance": [
                {
                  "source": "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS",
                  "evidence": [
                    "Get the core stable."
                  ]
                }
              ]
            },
            {
              "cell": "plan:2026-09-03-core-stability",
              "parent": "project:core-stability",
              "text": "This week's plan.",
              "evidence": [
                "chain item admitted verbatim from CHAIN_ITEMS: This week's plan."
              ],
              "provenance": [
                {
                  "source": "admit-set-of-health-work-intents.mjs#CHAIN_ITEMS",
                  "evidence": [
                    "This week's plan."
                  ]
                }
              ]
            },
            {
              "cell": "task:migrate-consumer-c5d74f3ac47b",
              "parent": "plan:2026-09-03-core-stability",
              "text": "praxisFeedbackInterpretation copied in @red-cup-engineering/agentic-knowledge-engine, @red-cup-engineering/metroplat with 8 consumers, removable 2119 bytes. owner=`@red-cup-engineering/agentic-knowledge-engine`. first step: publish `@red-cup-engineering/agentic-knowledge-engine` exporting `praxisFeedbackInterpretation`, then apply the plan. gate: the plan applies (`jsnode-computer duplication-migration --apply`), the consumers' tests pass, the owner is published, and `jsnode_duplication` no longer lists `c5d74f3ac47b`. modality=MUST force=necessary horizon=now",
              "evidence": [
                "8 consumers",
                "removableBytes=2119"
              ],
              "provenance": [
                {
                  "source": "jsnode_duplication#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2",
                  "evidence": [
                    "removableBytes=2119",
                    "consumers=8"
                  ]
                },
                {
                  "source": "jsnode.duplication-migration.plan#c5d74f3ac47bd1f96432030d60dd22606d633153c6c945008769123ddde1f1a2",
                  "evidence": [
                    "owner-republish-required: @red-cup-engineering/agentic-knowledge-engine's published 0.1.2 does not yet export \"praxisFeedbackInterpretation\" — publish it, then re-run"
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await deriveSetOfDuplicationWorkIntents(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/derive-set-of-duplication-work-intents.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}

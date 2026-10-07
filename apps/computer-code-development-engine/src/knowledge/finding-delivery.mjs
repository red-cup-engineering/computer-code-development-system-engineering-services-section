/**
 * Finding delivery: the pure policy for what a fleet session sees before a Read proceeds.
 *
 * Delivery only saves tokens when it can REPLACE a read, not merely precede it: additionalContext
 * beside a Read adds a card to a session that still loads the whole file, keeps it in context, and
 * re-reads it (as cache reads) on every later turn. A live finding at a file's own address (a
 * file-level card, not only a symbol finding beneath it) is a candidate replacement: for a large
 * whole-file Read, this policy gates the tool call once per session and hands back the card in
 * place of the file, so the session can act on the finding without paying for it. Other Reads
 * proceed directly because adding a card beside the file increases their context cost.
 *
 * `knowledgeGateArmOf` runs gating itself as a controlled experiment: whether a session is gated is
 * a deterministic function of its session id alone, so a readout recomputes every session's arm
 * from the arrival feed instead of tracking assignment as state of its own.
 */
import { createHash } from "node:crypto";

/** A whole-file Read only gates past this size: a card is not worth denying a small file for. */
export const GATE_CHARACTERS = 12_000;
/** The card budget for a gated whole-file Read. */
const CARD_CHARACTERS = 6000;
/** DECLARED estimate (token ≈ 4 chars) — an approximation, not structural truth, matching the
 *  fleet's token-compactification convention (IE `tokens/token-compactification.mjs`). */
const CHARACTERS_PER_TOKEN = 4;

const tokensOf = (characters) => Math.round(characters / CHARACTERS_PER_TOKEN);

/** Whether a session's Reads are gated or proceed directly: a stable 50/50 split of the
 *  session id, so any readout recomputes the arm without keeping assignment as its own state. */
export function knowledgeGateArmOf(sessionId) {
  if (typeof sessionId !== "string" || sessionId === "") return "open";
  const digest = createHash("sha256").update(sessionId).digest();
  return (digest[0] & 1) === 0 ? "gated" : "open";
}

/** The live cards that fit `room` characters, formatted as delivery has always formatted them. */
function cardLines(live, room) {
  const lines = [];
  let left = room;
  for (const finding of live) {
    const line = `- ${finding.address}: ${finding.claim}${finding.producer?.model ? ` (${finding.producer.model})` : ""}`;
    if (line.length > left) break;
    lines.push(line);
    left -= line.length;
  }
  return lines;
}

const isWholeFileRead = (toolInput) => toolInput?.offset === undefined && toolInput?.limit === undefined;

/**
 * What to answer a PreToolUse Read with: `deny` gates the tool call and returns the card(s) in
 * place of the file, or `none` lets the Read proceed without extra context. Gating needs every one
 * of: the gated arm, a whole-file Read (no offset/limit), a file
 * over GATE_CHARACTERS, a live finding at the file's own address (not only beneath it), and no
 * earlier gate of this file in this session (`gatedBefore`, the caller's memory). A session this
 * file was gated for already holds its cards, so a Read after the gate is answered with nothing.
 */
export function readDeliveryOf({ toolInput, sessionId, characters, known, gatedBefore }) {
  if (gatedBefore) return Object.freeze({ kind: "none" });
  const fileLevelFinding = known.live.some((finding) => finding.address === known.address);
  const gates = knowledgeGateArmOf(sessionId) === "gated"
    && isWholeFileRead(toolInput)
    && typeof characters === "number" && characters > GATE_CHARACTERS
    && fileLevelFinding;
  if (!gates) return Object.freeze({ kind: "none" });
  const lines = [
    `Live findings about ${known.address}, each anchored to sources unchanged since it was admitted:`,
    ...cardLines(known.live, CARD_CHARACTERS),
    `${known.address}: ≈${tokensOf(characters)} tokens.`,
    "This finding describes the file at its current version. If it answers what you need, continue without loading the file. To load it anyway, Read it again, or Read a range with offset/limit.",
  ];
  return Object.freeze({ kind: "deny", text: lines.join("\n") });
}

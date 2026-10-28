import type { ScanEvidence } from "~/shared/scan-contract.ts";
import { CLEF_MODEL, clefInput } from "./clef.ts";

/** Hash text evidence and capture/interpretation version before rendering; never share personalized results across users. */
export async function scanInputHash(evidence: ScanEvidence) {
  const input = JSON.stringify({
    interpretation: 9,
    layoutCapture: "official-550-light-lines-v1",
    projectUrl: evidence.viewer.project?.url,
    username: evidence.viewer.username,
    model: CLEF_MODEL,
    input: clefInput(evidence),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

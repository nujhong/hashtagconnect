import type { ScanEvidence } from "~/src/scan-contract.ts";
import { JEV_MODEL, jevInput } from "./jev.ts";

/** Hash text evidence and capture/interpretation version before rendering; never share personalized results across users. */
export async function scanInputHash(evidence: ScanEvidence) {
  const input = JSON.stringify({
    interpretation: 8,
    imageCapture: "official-550-light-v2",
    projectUrl: evidence.viewer.project?.url,
    username: evidence.viewer.username,
    model: JEV_MODEL,
    input: jevInput(evidence),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

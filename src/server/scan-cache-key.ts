import type { ScanEvidence } from "../scan-contract.ts";
import { jevInput } from "./jev.ts";

/** Hash the complete native request plus interpretation version; never share personalized results across users. */
export async function scanInputHash(evidence: ScanEvidence) {
  const input = JSON.stringify({ interpretation: 2, username: evidence.viewer.username, model: "typesafe/jev", input: jevInput(evidence) });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

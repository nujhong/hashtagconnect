import { z } from "zod";
import type { ScanEvidence } from "../scan-contract.ts";

const id = z.string().regex(/^[1-9]\d{0,24}$/);
const oembed = z.object({ html: z.string().trim().min(1).max(80_000), type: z.literal("rich") });

export class XEvidenceError extends Error {}

/** One official oEmbed request for this post. No paid lookup, timeline, iframe scraping or background polling. */
export async function loadPublicEvidence(postId: string, viewer: ScanEvidence["viewer"], request = fetch): Promise<ScanEvidence> {
  id.parse(postId);
  const url = new URL("https://publish.x.com/oembed");
  url.search = new URLSearchParams({
    // oEmbed accepts the ID-only /i/status form; /i/web/status returns 404 for available posts.
    url: `https://twitter.com/i/status/${postId}`, omit_script: "true", hide_thread: "true", dnt: "true",
  }).toString();
  const response = await request(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new XEvidenceError(response.status === 429
    ? "X is limiting embed requests. Try again later."
    : "X couldn’t supply this post’s embed. It may have been removed or made private.");
  const parsed = oembed.safeParse(await response.json());
  if (!parsed.success) throw new XEvidenceError("X returned an incomplete post embed.");
  // Jev reads the text-bearing markup as inert evidence; it is never executed or injected into the page.
  return { viewer, post: { id: postId, html: parsed.data.html } };
}

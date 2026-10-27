import type { ScanPhrase, ScanResult } from "./scan-contract.ts";

/**
 * What the scan adds around the post: up to three of your phrases Jev found in it (the evidence cards), and outlines
 * where it located them, drawn beside X's widget, never instead of it. An outline needs Jev's text check and image
 * presence; low box confidence draws it dashed as approximate. Phrases boxed on the same words share one outline.
 */
export type Spot = {
  phrases: number[];
  box: NonNullable<ScanPhrase["located"]>["box"];
  approximate: boolean;
};
export type Evidence = { phrase: ScanPhrase; index: number };
export type PostLayer = {
  postId: string;
  scanning: boolean;
  /** A result arrived for this post, so an empty `evidence` means nothing stood out, not "not scanned yet". */
  scored: boolean;
  evidence: Evidence[];
  spots: Spot[];
  image: { width: number; height: number } | null;
};

/** The strongest phrases, at most three, keeping their index so cards and outlines can find each other. */
export function evidenceOf(
  result: Extract<ScanResult, { status: "ok" }>,
  strong = 0.5,
): Evidence[] {
  return result.phrases
    .map((phrase, index) => ({ phrase, index }))
    .filter(({ phrase }) => phrase.strength >= strong)
    .sort((a, b) => b.phrase.strength - a.phrase.strength)
    .slice(0, 3);
}

export function postSpots(evidence: Evidence[], present = 0.5, sure = 0.5): Spot[] {
  const spots: Spot[] = [];
  for (const {
    phrase: { located },
    index,
  } of evidence) {
    if (!located || located.presence < present) continue;
    const same = spots.find((spot) => overlap(spot.box, located.box) > 0.6);
    if (same) {
      same.phrases.push(index);
      same.approximate &&= located.confidence < sure;
      continue;
    }
    spots.push({ phrases: [index], box: located.box, approximate: located.confidence < sure });
  }
  return spots;
}

function overlap(a: Spot["box"], b: Spot["box"]) {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const area = (r: Spot["box"]) => (r.right - r.left) * (r.bottom - r.top);
  return (w * h) / (area(a) + area(b) - w * h || 1);
}

/**
 * Boxes are fractions of the server's 550px light capture. They only line up when the live widget renders at
 * that width and roughly that height; otherwise text reflows and the overlay stays off.
 * ponytail: the capture pads short posts to 280px (src/server/post-image.ts), so shorter renders still align from the top.
 */
export function aligns(
  image: { width: number; height: number },
  rendered: { width: number; height: number },
) {
  if (Math.abs(rendered.width - image.width) > 2) return false;
  return image.height <= 280
    ? rendered.height <= 282
    : Math.abs(rendered.height - image.height) <= image.height * 0.04;
}

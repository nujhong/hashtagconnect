import type { ScanEvidence, ScanPhrase } from "~/src/scan-contract.ts";

/**
 * The viewer's own words, split into short phrases Jev can check one at a time and the UI can quote back.
 * Deterministic and model-free, on the bio as X shows it (links as their display text, see x-oauth.ts); hashtags keep their word.
 * Keep every candidate from the length-bounded profile inputs; Jev selects the strongest three after scoring.
 * ponytail: splits on punctuation and "and"/"&"; a smarter splitter if long prose bios produce poor phrases.
 */
export function profilePhrases(
  viewer: ScanEvidence["viewer"],
): Pick<ScanPhrase, "text" | "source">[] {
  const phrases: Pick<ScanPhrase, "text" | "source">[] = [];
  const seen = new Set<string>();
  // A project contributes its topics when the reader supplied them; older saves fall back to splitting the summary.
  const project = viewer.project?.topics?.length
    ? viewer.project.topics.join("\n")
    : viewer.project?.summary;
  const sources = [
    ["bio", viewer.bio],
    ["context", viewer.context],
    ["project", project],
  ] as const;
  for (const [source, text] of sources) {
    // Sentence punctuation only splits before a space or the end, so domains and names like Node.js stay whole.
    const parts = (text ?? "")
      .replace(/#(\w)/g, "$1")
      .split(/[.;:!?]+(?=\s|$)|[|•·\n]+|,\s*|\s[-–—]\s|\s(?:and|&)\s/i);
    for (const raw of parts) {
      // A leading @ is part of a handle, so only other punctuation is trimmed from the start.
      const phrase = raw
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}]+$/gu, "")
        .trim();
      if (!/\p{L}{2}/u.test(phrase) || seen.has(phrase.toLowerCase())) continue;
      seen.add(phrase.toLowerCase());
      phrases.push({ text: phrase, source });
    }
  }
  return phrases;
}

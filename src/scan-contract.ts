/** Safe to serialize to the page; provider credentials stay in the server's scan setup. */
export type ScanAvailability = { status: "ready"; dailyLimit: number | null } | { status: "unavailable" | "needs_bio" | "empty_bio"; reason: string };

/** OAuth supplies the viewer's bio; official oEmbed markup supplies the post. The rendered iframe is never read. */
export type ScanEvidence = {
  viewer: { bio: string; username: string };
  post: { id: string; html: string };
};

export type ScanResult =
  | {
      status: "ok";
      model: string;
      checkedAt: string;
      /** Jev's position on the text-relevance rubric, normalized to 0–100; never a probability. */
      relevance: number;
      tentative: boolean;
      confidence: number;
      signals: { sharedInterest: number; relatedWork: number };
      evidence: { bioDetail: number; postDetail: number };
      source: { bio: string; username: string; postId: string };
      unknowns: string[];
    }
  | { status: "needs_bio"; reason: string }
  | { status: "empty_bio"; reason: string }
  | { status: "not_enough_data"; reason: string }
  | { status: "unavailable"; reason: string; pauseAuto?: boolean };

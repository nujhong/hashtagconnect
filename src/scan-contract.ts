import type { ProjectProfile } from "./project-profile.ts";

/** Safe to serialize to the page; provider credentials stay in the server's scan setup. */
export type ScanAvailability = { status: "ready"; dailyLimit: number | null } | { status: "unavailable" | "needs_bio" | "empty_bio"; reason: string };

/** OAuth supplies the viewer's bio; official oEmbed markup supplies the post. The rendered iframe is never read. */
export type ScanEvidence = {
  viewer: { bio: string; username: string; context?: string; project?: ProjectProfile };
  post: { id: string; html: string };
};

export type ScanResult =
  | {
      status: "ok";
      model: string;
      checkedAt: string;
      /** Jev's position on the text-relevance rubric, normalized to 0–100; never a probability. */
      relevance: number;
      /** Plain-language summary of the strongest supported rubric level, not generated biography. */
      reason: string;
      tentative: boolean;
      confidence: number;
      signals: { sharedInterest: number; relatedWork: number };
      evidence: { bioDetail: number; postDetail: number };
      source: { bio: string; username: string; postId: string; context?: string; project?: ProjectProfile };
      unknowns: string[];
    }
  | { status: "needs_bio"; reason: string }
  | { status: "empty_bio"; reason: string }
  | { status: "not_enough_data"; reason: string }
  | { status: "unavailable"; reason: string; pauseAuto?: boolean };

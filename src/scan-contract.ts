import type { ProjectProfile } from "./project-profile.ts";

/** Safe to serialize to the page; provider credentials stay in the server's scan setup. */
export type ScanAvailability = { status: "ready"; dailyLimit: number | null } | { status: "unavailable" | "needs_bio" | "empty_bio"; reason: string };

/** OAuth supplies the bio; official oEmbed supplies text. A separate official-widget screenshot grounds boxes. */
export type ScanEvidence = {
  viewer: { bio: string; username: string; context?: string; project?: ProjectProfile };
  post: { id: string; html: string; image?: { format: "png" | "jpg"; dataBase64: string; width: number; height: number; theme: "light" } };
};

/** Native candidate boxes in the server-captured image; low presence/confidence must not be treated as a reliable highlight. */
export type ScanBox = {
  signal: "sharedInterest" | "relatedWork" | "projectFit";
  box: { top: number; bottom: number; left: number; right: number };
  presence: number;
  confidence: number;
};

export type ScanResult =
  | {
      status: "ok";
      model: string;
      checkedAt: string;
      /** Jev's position on the text-relevance rubric, normalized to 0–100; never a probability. */
      relevance: number;
      /** Short explanation selected by Jev Choice in the same request as the scores. */
      reason: string;
      tentative: boolean;
      confidence: number;
      boxes: ScanBox[];
      /** Null means localization was unavailable; candidates retain their native presence/confidence. */
      boxImage: { width: number; height: number; theme: "light" } | null;
      signals: { sharedInterest: number; relatedWork: number; projectFit?: number };
      evidence: { bioDetail: number; postDetail: number };
      source: { bio: string; username: string; postId: string; context?: string; project?: ProjectProfile };
      unknowns: string[];
    }
  | { status: "needs_bio"; reason: string }
  | { status: "empty_bio"; reason: string }
  | { status: "not_enough_data"; reason: string; missing?: "viewer" | "post" }
  | { status: "unavailable"; reason: string; pauseAuto?: boolean };

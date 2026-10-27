import type { ProjectProfile } from "./project-profile.ts";

/** Safe to serialize to the page; provider credentials stay in the server's scan setup. */
export type ScanAvailability =
  | { status: "ready" }
  | { status: "unavailable" | "needs_bio" | "empty_bio"; reason: string };

/** OAuth supplies the bio; official oEmbed supplies text. A separate official-widget screenshot grounds phrase boxes in a second request. */
export type ScanEvidence = {
  viewer: { bio: string; username: string; context?: string; project?: ProjectProfile };
  post: {
    id: string;
    html: string;
    image?: {
      format: "png" | "jpg";
      dataBase64: string;
      width: number;
      height: number;
      theme: "light";
    };
  };
};

/**
 * One phrase in the viewer's own words (extracted by the phrase parser). `strength` is Jev's text check that the post seeks or shares it.
 * `located` is a native candidate box in the server-captured image for strong phrases; low presence/confidence must not be treated as a reliable highlight.
 */
export type ScanPhrase = {
  text: string;
  source: "bio" | "context" | "project";
  strength: number;
  located?: {
    box: { top: number; bottom: number; left: number; right: number };
    presence: number;
    confidence: number;
  };
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
      phrases: ScanPhrase[];
      /** Null means localization was unavailable; located phrases retain their native presence/confidence. */
      boxImage: { width: number; height: number; theme: "light" } | null;
      signals: { sharedInterest: number; relatedWork: number; projectFit?: number };
      evidence: { bioDetail: number; postDetail: number };
      source: {
        bio: string;
        username: string;
        postId: string;
        context?: string;
        project?: ProjectProfile;
      };
      unknowns: string[];
    }
  | { status: "needs_bio"; reason: string }
  | { status: "empty_bio"; reason: string }
  | { status: "not_enough_data"; reason: string; missing?: "viewer" | "post" }
  | { status: "unavailable"; reason: string; pauseAuto?: boolean };

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fetch as api, FetchError } from "void/client";
import { postUrl, timeAgo } from "../people";
import type { ScanAvailability, ScanResult } from "../scan-contract";
import { scheduleScan } from "../auto-scan";

/**
 * Profile scan UI. A live scan needs a genuine server session and runs only through POST /api/scan
 * (server-owned; see src/scan-contract.ts). The auth preview and signed-out visitors can only run the demo,
 * which uses fictional data and is never attached to the real author of the post beside it.
 * Results compare the OAuth bio with one connect post, show their sources, and state the unknowns:
 * a text-relevance rating, not relationship compatibility or a human/bot verdict.
 * Scans run automatically for the current post, in a full-width row above the invitation and decisions.
 * Leaving cancels the pending client request; revisiting starts fresh. Service failures pause
 * automatic scanning across posts until the user retries. Results are not cached.
 */
export type ScanAccess = "signed-out" | "preview" | "signed-in";

type Phase = { kind: "idle" } | { kind: "scanning" } | { kind: "done"; demo: boolean; result: ScanResult };

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
// Fictional, with non-numeric IDs so nothing can link to X. Shown only under a "Demo" label.
const DEMO: ScanResult = {
  status: "ok",
  model: "demo",
  checkedAt: new Date(0).toISOString(),
  relevance: 78,
  tentative: false,
  confidence: 0.88,
  signals: { sharedInterest: 0.84, relatedWork: 0.92 },
  evidence: { bioDetail: 0.98, postDetail: 0.97 },
  source: { bio: "Building local-first desktop apps. Design, small tools and side projects.", username: "demo", postId: "demo-post" },
  unknowns: ["Who runs the account", "Whether they’ll reply", "Anything beyond your bio and this post"],
};

/** Calls the server-owned scan route. A response that isn't a scan result is shown as unavailable. */
async function liveScan(postId: string, signal: AbortSignal): Promise<ScanResult> {
  try {
    const data = await api("/api/scan", { method: "POST", body: { postId }, signal, retry: 0 });
    if (data && ["ok", "not_enough_data", "unavailable", "needs_bio", "empty_bio"].includes(data.status)) return data;
  } catch (error) {
    if (error instanceof FetchError && error.status === 401) return { status: "unavailable", reason: "Sign in again to scan.", pauseAuto: true };
    if (error instanceof FetchError && error.status === 429) return { status: "unavailable", reason: "The scan service has reached a limit. Try again later.", pauseAuto: true };
  }
  return { status: "unavailable", reason: "Scan isn’t reachable right now.", pauseAuto: true };
}

export function ScanPanel({ access, availability, postId, pausedReason, onPause, onResume, onSignIn }: {
  access: ScanAccess; availability: ScanAvailability; postId: string; pausedReason: string | null;
  onPause: (reason: string) => void; onResume: () => void; onSignIn: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const canScan = access === "signed-in" && availability.status === "ready";
  useEffect(() => {
    if (!canScan || pausedReason) return;
    setPhase({ kind: "scanning" });
    return scheduleScan(postId, liveScan, (result) => {
      setPhase({ kind: "done", demo: false, result });
      if (result.status === "unavailable" && result.pauseAuto) onPause(result.reason);
    });
  }, [canScan, postId, pausedReason, attempt, onPause]);

  function retry() {
    onResume();
    setAttempt((n) => n + 1);
  }

  const scanning = canScan && !pausedReason && phase.kind !== "done";
  const done = phase.kind === "done" && !pausedReason;
  const scored = done && phase.kind === "done" && phase.result.status === "ok";
  return <section id="bio-scan" className="post-analysis" aria-label="Bio scan">
    {!scored && <header className="scan-heading">
      <p className="scan-label"><span className="scan-glyph" aria-hidden="true" />Bio scan</p>
    </header>}
    <div className="scan">
    <AnimatePresence mode="wait" initial={false}>
      {!canScan && !done && <motion.div key="idle" className="scan-step" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
        {access !== "signed-in" ? <>
          <h2 className="scan-title">Relevant to you?</h2>
          <p className="scan-lede">Sign in to automatically compare each invitation with your X bio.</p>
          <button className="btn scan-go" onClick={onSignIn}>Continue with X <span aria-hidden="true">↗</span></button>
          {access === "preview" && <p className="scan-note">Preview session. Real scans need a real sign-in.</p>}
        </> : availability.status !== "ready" && <Result result={availability} demo={false} onSignIn={onSignIn} />}
        <button className="scan-demo-btn" onClick={() => setPhase({ kind: "done", demo: true, result: DEMO })}>Try the demo</button>
      </motion.div>}

      {scanning && <motion.div key="scanning" className="scan-step" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
        <div className="scan-progress"><Radar /><h2 className="scan-title" role="status">Comparing…</h2></div>
        <p className="scan-lede">Reading your bio alongside this invitation.</p>
      </motion.div>}

      {pausedReason && <motion.div key="paused" className="scan-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
        <h2 className="scan-title">Automatic scans paused.</h2>
        <p className="scan-lede" role="status">{pausedReason}</p>
        <button className="btn sm" onClick={retry}>Retry scan</button>
      </motion.div>}

      {done && phase.kind === "done" && <motion.div key="done" className="scan-step" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
        {phase.demo && <p className="scan-demo-tag">Fictional demo</p>}
        <Result result={phase.result} demo={phase.demo} onSignIn={onSignIn} />
        {(phase.demo || phase.result.status === "unavailable") && <div className="scan-again">
          {phase.demo && <button className="btn sm" onClick={() => setPhase({ kind: "idle" })}>Close demo</button>}
          {phase.result.status === "unavailable" && !phase.demo && <button className="btn sm" onClick={retry}>Retry scan</button>}
        </div>}
      </motion.div>}
    </AnimatePresence>
    </div>
  </section>;
}

function Result({ result, demo, onSignIn }: { result: ScanResult; demo: boolean; onSignIn: () => void }) {
  if (result.status === "empty_bio") return <>
    <h2 className="scan-title">No bio on this account.</h2>
    <p className="scan-lede">{result.reason}</p>
    <button className="btn" onClick={onSignIn}>Return to X sign-in</button>
  </>;
  if (result.status === "needs_bio") return <>
    <h2 className="scan-title">Bring your bio.</h2>
    <p className="scan-lede">{result.reason}</p>
    <button className="big scan-go" onClick={onSignIn}>Refresh X bio</button>
  </>;
  if (result.status === "not_enough_data") return <>
    <h2 className="scan-title">Not enough to go on.</h2>
    <p className="scan-lede">{result.reason}</p>
  </>;
  if (result.status === "unavailable") return <>
    <h2 className="scan-title">Scan isn’t available right now.</h2>
    <p className="scan-lede">{result.reason}</p>
  </>;
  return <>
    <div className="scan-result">
      <div className="scan-overall">
        <motion.div className="scan-rating" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <h2 className="scan-score" aria-label={`${result.relevance} out of 100. Relevance to you.`}>{result.relevance}<span aria-hidden="true">/100</span></h2>
          <div className="scan-rating-copy"><span className="scan-kicker">Bio scan</span><p>Relevance<span className="scan-long-label"> to you</span></p>{result.tentative && <span className="scan-tentative">Tentative</span>}</div>
        </motion.div>
      </div>
      <dl className="scan-signals" aria-label="Supporting signals">
        <div><dt>Interests in common</dt><dd>{Math.round(result.signals.sharedInterest * 100)}<span>%</span></dd></div>
        <div><dt>Related work</dt><dd>{Math.round(result.signals.relatedWork * 100)}<span>%</span></dd></div>
      </dl>
    </div>
    <details className="scan-evidence">
      <summary>Sources</summary>
      {demo
        ? <div className="scan-quotes"><Quote who="Them" text="Shipping a tiny desktop app this weekend. Who else is building local-first tools?" /><Quote who="You" text={result.source.bio} /></div>
        : <SourcePair source={result.source} />}
      {!demo && <p className="scan-foot">Scanned {timeAgo(Date.parse(result.checkedAt))}.</p>}
    </details>
  </>;
}

/**
 * A real comparison: the viewer's bio and a link to the source post. The official embed stays in the
 * post column, so the scan never needs a duplicate widget. X's display requirements want author identity
 * and unmodified text, so real posts are never re-typeset as our own quote cards.
 */
function SourcePair({ source }: { source: Extract<ScanResult, { status: "ok" }>["source"] }) {
  return <div className="scan-source">
    <div className="scan-source-head">
      <b>Your bio</b>
      {source.username && <a href={`https://x.com/${encodeURIComponent(source.username)}`} target="_blank" rel="noopener noreferrer">@{source.username} <span aria-hidden="true">↗</span></a>}
    </div>
    <p className="scan-bio">{source.bio}</p>
    <div className="scan-source-head">
      <a href={postUrl(source.postId)} target="_blank" rel="noopener noreferrer">Their connect post <span aria-hidden="true">↗</span></a>
    </div>
  </div>;
}

/** A fictional demo post as a quote card. Demo posts have no real source, so they never link. */
function Quote({ who, text }: { who: string; text: string }) {
  return <blockquote className={`scan-quote${who === "You" ? " you" : ""}`}>
    <p>{text}</p>
    <footer><span>{who}</span></footer>
  </blockquote>;
}

/** Concentric rings with a rotating sweep while scanning; still with reduced motion. */
function Radar() {
  const reduced = useReducedMotion();
  return <div className="radar" aria-hidden="true">
    <span /><span /><span />
    {!reduced && <motion.b animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} />}
  </div>;
}

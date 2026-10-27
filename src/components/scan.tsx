import { useEffect, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { fetch as api, FetchError } from "void/client";
import { postUrl, timeAgo } from "~/src/people";
import type { ScanAvailability, ScanResult } from "~/src/scan-contract";
import { evidenceOf, postSpots, type PostLayer } from "~/src/scan-layer";
import { profileInputLabel, type ViewerProfile } from "~/src/project-profile";
import { scheduleScan } from "~/src/auto-scan";

/**
 * Profile scan UI. A live scan needs a genuine server session and runs only through POST /api/scans
 * (defined by the server-owned scan contract), so this panel is for signed-in members only. Signed-out visitors get SignedOutIntro instead, which never shows real or invented scan data.
 * Results compare the OAuth bio and confirmed private context with one connect post, show their sources, and state the unknowns:
 * a text-relevance rating, not relationship compatibility or a human/bot verdict.
 * Scans run automatically for the current post, in a full-width row above the invitation and decisions.
 * Leaving cancels the pending client request. Local revisits start fresh; production can reuse unchanged inputs.
 * Service failures pause automatic scanning across posts until the user retries.
 * `onLayer` tells the post beside it to sweep while scanning, and hands over your phrases Jev found in it and where.
 */
type Phase = { kind: "idle" } | { kind: "scanning" } | { kind: "done"; result: ScanResult };

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
const fill = { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] } as const;
/** Calls the server-owned scan route. A response that isn't a scan result is shown as unavailable. */
async function liveScan(postId: string, signal: AbortSignal): Promise<ScanResult> {
  try {
    const data = await api("/api/scans", { method: "POST", body: { postId }, signal, retry: 0 });
    if (
      data &&
      ["ok", "not_enough_data", "unavailable", "needs_bio", "empty_bio"].includes(data.status)
    )
      return data;
  } catch (error) {
    if (error instanceof FetchError && error.status === 401)
      return { status: "unavailable", reason: "Sign in again to scan.", pauseAuto: true };
    if (error instanceof FetchError && error.status === 429)
      return {
        status: "unavailable",
        reason: "The scan service has reached a limit. Try again later.",
        pauseAuto: true,
      };
  }
  return { status: "unavailable", reason: "Scan isn’t reachable right now.", pauseAuto: true };
}

export function ScanPanel({
  profile,
  availability,
  postId,
  preparingProject = false,
  pausedReason,
  onPause,
  onResume,
  onSignIn,
  onProfile,
  onLayer,
}: {
  profile: ViewerProfile;
  availability: ScanAvailability;
  postId: string;
  preparingProject?: boolean;
  pausedReason: string | null;
  onPause: (reason: string) => void;
  onResume: () => void;
  onSignIn: () => void;
  onProfile: () => void;
  onLayer: (layer: PostLayer) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const canScan = availability.status === "ready" && !preparingProject;
  useEffect(() => {
    if (!canScan || pausedReason) return;
    setPhase({ kind: "scanning" });
    return scheduleScan(postId, liveScan, (result) => {
      setPhase({ kind: "done", result });
      if (result.status === "unavailable" && result.pauseAuto) onPause(result.reason);
    });
  }, [canScan, postId, pausedReason, attempt, onPause]);

  function retry() {
    onResume();
    setAttempt((n) => n + 1);
  }

  const scanning = preparingProject || (canScan && !pausedReason && phase.kind !== "done");
  const done = phase.kind === "done" && !pausedReason;
  const scored = done && phase.kind === "done" && phase.result.status === "ok";
  const live = done && phase.kind === "done" && phase.result.status === "ok" ? phase.result : null;
  useEffect(() => {
    const evidence = live ? evidenceOf(live) : [];
    onLayer({
      postId,
      scanning,
      scored: Boolean(live),
      evidence,
      spots: postSpots(evidence),
      image: live?.boxImage ?? null,
    });
  }, [postId, scanning, live, onLayer]);
  const showInputs = Boolean(profile.bio?.trim() || profile.sentence.trim() || profile.project);
  const inputs = showInputs ? (
    <button className="scan-inputs" onClick={onProfile} title={profileInputLabel(profile)}>
      {profileInputLabel(profile)}
    </button>
  ) : null;
  return (
    <section id="relevance" className="post-analysis" aria-label="Relevance">
      {!scored && !scanning && (
        <header className="scan-heading">
          <p className="scan-label">Relevance</p>
          {inputs}
        </header>
      )}
      <div className="scan">
        <AnimatePresence mode="wait" initial={false}>
          {availability.status !== "ready" && !preparingProject && !done && (
            <motion.div
              key="idle"
              className="scan-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring}
            >
              <Result result={availability} onSignIn={onSignIn} onProfile={onProfile} />
            </motion.div>
          )}

          {scanning && (
            <motion.div
              key="scanning"
              className="scan-step is-scanning"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              <div className="scan-result">
                <div className="scan-overall">
                  <Sticker />
                  <div className="scan-copy">
                    <h2 className="scan-reason" role="status">
                      {preparingProject ? "Reading your project…" : "Reading this invitation…"}
                    </h2>
                    <p className="scan-meta">
                      <span>
                        {preparingProject
                          ? "Adding context from your bio link"
                          : "Comparing it with your profile"}
                      </span>
                      {inputs}
                    </p>
                  </div>
                </div>
                <dl className="scan-signals" aria-hidden="true">
                  {signalRows.map(([signal, label]) => (
                    <Signal key={signal} label={label} />
                  ))}
                </dl>
              </div>
            </motion.div>
          )}

          {pausedReason && (
            <motion.div
              key="paused"
              className="scan-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              <h2 className="scan-title">Automatic scans paused.</h2>
              <p className="scan-lede" role="status">
                {pausedReason}
              </p>
              <button className="btn sm" onClick={retry}>
                Retry scan
              </button>
            </motion.div>
          )}

          {done && phase.kind === "done" && (
            <motion.div
              key="done"
              className="scan-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              <Result
                result={phase.result}
                inputs={inputs}
                onSignIn={onSignIn}
                onProfile={onProfile}
              />
              {phase.result.status === "unavailable" && (
                <div className="scan-again">
                  <button className="btn sm" onClick={retry}>
                    Retry scan
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Result({
  result,
  inputs = null,
  onSignIn,
  onProfile,
}: {
  result: ScanResult;
  inputs?: ReactNode;
  onSignIn: () => void;
  onProfile: () => void;
}) {
  if (result.status === "empty_bio")
    return (
      <>
        <h2 className="scan-title">A little more about you.</h2>
        <p className="scan-lede">{result.reason}</p>
        <button className="btn" onClick={onProfile}>
          Add a project
        </button>
      </>
    );
  if (result.status === "needs_bio")
    return (
      <>
        <h2 className="scan-title">Bring your bio.</h2>
        <p className="scan-lede">{result.reason}</p>
        <div className="scan-again">
          <button className="btn" onClick={onProfile}>
            Add a project
          </button>
          <button className="link" onClick={onSignIn}>
            Refresh X bio
          </button>
        </div>
      </>
    );
  if (result.status === "not_enough_data")
    return (
      <>
        <h2 className="scan-title">Not enough to go on.</h2>
        <p className="scan-lede">{result.reason}</p>
        {result.missing === "viewer" && (
          <button className="btn" onClick={onProfile}>
            Add a project
          </button>
        )}
      </>
    );
  if (result.status === "unavailable")
    return (
      <>
        <h2 className="scan-title">Scan isn’t available right now.</h2>
        <p className="scan-lede">{result.reason}</p>
      </>
    );
  // Phones show your phrases here as chips; wider screens show them as evidence cards beside the post.
  const evidence = evidenceOf(result);
  return (
    <div className="scan-result">
      <div className="scan-overall">
        <Sticker value={result.relevance} />
        <div className="scan-copy">
          <h2 className="scan-reason">{result.reason}</h2>
          <p className="scan-meta">
            <span>
              Relevance<span className="scan-long-label"> to you</span>
            </span>
            {result.tentative && <span className="scan-tentative">Tentative</span>}
            {inputs}
            <button className="scan-sources-btn" popoverTarget="scan-sources">
              Sources
            </button>
          </p>
          {evidence.length > 0 && (
            <ul className="scan-chips" aria-label="From your profile">
              {evidence.map(({ phrase, index }) => (
                <li key={index}>“{phrase.text}”</li>
              ))}
            </ul>
          )}
          {/* A light-dismiss popover anchored to its button, so opening Sources never moves the page. */}
          <div id="scan-sources" className="scan-sources" popover="auto">
            <SourcePair source={result.source} />
            <p className="scan-foot">Scanned {timeAgo(Date.parse(result.checkedAt))}.</p>
          </div>
        </div>
      </div>
      <dl className="scan-signals" aria-label="Supporting signals">
        {signalRows.map(([signal, label], i) => (
          <Signal
            key={signal}
            label={label}
            value={result.signals[signal]}
            delay={0.25 + i * 0.1}
            scored
          />
        ))}
      </dl>
    </div>
  );
}
/**
 * Signed out: what hashtagconnect does, in the scan block's place, whether or not there is a
 * post to show. Anonymous browsing still works below it. No real or invented scan data: step two shows the idea, a
 * highlight, not a score.
 */
export function SignedOutIntro({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section id="relevance" className="post-analysis intro" aria-label="How hashtagconnect works">
      <div className="intro-lead">
        <h2 className="scan-title">Find your first circle on X.</h2>
        <p className="scan-lede">Meet people interested in what you share, create or sell.</p>
        <button className="btn primary scan-go" onClick={onSignIn}>
          Continue with X <span aria-hidden="true">↗</span>
        </button>
      </div>
      <ol className="intro-steps">
        <li>
          <b>Browse #connect posts</b>
          <span>People asking to connect, one at a time. Try it below.</span>
        </li>
        <li>
          <b>
            See what you have <mark>in common</mark>
          </b>
          <span>Sign in and we compare your profile with each post.</span>
        </li>
        <li>
          <b>Keep them in your Stash, then connect on X</b>
          <span>Open their profiles from Stash to follow or say hello on X.</span>
        </li>
      </ol>
    </section>
  );
}

/**
 * A real comparison: the viewer's bio and a link to the source post. The official embed stays in the
 * post column, so the scan never needs a duplicate widget. X's display requirements want author identity
 * and unmodified text, so real posts are never re-typeset as our own quote cards.
 */
function SourcePair({ source }: { source: Extract<ScanResult, { status: "ok" }>["source"] }) {
  return (
    <div className="scan-source">
      <div className="scan-source-head">
        <b>Your bio</b>
        {source.username && (
          <a
            href={`https://x.com/${encodeURIComponent(source.username)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            @{source.username} <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      <p className="scan-bio">{source.bio || "No X bio supplied."}</p>
      {source.context && (
        <>
          <b>Your optional context</b>
          <p className="scan-bio">{source.context}</p>
        </>
      )}
      {source.project && (
        <>
          <div className="scan-source-head">
            <b>Your project</b>
            <a href={source.project.url} target="_blank" rel="noopener noreferrer">
              Source ↗
            </a>
          </div>
          <p className="scan-bio">{source.project.summary}</p>
        </>
      )}
      <div className="scan-source-head">
        <a href={postUrl(source.postId)} target="_blank" rel="noopener noreferrer">
          Their connect post <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

const signalRows = [
  ["sharedInterest", "Interests in common"],
  ["relatedWork", "Related work"],
  ["projectFit", "Project fit"],
] as const;

/** One supporting probability on a single line with its meter. Without `scored` it is a pending placeholder. */
function Signal({
  label,
  value,
  delay = 0,
  scored,
}: {
  label: string;
  value?: number;
  delay?: number;
  scored?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span
          className={`meter${scored && value === undefined ? " is-empty" : ""}`}
          aria-hidden="true"
        >
          {scored && value !== undefined && (
            <motion.b
              initial={{ scaleX: 0 }}
              animate={{ scaleX: value }}
              transition={{ ...fill, delay }}
            />
          )}
        </span>
        {!scored ? (
          <span className="scan-pending" />
        ) : value === undefined ? (
          <span
            className="scan-none"
            aria-label="No project provided"
            title="Add a project to assess its fit"
          >
            —
          </span>
        ) : (
          <span className="scan-pct">
            {Math.round(value * 100)}
            <small>%</small>
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * The score as a lime sticker: it slaps on and counts up to the score. Without a value it waits, dashed, while
 * scanning. Still with reduced motion.
 */
function Sticker({ value }: { value?: number }) {
  const reduced = useReducedMotion();
  const count = useMotionValue(0);
  const shown = useTransform(count, Math.round);
  useEffect(() => {
    if (value === undefined) return;
    if (reduced) {
      count.set(value);
      return;
    }
    const run = animate(count, value, fill);
    return () => run.stop();
  }, [value, reduced, count]);
  if (value === undefined)
    return (
      <div className="score-sticker is-busy" aria-hidden="true">
        <span>···</span>
      </div>
    );
  return (
    <motion.div
      className="score-sticker"
      initial={reduced ? false : { scale: 1.35, rotate: -14 }}
      animate={{ scale: 1, rotate: -5 }}
      transition={{ type: "spring", stiffness: 520, damping: 18 }}
    >
      <p className="scan-score">
        <span className="sr">{value} out of 100</span>
        <motion.span aria-hidden="true">{shown}</motion.span>
        <small aria-hidden="true">/100</small>
      </p>
    </motion.div>
  );
}

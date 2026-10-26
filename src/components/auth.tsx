import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { auth } from "void/client";
import { Modal } from "./ui";

/** Sign-in journey (handoff, cancel, error, preview) and the signed-in account menu. Native Better Auth only. */
export type AuthStep = "handoff" | "cancelled" | "error";
export type Account = { name: string; image: string | null; username: string | null; curator: boolean; preview: boolean };
const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

/** Reads what Better Auth put on the URL after the X round trip, then cleans the URL. */
export function readAuthReturn(): { step?: AuthStep; code?: string; returned?: boolean; signedOut?: boolean } {
  const q = new URLSearchParams(location.search);
  const error = q.get("error");
  const result = {
    step: error === "access_denied" ? "cancelled" as const : error || q.get("auth") === "failed" ? "error" as const : undefined,
    code: error ?? undefined,
    returned: q.get("auth") === "welcome",
    signedOut: q.get("auth") === "signedout",
  };
  if (error || q.has("auth")) history.replaceState(null, "", location.pathname);
  return result;
}

/**
 * hashtagconnect ↔ X. One cord tells the sign-in story: drawing while the browser is
 * handed to X, cut when you cancel, broken when it fails.
 */
function Patch({ step }: { step: AuthStep }) {
  const reduced = useReducedMotion();
  const loop = step === "handoff" && !reduced;
  const broken = step === "cancelled" || step === "error";
  return <div className={`patch is-${step}`} aria-hidden="true">
    <span className="node hash">#</span>
    <svg className="patch-cord" viewBox="0 0 200 40" preserveAspectRatio="none">
      {broken ? <>
        <motion.path d="M0 20 C 30 20, 50 34, 82 36" className="cord" initial={{ pathLength: 1 }} animate={{ pathLength: 1 }} />
        <motion.path d="M118 36 C 150 34, 170 20, 200 20" className="cord" initial={{ pathLength: 1 }} animate={{ pathLength: 1 }} />
      </> : <>
        <path d="M0 20 C 60 38, 140 38, 200 20" className="cord-bg" />
        <motion.path d="M0 20 C 60 38, 140 38, 200 20" className="cord"
          initial={{ pathLength: 0 }} animate={{ pathLength: loop ? [0, 1] : 1 }}
          transition={loop ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }} />
      </>}
    </svg>
    <span className="node x">𝕏</span>
  </div>;
}

/** Hands this tab to X's own authorization page. Without X credentials it only shows the preview handoff. */
export async function beginXSignIn(authReady: boolean, onStep: (s: AuthStep, code?: string) => void) {
  onStep("handoff");
  if (!authReady) return;
  try {
    const r = await auth.signIn.social({ provider: "twitter", callbackURL: "/?auth=welcome", errorCallbackURL: "/?auth=failed" });
    if (r.error) onStep("error", r.error.code ?? r.error.message);
  } catch { onStep("error", "network"); }
}

/** What X will ask you to approve, for anyone who wants to know before X's own page says it. */
function AccessDetails() {
  return <details className="access">
    <summary>Access details</summary>
    <p>X grants read access (<code>tweet.read</code>, <code>users.read</code>). Your name, username and photo identify your account; your bio powers automatic relevance scans. No posting or follow access.</p>
  </details>;
}

export function SignInSheet({ step, code, authReady, onStep, onClose, onPreviewReturn }: {
  step: AuthStep; code?: string; authReady: boolean;
  onStep: (s: AuthStep, code?: string) => void; onClose: () => void; onPreviewReturn: () => void;
}) {
  const go = () => beginXSignIn(authReady, onStep);
  // When a step replaces the button that was just pressed, move focus to the new step's heading
  // so keyboard and screen-reader users land on (and hear) the new state.
  const stepRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    stepRef.current?.querySelector("h2")?.focus();
  }, [step]);
  const body: Record<AuthStep, ReactNode> = {
    handoff: <>
      <h2 tabIndex={-1}>{authReady ? "Opening X…" : "X would open now."}</h2>
      {authReady
        ? <p>Approve on X and you’ll land back here. Future saves stay on your account.</p>
        : <>
            <p>Approving keeps future saves on your account. Pick what X does:</p>
            <div className="sim">
              <button className="btn primary" onClick={onPreviewReturn}>Approve</button>
              <button className="btn" onClick={() => onStep("cancelled")}>Cancel on X</button>
              <button className="btn" onClick={() => onStep("error", "invalid_code")}>Fail</button>
            </div>
          </>}
      <AccessDetails />
    </>,
    cancelled: <>
      <h2 tabIndex={-1}>Cancelled. Nothing was shared.</h2>
      <p>You can keep going in this browser.</p>
      <button className="btn primary block" onClick={go}>Try again</button>
      <button className="btn quiet block" onClick={onClose}>Not now</button>
    </>,
    error: <>
      <h2 tabIndex={-1}>That didn’t go through.</h2>
      <p>The sign-in didn’t finish or it expired. Another try usually works.</p>
      <button className="btn primary block" onClick={go}>Try again</button>
      <button className="btn quiet block" onClick={onClose}>Not now</button>
      {code && <p className="fine">Reference <code>{code}</code></p>}
    </>,
  };
  return <Modal label="Continue with X" onClose={onClose}>
    {!authReady && <p className="preview-tag">Preview · no real sign-in happens</p>}
    <Patch step={step} />
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={step} ref={stepRef} className="sheet-step" role="region" aria-live="polite" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
        {body[step]}
      </motion.div>
    </AnimatePresence>
  </Modal>;
}

export function AccountMenu({ account, onPrivacy, onSignOut }: { account: Account; onPrivacy: () => void; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Standard menu dismissal: outside click or Escape.
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const handle = account.username ? `@${account.username}` : account.name;
  return <div className="account" ref={ref}>
    <button className={`avatar-btn${account.preview ? " is-preview" : ""}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
      {account.image ? <img src={account.image} alt="" /> : <span>{account.name[0]}</span>}
      <span className="sr">Account: {handle}</span>
    </button>
    <AnimatePresence>
      {open && <motion.div className="menu" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={spring}>
        <div className="menu-head">
          <b>{account.name}</b>
          <span>{handle}{account.curator && <em className="badge">Curator</em>}</span>
          <small>{account.preview ? "Preview account · not a real session" : "Signed in with X · read-only access"}</small>
        </div>
        <button onClick={() => { setOpen(false); onPrivacy(); }}>Settings & privacy</button>
        <button className="danger" disabled={leaving} onClick={async () => { setLeaving(true); await onSignOut(); setLeaving(false); }}>
          {leaving ? "Signing out…" : "Sign out"}
        </button>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

import { useEffect, useState } from "react";
import { fetch as api } from "void/client";
import { Modal } from "./ui";
import { submissionInput } from "../submission";

/** One optional sentence augments the OAuth bio without changing provider-owned identity fields. */
export function BioContext({ bio, sentence }: { bio: string | null; sentence: string }) {
  const [value, setValue] = useState(sentence || (bio ?? "").slice(0, 280));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <details className="access context-editor">
    <summary>Your bio & context</summary>
    <p className="fine">Scans use your X bio. Add or edit one sentence only if it helps.</p>
    {bio && <blockquote className="context-bio">{bio}</blockquote>}
    <form className="community-form" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try { await api("/api/context", { method: "POST", body: { sentence: value } }); window.location.reload(); }
      catch { setError("Couldn’t save your context. Try again."); setBusy(false); }
    }}>
      <label htmlFor="viewer-context">What are you building or sharing? <small>Optional</small></label>
      <textarea id="viewer-context" value={value} maxLength={280} rows={3} onChange={(event) => setValue(event.target.value)} />
      <p className="fine">Private scan context. Leave blank to use only your X bio.</p>
      <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save context"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </details>;
}

/** Submitting requests a curator review; it does not add a person to discovery. */
export function GetListed({ username, onClose }: { username: string | null; onClose: () => void }) {
  const [profileUrl, setProfile] = useState(username ? `https://x.com/${username}` : "");
  const [postUrl, setPost] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/submissions").then(({ submission }) => {
      if (!active) return;
      if (submission) { setProfile(submission.profileUrl); setPost(submission.postUrl); setDescription(submission.description); setStatus(submission.status); }
      setReady(true);
    }).catch(() => { if (active) setError("Couldn’t load your submission. Close and try again."); });
    return () => { active = false; };
  }, []);
  return <Modal label="Get listed" onClose={onClose}>
    <h2>Get listed.</h2>
    <p>Share a public post that shows what you’re about and who you want to connect with.</p>
    {status && <p className="submission-status" role="status">{status === "pending" ? "Waiting for curator review." : status === "published" ? "Reviewed and published. Changes go back for review." : "Not included this time. You can revise and resubmit."}</p>}
    <form className="community-form" onSubmit={async (event) => {
      event.preventDefault();
      const parsed = submissionInput.safeParse({ profileUrl, postUrl, description });
      if (!parsed.success) { setError(parsed.error.issues[0]!.message); return; }
      setBusy(true); setError("");
      try { const result = await api("/api/submissions", { method: "POST", body: parsed.data }); setStatus(result.submission.status); }
      catch { setError("Couldn’t submit. Try again."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="listing-profile">X profile</label>
      <input id="listing-profile" disabled={!ready || busy} value={profileUrl} maxLength={200} required placeholder="https://x.com/you" onChange={(event) => setProfile(event.target.value)} />
      <label htmlFor="listing-post">Public post</label>
      <input id="listing-post" disabled={!ready || busy} type="url" value={postUrl} maxLength={500} required placeholder="https://x.com/you/status/…" onChange={(event) => setPost(event.target.value)} />
      <label htmlFor="listing-description">Anything to add? <small>Optional</small></label>
      <textarea id="listing-description" disabled={!ready || busy} value={description} maxLength={280} rows={2} onChange={(event) => setDescription(event.target.value)} />
      <p className="fine">Reviewed manually. Submitting doesn’t guarantee inclusion or follow-backs.</p>
      <button className="btn primary" disabled={!ready || busy}>{busy ? "Sending…" : status ? "Update submission" : "Submit for review"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </Modal>;
}

type ReviewData = Awaited<ReturnType<typeof loadReview>>;
const loadReview = () => api("/api/review");

/** The curator sees pending submissions and aggregate first-party milestones, never private Stashes. */
export function Review({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    try { setData(await loadReview()); setError(""); } catch { setError("Couldn’t load reviews. Try again."); }
  };
  useEffect(() => { void refresh(); }, []);
  return <Modal label="Curator review" onClose={onClose}>
    <h2>Review submissions.</h2>
    {data && <>
      <details className="access"><summary>Experiment results</summary>
        <dl className="experiment-metrics">
          {([["Signed-in visitors", data.metrics.visitors], ["First Keep", data.metrics.kept], ["First open on X", data.metrics.opened], ["Returned another day", data.metrics.returned], ["Found someone worth connecting with", `${data.metrics.useful} / ${data.metrics.responses} responses`]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl><p className="fine">Since measurement started. Openings are clicks, not confirmed follows or connections.</p>
      </details>
      <p className="fine">Oldest pending first · up to 100 at a time.</p>
      {data.pending.length === 0 && <p>No submissions waiting.</p>}
      {data.pending.map((submission) => <ReviewItem key={submission.version} submission={submission} onReviewed={() => { void refresh(); onPublished(); }} />)}
    </>}
    {!data && !error && <p role="status">Loading…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <button className="btn quiet" onClick={refresh}>Refresh</button>
  </Modal>;
}

function ReviewItem({ submission, onReviewed }: { submission: ReviewData["pending"][number]; onReviewed: () => void }) {
  const [checked, setChecked] = useState(false);
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(action: "publish" | "decline") {
    setBusy(true); setError("");
    try {
      await api("/api/review", { method: "POST", body: { id: submission.id, version: submission.version, action, confirmed: checked, tags: tags.split(/[ ,]+/).map((tag) => tag.replace(/^#/, "").toLowerCase()).filter(Boolean) } });
      onReviewed();
    } catch { setError("Review wasn’t saved. Check tags (up to 8, letters/numbers/underscores) or refresh if the submission changed."); }
    finally { setBusy(false); }
  }
  return <section className="review-item">
    <a href={submission.profileUrl} target="_blank" rel="noopener noreferrer">{submission.profileUrl.replace("https://x.com/", "@")} ↗</a>
    <a href={submission.postUrl} target="_blank" rel="noopener noreferrer">View post ↗</a>
    {submission.description && <p>{submission.description}</p>}
    <label>Hashtags in the post <input value={tags} maxLength={328} placeholder="#connect, #design" onChange={(event) => setTags(event.target.value)} /></label>
    <label className="check"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />I checked the author and their intent to connect on X.</label>
    <div className="review-actions"><button className="btn primary" disabled={busy || !checked} onClick={() => review("publish")}>Publish</button><button className="btn" disabled={busy} onClick={() => review("decline")}>Decline</button></div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

/** Voluntary self-report after an app-owned link opens; no claim that a connection occurred. */
export function ConnectionFeedback({ onAnswer }: { onAnswer: (value: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function answer(value: boolean) {
    setBusy(true); setError("");
    try { await onAnswer(value); } catch { setError("Couldn’t save your answer."); } finally { setBusy(false); }
  }
  return <div className="connection-feedback">
    <span>Found someone worth connecting with?</span>
    <button className="link" disabled={busy} onClick={() => answer(true)}>Yes</button>
    <button className="link" disabled={busy} onClick={() => answer(false)}>Not yet</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}

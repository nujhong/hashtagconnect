import { useState } from "react";
import { fetch as api } from "void/client";

/** One optional sentence augments the OAuth bio without changing provider-owned identity fields. */
export function BioContext({
  bio,
  sentence,
  onSaved,
}: {
  bio: string | null;
  sentence: string;
  onSaved: (sentence: string) => void;
}) {
  const [value, setValue] = useState(sentence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <details className="access context-editor">
      <summary>Your X bio & extra context</summary>
      <p className="fine">Scans use your X bio. Add or edit one sentence only if it helps.</p>
      {bio && <blockquote className="context-bio">{bio}</blockquote>}
      <form
        className="community-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const saved = await api("/api/me/context", {
              method: "POST",
              body: { sentence: value },
            });
            onSaved(saved.sentence);
          } catch {
            setError("Couldn’t save your context. Try again.");
            setBusy(false);
          }
        }}
      >
        <label htmlFor="viewer-context">
          What are you building or sharing? <small>Optional</small>
        </label>
        <textarea
          id="viewer-context"
          value={value}
          maxLength={280}
          rows={3}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className="fine">Private scan context. Leave blank to use your bio and saved project.</p>
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save context"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}

/** Voluntary self-report after an app-owned link opens; no claim that a connection occurred. */
export function ConnectionFeedback({ onAnswer }: { onAnswer: (value: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function answer(value: boolean) {
    setBusy(true);
    setError("");
    try {
      await onAnswer(value);
    } catch {
      setError("Couldn’t save your answer.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="connection-feedback">
      <span>Found someone worth connecting with?</span>
      <button className="link" disabled={busy} onClick={() => answer(true)}>
        Yes
      </button>
      <button className="link" disabled={busy} onClick={() => answer(false)}>
        Not yet
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

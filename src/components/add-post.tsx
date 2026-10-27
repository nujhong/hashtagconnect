import { useState } from "react";
import { postFromUrl } from "../people";

/** Adding a post by link saves it privately; it never publishes to discovery. */
export function AddPost({ busy, onAdd }: { busy: boolean; onAdd: (url: string) => Promise<string | null> }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  return <form className="add" onSubmit={async (e) => {
    e.preventDefault();
    if (!postFromUrl(url)) { setError("Paste an HTTPS post link from x.com or twitter.com."); return; }
    const failure = await onAdd(url);
    setError(failure ?? "");
    if (!failure) setUrl("");
  }}>
    <label htmlFor="add-url">Found someone on X?</label>
    <div className="add-row">
      <input id="add-url" type="url" inputMode="url" placeholder="Paste the post link" value={url} maxLength={500} required
        onChange={(e) => { setUrl(e.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby="add-help" />
      <button className="btn primary" disabled={busy}>Save</button>
    </div>
    <p id="add-help" className={error ? "error" : "fine"} role={error ? "alert" : undefined}>{error || "Only you will see it."}</p>
  </form>;
}

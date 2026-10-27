import { useState } from "react";
import { motion } from "motion/react";
import { postFromUrl, profileFromInput } from "../people";
import { spring } from "./ui";

/**
 * Adding a post by link. Publishing to the shared pool needs the curator to name the author's X profile
 * and confirm they checked it; the handle in a post URL is never trusted as the author.
 */
export function AddPost({ curator, preview, busy, tagNames, onAdd }: { curator: boolean; preview: boolean; busy: boolean; tagNames: string[]; onAdd: (url: string, shared: boolean, tags: string[], author: string) => Promise<string | null> }) {
  const [url, setUrl] = useState("");
  const [shared, setShared] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [extraTags, setExtraTags] = useState("");
  const [author, setAuthor] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  return <form className="add" onSubmit={async (e) => {
    e.preventDefault();
    if (!postFromUrl(url)) { setError("Paste an HTTPS post link from x.com or twitter.com."); return; }
    if (shared && author && !profileFromInput(author)) { setError("Author: use @handle or an https://x.com/handle link."); return; }
    if (shared && preview && !author) { setError("Add the author’s X profile before publishing."); return; }
    if (shared && author && !checked) { setError("Confirm you checked the author on X."); return; }
    const picked = [...new Set([...tags, ...extraTags.split(/[ ,]+/).map((tag) => tag.replace(/^#/, "").toLowerCase()).filter(Boolean)])];
    if (shared && (picked.length > 8 || picked.some((tag) => !/^[a-z0-9_]{1,40}$/.test(tag)))) { setError("Use up to 8 hashtags, with letters, numbers or underscores."); return; }
    const failure = await onAdd(url, shared, picked, shared ? author.trim() : "");
    setError(failure ?? "");
    if (!failure) { setUrl(""); setTags([]); setExtraTags(""); setAuthor(""); setChecked(false); }
  }}>
    <label htmlFor="add-url">Found someone on X?</label>
    <div className="add-row">
      <input id="add-url" type="url" inputMode="url" placeholder="Paste the post link" value={url} maxLength={500} required
        onChange={(e) => { setUrl(e.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby="add-help" />
      <button className="btn primary" disabled={busy}>{shared ? "Publish" : "Save"}</button>
    </div>
    {curator && <div className="seg" role="radiogroup" aria-label="Where to add it">
      {([[false, "Just me"], [true, "Shared pool"]] as const).map(([v, label]) =>
        <button type="button" role="radio" key={label} aria-checked={shared === v} onClick={() => setShared(v)}>
          {shared === v && <motion.span layoutId="seg-pill" className="seg-pill" transition={spring} />}<span>{label}</span>
        </button>)}
    </div>}
    {curator && shared && <div className="add-author">
      <label htmlFor="add-author">Author’s X profile</label>
      <input id="add-author" placeholder="@handle or https://x.com/handle" value={author} maxLength={200} autoComplete="off"
        onChange={(e) => { setAuthor(e.target.value); setChecked(false); setError(""); }} />
      <label className="check"><input type="checkbox" checked={checked} disabled={!author.trim()} onChange={(e) => setChecked(e.target.checked)} />I opened this profile on X and it’s the post’s author</label>
    </div>}
    {curator && shared && <fieldset className="tag-pick"><legend>Hashtags it uses</legend>
      {[...new Set(["connect", "building", "tech", ...tagNames])].map((t) => <label key={t}><input type="checkbox" checked={tags.includes(t)} onChange={(e) => setTags(e.target.checked ? [...tags, t] : tags.filter((x) => x !== t))} />#{t}</label>)}
      <label>Other hashtags <input placeholder="design, music, photography" maxLength={328} value={extraTags} onChange={(e) => setExtraTags(e.target.value)} /></label>
    </fieldset>}
    <p id="add-help" className={error ? "error" : "fine"} role={error ? "alert" : undefined}>
      {error || (shared ? "Everyone with access sees it on the board." : "Only you will see it.")}
    </p>
  </form>;
}

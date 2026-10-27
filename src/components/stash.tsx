import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { timeAgo, type Choice, type Person, type Post } from "../people";
import type { Tags } from "../sandbox";
import { AddPost } from "./add-post";
import { PostFrame } from "./post-frame";
import { OpenLink, StashIcon, spring } from "./ui";

export type StashList = "people" | "aside";
/**
 * One Stash card: a linked person (their state survives the source post leaving the pool),
 * or a lone post whose author isn't linked yet, which stays post-level and is never shown as a verified person.
 */
export type StashEntry = { key: string; person: Person | null; choice: Choice | null; openedAt: number | null; source: Post | null };

const shortId = (id: string) => `…${id.slice(-6)}`;

type RowActions = {
  tags: Tags; busy: boolean; focusId: string | null;
  onOpen: (t: { post?: Post; person?: Person }) => void; onView: (p: Post) => void;
  onMove: (entry: StashEntry, choice: Choice | null) => void;
};

/**
 * Stash: your private people, in a native modal dialog (a drawer on wide screens, a sheet on phones).
 * Focus stays inside, Escape closes it, focus returns to the opener. The page keeps `dialogRef` so the
 * toast can render inside while it's open.
 *
 * Its job is one list: people you kept, each a big link to their profile on X, with one action to open
 * the remaining links together. View post and Remove sit behind each row's "More". Posts without a
 * confirmed author, people you passed, and adding by link live in quieter sections below the list.
 */
export function Stash({ dialogRef, open, onClose, browserOnly, lists, list, onList, onAdd, unopenedCount, onOpenAll, ...row }: {
  dialogRef: RefObject<HTMLDialogElement | null>; open: boolean; onClose: () => void; browserOnly: boolean;
  lists: Record<StashList, StashEntry[]>; list: StashList; onList: (l: StashList) => void;
  onAdd: (url: string) => Promise<string | null>;
  unopenedCount: number; onOpenAll: () => void;
} & RowActions) {
  useEffect(() => {
    const el = dialogRef.current;
    if (open && !el?.open) el?.showModal();
    if (!open && el?.open) el.close();
  }, [open]);
  const passed = list === "aside";
  const shown = passed ? lists.aside : lists.people.filter((e) => e.person);
  const loose = lists.people.filter((e) => !e.person);
  // Unlinked rows show their post (and so load its embed) only once their section is opened.
  const [looseOpen, setLooseOpen] = useState(false);
  return <dialog id="shelf" ref={dialogRef} className="shelf" aria-label="Your Stash"
    onClose={onClose} onClick={(e) => {
      // Only a click on the backdrop closes it; the drawer's own padding is also the dialog element.
      const r = dialogRef.current?.getBoundingClientRect();
      if (r && e.target === dialogRef.current && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) onClose();
    }}>
    <div className="shelf-head">
      {passed
        ? <button className="back" onClick={() => onList("people")}>← Stash</button>
        : <h2><StashIcon />Stash</h2>}
      <p>{passed ? "People you passed. Bring anyone back to your queue." : "People you kept. Open a profile to follow or say hello on X."}
        {browserOnly ? " Stored in this browser." : " Only you see this."}</p>
      <button className="shelf-close" onClick={onClose} aria-label="Close Stash">×</button>
    </div>

    {!passed && unopenedCount > 0 && <div className="shelf-open-all">
      <button className="big keep" disabled={row.busy} onClick={onOpenAll}><span>Open {unopenedCount} {unopenedCount === 1 ? "tab" : "tabs"}</span><i aria-hidden="true">↗</i></button>
      <p>Opens profiles and saved post links; following happens on X. Allow pop-ups if your browser asks.</p>
    </div>}

    {/* People first; View post returns to the original invitation without a duplicate embed in Stash. */}
    {open && <ul className="people-list">
      <AnimatePresence initial={false}>
        {shown.map((entry) => <motion.li key={entry.key} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
          <PersonRow entry={entry} {...row} />
        </motion.li>)}
      </AnimatePresence>
    </ul>}
    {shown.length === 0 && <p className="rows-empty">{passed ? "No one passed. People you pass leave your queue." : "Keep someone and they land here, one row per person."}</p>}

    {!passed && <div className="shelf-more">
      {open && loose.length > 0 && <details className="shelf-section" open={looseOpen} onToggle={(e) => setLooseOpen(e.currentTarget.open)}>
        <summary>Saved posts without a confirmed author <small>{loose.length}</small></summary>
        {looseOpen && <ul className="people-list">{loose.map((entry) => <li key={entry.key}><PersonRow entry={entry} {...row} /></li>)}</ul>}
      </details>}
      {lists.aside.length > 0 && <button className="shelf-link" onClick={() => onList("aside")}>Passed <small>{lists.aside.length}</small></button>}
      <details className="shelf-section">
        <summary>Add a post by link</summary>
        <AddPost busy={row.busy} onAdd={onAdd} />
      </details>
    </div>}
  </dialog>;
}

/**
 * A Stash row. A linked person is one big link to their profile on X (our own link, so it's
 * recorded as opened); View post returns to the main view for the original invitation. A post whose
 * author isn't linked yet shows that post instead, since it's the only honest way to see who it is. Secondary actions live behind "More" so the list stays a list of people.
 */
function PersonRow({ entry, tags, busy, focusId, onOpen, onView, onMove }: { entry: StashEntry } & RowActions) {
  const { person, source } = entry;
  const [more, setMore] = useState(false);
  const topics = source ? tags[source.id] ?? [] : [];
  // The row's status line answers "have I opened them yet?".
  const meta = [entry.openedAt ? `Opened ${timeAgo(entry.openedAt)}` : person ? "Not opened yet" : source ? `Post ${shortId(source.id)}` : "",
    ...topics.map((t) => `#${t}`)].filter(Boolean).join(" · ");
  const label = person ? `@${person.handle}` : "Saved post";
  return <div className={`person${source && source.id === focusId ? " current" : ""}${entry.openedAt ? " is-opened" : ""}`}>
    <div className="person-row">
      {person
        ? <a className="person-open" href={person.profileUrl} target="_blank" rel="noopener noreferrer" onClick={() => onOpen({ person })}
            onAuxClick={(event) => { if (event.button === 1) onOpen({ person }); }}>
            <span className="person-tile" aria-hidden="true">{person.handle[0]}</span>
            <span className="person-id"><b>{label}</b><small>{meta}</small></span>
            <span className="person-go">Open on X <span aria-hidden="true">↗</span></span>
          </a>
        : <div className="person-open is-post">
            <span className="person-tile" aria-hidden="true">#</span>
            <span className="person-id"><b>{label}</b><small>{meta}</small></span>
          </div>}
      {/* More reveals the secondary actions; an unlinked post stays shown so its author can be seen. */}
      <button className="person-more" aria-expanded={more} aria-label={`More for ${label}`} onClick={() => setMore(!more)}>⋯</button>
    </div>
    {more && <div className="person-tray">
      {entry.choice === "skip"
        ? <button className="btn primary sm" disabled={busy} onClick={() => onMove(entry, null)}>Bring back</button>
        : null}
      {source && <button className="btn sm" onClick={() => onView(source)}>View post</button>}
      {entry.choice === "save" && <button className="btn sm quiet danger" disabled={busy} onClick={() => onMove(entry, null)}>Remove</button>}
    </div>}
    {person && !source && more && <p className="person-note">The post you found them through has left the pool.</p>}
    {!person && source && <div className="person-posts">
      <PostFrame id={source.id} fallback={<OpenLink post={source} onOpen={(p) => onOpen({ post: p })} className="btn sm" />} />
    </div>}
  </div>;
}

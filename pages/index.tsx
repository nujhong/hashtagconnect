import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { auth, fetch as api, FetchError } from "void/client";
import type { Props } from "./index.server";
import { dedupePeople, postFromUrl, profileFromInput, timeAgo, type Choice, type Discovery, type Person, type PersonEntry, type Post } from "../src/people";
import { embedConsentKey, lettersKey, previewKey, restorePreview, type Tags } from "../src/sandbox";
import { SignInSheet, beginXSignIn, readAuthReturn, type Account, type AuthStep } from "../src/components/auth";
import { ConnectionFeedback, GetListed, Review } from "../src/components/community";
import { DiscoveryFilters } from "../src/components/discovery-filters";
import { Decisions } from "../src/components/decisions";
import { Invitation } from "../src/components/invitation";
import { ScanPanel, type ScanAccess } from "../src/components/scan";
import { Settings } from "../src/components/settings";
import { openXTabs, unopenedTargets } from "../src/open-tabs";
import { Stash, type StashEntry, type StashList } from "../src/components/stash";
import { TopBar } from "../src/components/top-bar";
import { Count, Toast, spring, type Notice } from "../src/components/ui";
import "./style.css";

/*
 * The page owns state and actions, and composes the sections in src/components. Signed-in state comes
 * from the server (every mutation returns the viewer's Discovery); signed-out visitors and the auth
 * preview use a browser sandbox (src/sandbox.ts).
 */
// Hashtags are curator-assigned; the signed-out sandbox keeps its own local tags.
const KNOWN_TAGS = ["connect", "building", "tech"];
type Fly = { key: number; x1: number; y1: number; x2: number; y2: number };

export default function HomePage(props: Props) {
  return <MotionConfig reducedMotion="user"><App {...props} /></MotionConfig>;
}

function App(props: Props) {
  const reduced = useReducedMotion();
  const [previewAccount, setPreviewAccount] = useState(false);
  const preview = !props.user;
  const canCurate = props.curator || preview;
  const [posts, setPosts] = useState<Post[]>(preview ? [] : props.posts);
  const [people, setPeople] = useState<PersonEntry[]>(preview ? [] : props.people);
  const [tags, setTags] = useState<Tags>(Object.fromEntries(props.posts.map((post) => [post.id, post.tags ?? []])));
  const [seeded, setSeeded] = useState<string[]>([]);
  const [filter, setFilter] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [embeds, setEmbeds] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [list, setList] = useState<StashList>("people");
  const [shelf, setShelf] = useState(false);
  const [modal, setModal] = useState<"privacy" | "listing" | "review" | null>(null);
  const [authStep, setAuthStep] = useState<{ step: AuthStep; code?: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [fly, setFly] = useState<Fly | null>(null);
  const [scanPause, setScanPause] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(props.feedback);
  const [hasOpened, setHasOpened] = useState(props.hasOpened);
  const [letters, setLetters] = useState(true);
  // A shortcut briefly shows its button pressed, so keyboard choices feel as physical as clicks.
  const [hit, setHit] = useState<Choice | null>(null);
  // The leaving card animates by the choice that removed it, not the next card's state.
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const busy = useRef(false);
  const shelfRef = useRef<HTMLDialogElement>(null);
  const opening = useRef(new Set<string>());
  const [, tick] = useState(0);

  const pool = posts.filter((p) => p.pooledAt !== null);
  const inFilter = (p: Post) => !filter.length || tags[p.id]?.some((t) => filter.includes(t));
  const unseen = pool.filter((p) => p.choice === null && !p.openedAt);
  // One card per person: a person with several invitations appears once.
  const deck = dedupePeople(unseen.filter(inFilter));
  const focused = focusId ? posts.find((p) => p.id === focusId) ?? null : null;
  const current = focused ?? deck[0];
  // The server keeps person records; the browser sandbox derives them from its posts.
  const personEntries: PersonEntry[] = preview
    ? [...new Map(posts.filter((p) => p.person).map((p) => [p.person!.id, p])).values()].map((p) => ({
        person: p.person!, choice: p.choice, openedAt: p.openedAt, updatedAt: p.addedAt,
        sourcePost: posts.find((q) => q.person?.id === p.person!.id) ?? null,
      }))
    : people;
  const stash = (choice: Choice): StashEntry[] => [
    ...personEntries.filter((e) => e.choice === choice).sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ key: `person:${e.person.id}`, person: e.person, choice, openedAt: e.openedAt, source: e.sourcePost })),
    ...posts.filter((p) => !p.person && p.choice === choice)
      .map((p) => ({ key: `post:${p.id}`, person: null, choice, openedAt: p.openedAt, source: p })),
  ];
  const lists: Record<StashList, StashEntry[]> = { people: stash("save"), aside: stash("skip") };
  const unopened = unopenedTargets(lists.people);
  const tagNames = [...new Set([...(preview ? KNOWN_TAGS : []), ...Object.values(tags).flat()])];
  const account: Account | null = props.user
    ? { ...props.user, image: props.user.image ?? null, curator: props.curator, preview: false }
    : previewAccount ? { name: "Preview account", image: null, username: null, curator: true, preview: true } : null;

  useEffect(() => {
    if (preview) { const restored = restorePreview(); setPosts(restored.posts); setTags(restored.tags); setSeeded(restored.seeded); }
    try { setEmbeds(localStorage.getItem(embedConsentKey) === "yes"); } catch { /* Consent remains off when storage is blocked. */ }
    try { setLetters(localStorage.getItem(lettersKey) !== "off"); } catch { /* Letter shortcuts stay on for this visit. */ }
    setReady(true);
    if (props.user) void api("/api/activity", { method: "POST", body: { event: "visit" } }).catch(() => { /* Measurement must not block browsing. */ });
    const back = readAuthReturn();
    if (back.step) setAuthStep({ step: back.step, code: back.code });
    if (back.returned && props.user) say(`Signed in as ${props.user.username ? `@${props.user.username}` : props.user.name}.`);
    if (back.signedOut) say("Signed out. This browser no longer has your session.");
    const interval = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (preview && ready) {
      try { localStorage.setItem(previewKey, JSON.stringify({ posts, tags, seeded })); } catch { say("Browser storage is unavailable. Preview changes last until you reload."); }
    }
  }, [posts, tags, seeded, preview, ready]);
  useEffect(() => { setConfirmRemove(false); }, [current?.id]);
  // Scans stay inline; opening Stash, a dialog or sign-in never creates another modal layer.

  /**
   * Desktop shortcuts: ← Pass, → Keep, S Stash (switchable off).
   * Native dialogs handle their own Escape. Nothing fires while typing, with a modifier held, inside
   * a dialog or filter popover, on widgets that own arrow keys, or while focus is in X's iframe (its keys never reach us).
   */
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable], [role=tab], [role=radio], [role=slider], [role=menu], summary")) return;
    if (document.querySelector("dialog[open], [popover]:popover-open")) return;
    if (letters && !e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); setShelf(true); return; }
    if (!current || pending || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const choice: Choice = e.key === "ArrowRight" ? "save" : "skip";
    e.preventDefault();
    setHit(choice);
    window.setTimeout(() => setHit(null), 160);
    if (current.choice !== choice) void decide(current, choice);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  function setLetterShortcuts(value: boolean) {
    setLetters(value);
    try { localStorage.setItem(lettersKey, value ? "on" : "off"); } catch { /* This visit still respects the choice. */ }
  }

  function say(text: string, undo?: () => void) { setNotice({ text, undo }); }
  /** Server responses are the source of truth: every mutation returns the viewer's whole Discovery. */
  function apply(d: Discovery) { setPosts(d.posts); setPeople(d.people); setTags(Object.fromEntries(d.posts.map((post) => [post.id, post.tags ?? []]))); }
  /** In the sandbox, a linked post's state belongs to its person, so it changes on all their posts. */
  function patchLocal(target: { post?: Post; person?: Person }, changes: Partial<Post>) {
    const pid = target.person?.id ?? target.post?.person?.id;
    setPosts((rows) => rows.map((r) => (pid ? r.person?.id === pid : r.id === target.post?.id) ? { ...r, ...changes } : r));
  }
  function setConsent(value: boolean) {
    setEmbeds(value);
    try { localStorage.setItem(embedConsentKey, value ? "yes" : "no"); } catch { /* This visit still respects the choice. */ }
  }
  function errorMessage(error: unknown) {
    if (error instanceof FetchError && typeof error.data === "string") return error.data;
    return "That didn’t go through. Please try again.";
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try { await action(); } catch (error) { say(errorMessage(error)); }
    finally { busy.current = false; setPending(false); }
  }
  async function setChoice(post: Post, choice: Choice | null) {
    if (preview) patchLocal({ post }, { choice });
    else apply(await api("/api/decisions", { method: "POST", body: { postId: post.id, choice } }));
  }
  async function setEntryChoice(entry: StashEntry, choice: Choice | null) {
    if (!entry.person) { if (entry.source) await setChoice(entry.source, choice); return; }
    if (preview) patchLocal({ person: entry.person }, { choice });
    else apply(await api("/api/decisions", { method: "POST", body: { personId: entry.person.id, choice } }));
  }
  /** A small sticker peels off Keep and lands on the Stash counter. */
  function flyKeep() {
    if (reduced) return;
    const from = document.querySelector(".big.keep")?.getBoundingClientRect();
    const to = document.querySelector("[data-jack]")?.getBoundingClientRect();
    if (!from || !to) return;
    setFly({ key: Date.now(), x1: from.x + from.width - 64, y1: from.y + from.height / 2 - 20, x2: to.x + to.width / 2 - 20, y2: to.y + to.height / 2 - 20 });
  }
  function signIn() { void beginXSignIn(props.authReady, (step, code) => setAuthStep({ step, code })); }
  async function decide(post: Post, choice: Choice | null) {
    const before = post.choice;
    await run(async () => {
      setLeaving(choice);
      if (choice === "save") flyKeep();
      await setChoice(post, choice);
      const text = choice === "save" ? "Kept. Open their profile from Stash." : choice === "skip" ? "Passed. They won’t come round again." : before === "save" ? "Taken out of your Stash. Opened history stays." : "Back in your queue.";
      say(text, () => void run(() => setChoice({ ...post, choice }, before)));
    });
  }
  /** Moves a Stash card between People and Passed (or out of Stash), with one Undo. */
  async function moveEntry(entry: StashEntry, choice: Choice | null) {
    const text = choice === null ? (entry.choice === "save" ? "Removed from your Stash." : "Back in your queue.") : "Moved.";
    await run(async () => {
      await setEntryChoice(entry, choice);
      say(text, () => void run(() => setEntryChoice({ ...entry, choice }, entry.choice)));
    });
  }
  /** Records a click on one of our own links: a post fallback, or a person's profile. */
  async function markOpened(target: { post?: Post; person?: Person }) {
    try { await recordOpened(target); say("Marked as opened."); }
    catch { say("X opened, but we couldn’t save that to your history. Please try again."); }
  }
  async function recordOpened(target: { post?: Post; person?: Person }) {
    const key = target.person ? `person:${target.person.id}` : `post:${target.post?.id}`;
    if (opening.current.has(key)) return;
    opening.current.add(key);
    try {
      const openedAt = preview ? Date.now() : (await api("/api/opened", { method: "POST", body: target.person ? { personId: target.person.id } : { postId: target.post!.id } })).openedAt;
      // Patch only this opening; overlapping link clicks must not replace newer discovery state.
      patchLocal(target, { openedAt });
      setHasOpened(true);
      const personId = target.person?.id ?? target.post?.person?.id;
      if (personId) setPeople((rows) => rows.map((row) => row.person.id === personId ? { ...row, openedAt, updatedAt: openedAt } : row));
    }
    finally { opening.current.delete(key); }
  }
  async function openStash() {
    await run(async () => {
      const { opened, blocked } = openXTabs(unopened);
      let failed = 0;
      for (const target of opened) {
        try { await recordOpened(target); } catch { failed++; }
      }
      say(`Opened ${opened.length} ${opened.length === 1 ? "tab" : "tabs"}.${blocked ? ` ${blocked} blocked. Allow pop-ups for this site, or use the individual links.` : ""}${failed ? ` Couldn’t save ${failed} to your opened history.` : ""}`);
    });
  }
  /** The curator confirms the author’s profile when publishing a post to the pool. */
  async function add(url: string, shared: boolean, picked: string[], author: string): Promise<string | null> {
    const parsed = postFromUrl(url);
    if (!parsed) return "Paste an HTTPS post link from x.com or twitter.com.";
    let failure: string | null = null;
    await run(async () => {
      try {
        if (preview) {
          const profile = author ? profileFromInput(author) : null;
          setPosts((rows) => {
            const existing = rows.find((p) => p.id === parsed.id);
            const person = existing?.person ?? (profile ? { ...profile, id: `sandbox:${profile.profileUrl}` } : null);
            const next = { ...(existing ?? parsed), person, ...(shared ? { pooledAt: existing?.pooledAt ?? Date.now() } : { choice: "save" as const }) };
            // A private save of a curator-linked post saves that person, so all their posts agree.
            const rest = rows.filter((p) => p.id !== parsed.id).map((p) => !shared && person && p.person?.id === person.id ? { ...p, choice: "save" as const } : p);
            return [next, ...rest];
          });
          if (shared && picked.length) setTags((t) => ({ ...t, [parsed.id]: picked }));
        } else apply(await api("/api/import", { method: "POST", body: { url, tags: shared ? picked : undefined, destination: shared ? "pool" : "queue", ...(author ? { profileUrl: author, profileConfirmed: true } : {}) } }));
        if (shared) { setFocusId(null); say("Added to the shared pool."); }
        else { setList("people"); say("Saved privately to your Stash."); }
      } catch (error) { failure = errorMessage(error); }
    });
    return failure;
  }
  async function removeFromPool(post: Post) {
    await run(async () => {
      if (preview) setPosts((rows) => rows.filter((p) => p.id !== post.id));
      else apply(await api("/api/pool", { method: "DELETE", body: { postId: post.id } }));
      setFocusId(null); say("Removed from the pool for everyone.");
    });
  }
  async function clearMine() {
    await run(async () => {
      if (preview) setPosts((rows) => rows.filter((p) => p.pooledAt !== null).map((p) => ({ ...p, choice: null, openedAt: null })));
      else { await api("/api/decisions", { method: "DELETE" }); apply(await api("/api/discover")); }
      setModal(null); say("Your Stash and opened history are cleared.");
    });
  }
  async function signOut() {
    if (account?.preview) { setPreviewAccount(false); say("Signed out of the auth preview."); return; }
    try {
      const result = await auth.signOut();
      if (!result.error) { window.location.assign("/?auth=signedout"); return; }
    } catch { /* reported below */ }
    say("Sign-out didn’t go through. You’re still signed in. Please try again.");
  }
  function show(post: Post) { setFocusId(post.id); setShelf(false); document.getElementById("post")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }

  // The sandbox lives in browser storage, so the server render has nothing to show yet.
  const loaded = !preview || ready;
  const scanAccess: ScanAccess = props.user ? "signed-in" : previewAccount ? "preview" : "signed-out";
  const status = current?.choice === "save" ? "You kept this" : current?.choice === "skip" ? "You passed on this" : null;
  const scope = preview ? (account ? "Preview session" : "Preview") : props.curator ? "Curator" : null;
  const scanPanel = current && <ScanPanel key={current.id} access={scanAccess} availability={props.scanAvailability} postId={current.id}
    pausedReason={scanPause} onPause={setScanPause} onResume={() => setScanPause(null)} onSignIn={signIn} />;

  return <div className="app">
    <a className="skip-link" href="#post">Skip to the current post</a>
    <TopBar scope={scope} preview={preview} stashCount={lists.people.length} stashOpen={shelf} letters={letters} account={account}
      scanPolicy={props.user ? props.scanPolicy : null} scanPause={scanPause}
      onStash={() => setShelf(!shelf)} onSettings={() => setModal("privacy")} onSignIn={signIn} onSignOut={signOut} />

    {!props.user && <section className="welcome" aria-label="About hashtagconnect"><h1>Grow your circle on X.</h1><p>Discover people who want to connect, with interests that fit yours.</p><p className="fine">Keep people in your Stash, then open their profiles to connect on X.</p></section>}

    <div className={`layout${loaded ? "" : " is-loading"}`}>
      <div className="workspace">
        {scanPanel}
        <div className="work">
          {/* The queue: the first unsorted pool post that matches the tags (one per person), or one brought back from Stash.
              X's official widget renders it whole and keeps still; nothing is laid over the iframe,
              and it only changes when you decide, filter or pick another post. */}
          <section id="post" className="post-col" tabIndex={-1} aria-label="The original post">
            {(focused || status) && <header className="post-head">
              {focused && <button className="back" onClick={() => setFocusId(null)}>← Back to your queue</button>}
              {status && <span className="post-src">{status}</span>}
            </header>}
            <AnimatePresence mode="wait" custom={leaving} initial={false}>
              {!loaded ? <div key="shell" className="post-shell" aria-hidden="true" />
                : current ? <motion.div key={current.id} className="post-swap" custom={leaving}
                    initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={spring}
                    exit="leave" variants={{ leave: (c: Choice | null) => c === "save"
                      ? { opacity: 0, y: -28, scale: 0.97, transition: { duration: 0.22 } }
                      : c === "skip" ? { opacity: 0, x: -48, transition: { duration: 0.22 } } : { opacity: 0, transition: { duration: 0.15 } } }}>
                    <Invitation post={current} embeds={embeds} onEnable={() => setConsent(true)} onOpen={markOpened} />
                  </motion.div>
                : <motion.div key="empty" className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <h2>{filter.length ? "No one under these tags." : "Nothing left in your queue."}</h2>
                    <p>{filter.length ? "Drop a tag to see more people." : pool.length ? "You’ve kept, passed or opened every invitation here. Clear your history in Settings to start again." : "The shared pool doesn’t have any invitations yet."}</p>
                    {filter.length > 0 ? <button className="btn" onClick={() => setFilter([])}>Clear tags</button>
                      : lists.people.length > 0 && <button className="btn primary" onClick={() => setShelf(true)}>Open your Stash</button>}
                  </motion.div>}
            </AnimatePresence>
            {current && tags[current.id]?.length ? <p className="post-note"><b>{tags[current.id].map((t) => `#${t}`).join(" ")}</b></p> : null}
          </section>

          <aside className="panel" aria-label="Your choice">
            {/* The shared scan joins the invitation and decisions; phones place discovery above it and pin decisions below. */}
            <div className="panel-top">
              <DiscoveryFilters tags={tagNames.map((name) => ({ name, count: unseen.filter((post) => tags[post.id]?.includes(name)).length }))}
                selected={filter} preview={preview} onChange={(next) => { setFilter(next); setFocusId(null); }} />
              <div className="panel-head">
                <h1>{!loaded ? " " : focused ? <>Another look.</> : deck.length ? <><span className="queue-count"><Count value={deck.length} /></span> {deck.length === 1 ? "person" : "people"} <span className="br">to connect</span></> : <>All caught up.</>}</h1>
                <p className="panel-sub">{focused ? "Change your mind any time." : deck.length ? "Keep someone in your Stash. Make the first move on X." : "New invitations show up when the curator adds them."}</p>
              </div>
            </div>

            {current && <Decisions post={current} hit={hit} busy={pending} onDecide={decide} />}

            <p className="panel-foot">
              {current?.openedAt ? <>Opened on X {timeAgo(current.openedAt)}. </> : null}
              {!focused && deck.length > 1 ? <>{deck.length - 1} more after this. </> : null}
              {!account && <><button className="link" onClick={signIn}>Continue with X</button> to keep future saves on your account. </>}
              {canCurate && current?.pooledAt != null && (confirmRemove
                ? <span className="confirm">Remove for everyone, with every save and history? <button className="link danger" onClick={() => removeFromPool(current)}>Remove</button> <button className="link" onClick={() => setConfirmRemove(false)}>Keep it</button></span>
                : <button className="link" onClick={() => setConfirmRemove(true)}>Remove from pool</button>)}
            </p>
          </aside>
        </div>
      </div>

      <Stash dialogRef={shelfRef} open={shelf} onClose={() => setShelf(false)} browserOnly={preview && !account}
        lists={lists} list={list} onList={setList} focusId={focusId} tags={tags} embeds={embeds} busy={pending}
        curator={canCurate} preview={preview} tagNames={tagNames} onEnable={() => setConsent(true)}
        unopenedCount={unopened.length} onOpenAll={openStash}
        onOpen={markOpened} onView={show} onMove={moveEntry} onAdd={add} />
    </div>

    <footer className="foot">
      <button className="link" onClick={() => props.user ? setModal("listing") : signIn()}>Get listed</button>
      {props.curator && <button className="link" onClick={() => setModal("review")}>Curator review</button>}
      <button className="link" onClick={() => setModal("privacy")}>{props.user ? "Your bio & settings" : "Settings & privacy"}</button>
      {!props.authReady && !props.user && <span>X sign-in isn’t configured here, so sign-in runs as a preview.</span>}
      {props.user && hasOpened && feedback === null && <ConnectionFeedback onAnswer={async (useful) => {
        await api("/api/activity", { method: "POST", body: { event: "feedback", useful } }); setFeedback(useful);
      }} />}
    </footer>

    <AnimatePresence>{fly && <motion.span key={fly.key} className="fly" aria-hidden="true"
      initial={{ x: fly.x1, y: fly.y1, scale: 1, rotate: -8 }} animate={{ x: fly.x2, y: fly.y2, scale: 0.45, rotate: 10 }} exit={{ opacity: 0, scale: 0.2 }}
      transition={{ duration: 0.55, ease: [0.5, 0, 0.2, 1] }} onAnimationComplete={() => setFly(null)}>+1</motion.span>}</AnimatePresence>

    <Toast notice={notice} onClose={() => setNotice(null)} host={shelf ? shelfRef.current : null} />

    {authStep && <SignInSheet step={authStep.step} code={authStep.code} authReady={props.authReady}
      onStep={(step, code) => setAuthStep({ step, code })} onClose={() => setAuthStep(null)}
      onPreviewReturn={() => { setAuthStep(null); setPreviewAccount(true); say("Preview sign-in. No real session was created."); }} />}

    {modal === "listing" && props.user && <GetListed username={props.user.username} onClose={() => setModal(null)} />}
    {modal === "review" && props.curator && <Review onClose={() => setModal(null)} onPublished={() => { void api("/api/discover").then(apply).catch(() => say("Refresh to load the updated pool.")); }} />}
    {modal === "privacy" && <Settings context={props.user ? { bio: props.bio, sentence: props.context } : undefined} embeds={embeds} letters={letters} busy={pending}
      onConsent={setConsent} onLetters={setLetterShortcuts} onClear={clearMine} onClose={() => setModal(null)} />}
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { auth, fetch as api, FetchError } from "void/client";
import type { ViewerProfile } from "~/src/project-profile";
import type { ScanAvailability } from "~/src/scan-contract";
import type { PostLayer } from "~/src/scan-layer";
import type { Props } from "./index.server";
import {
  dedupePeople,
  timeAgo,
  type Choice,
  type Discovery,
  type Person,
  type PersonEntry,
  type Post,
} from "~/src/people";
import { shortcutsKey, guestKey, restoreGuest, type Tags } from "~/src/guest";
import {
  SignInSheet,
  beginXSignIn,
  readAuthReturn,
  type Account,
  type AuthStep,
} from "~/src/components/auth";
import { ConnectionFeedback } from "~/src/components/community";
import { DiscoveryFilters } from "~/src/components/discovery-filters";
import { Decisions } from "~/src/components/decisions";
import { Cords, EvidenceCards } from "~/src/components/evidence";
import { Invitation } from "~/src/components/invitation";
import { ScanPanel, SignedOutIntro } from "~/src/components/scan";
import { Settings } from "~/src/components/settings";
import { openXTabs, unopenedTargets } from "~/src/open-tabs";
import { Stash, type StashEntry, type StashList } from "~/src/components/stash";
import { TopBar } from "~/src/components/top-bar";
import { Count, Toast, spring, type Notice } from "~/src/components/ui";
import "./style.css";

/*
 * The page owns state and actions, and composes the sections in src/components. Signed-in state comes
 * from the server (every mutation returns the viewer's Discovery); signed-out visitors use browser storage
 * in the guest storage module.
 */
// Discovery tags come from stored posts; the signed-out guest state keeps its own local tags.
type Fly = { key: number; x1: number; y1: number; x2: number; y2: number };

export default function HomePage(props: Props) {
  return (
    <MotionConfig reducedMotion="user">
      <App {...props} />
    </MotionConfig>
  );
}

function App(props: Props) {
  const reduced = useReducedMotion();
  const guest = !props.user;
  const [posts, setPosts] = useState<Post[]>(guest ? [] : props.posts);
  const [people, setPeople] = useState<PersonEntry[]>(guest ? [] : props.people);
  const [tags, setTags] = useState<Tags>(
    Object.fromEntries(props.posts.map((post) => [post.id, post.tags ?? []])),
  );
  const [filter, setFilter] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [list, setList] = useState<StashList>("people");
  const [shelf, setShelf] = useState(false);
  const [modal, setModal] = useState<"privacy" | null>(null);
  const [authStep, setAuthStep] = useState<{ step: AuthStep; code?: string } | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile>({
    bio: props.bio,
    sentence: props.context,
    project: props.project,
  });
  const [profileVersion, setProfileVersion] = useState(0);
  const [readingBioProject, setReadingBioProject] = useState(
    props.projectImport.status === "pending",
  );
  const [scanPause, setScanPause] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(props.feedback);
  const [hasOpened, setHasOpened] = useState(props.hasOpened);
  const [shortcuts, setShortcuts] = useState(true);
  const [layer, setLayer] = useState<PostLayer | null>(null);
  const [corded, setCorded] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
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
  const focused = focusId ? (posts.find((p) => p.id === focusId) ?? null) : null;
  const current = focused ?? deck[0];
  // The server keeps person records; the browser guest state derives them from its posts.
  const personEntries: PersonEntry[] = guest
    ? [...new Map(posts.filter((p) => p.person).map((p) => [p.person!.id, p])).values()].map(
        (p) => ({
          person: p.person!,
          choice: p.choice,
          openedAt: p.openedAt,
          updatedAt: p.addedAt,
          sourcePost: posts.find((q) => q.person?.id === p.person!.id) ?? null,
        }),
      )
    : people;
  const stash = (choice: Choice): StashEntry[] => [
    ...personEntries
      .filter((e) => e.choice === choice)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({
        key: `person:${e.person.id}`,
        person: e.person,
        choice,
        openedAt: e.openedAt,
        source: e.sourcePost,
      })),
    ...posts
      .filter((p) => !p.person && p.choice === choice)
      .map((p) => ({ key: `post:${p.id}`, person: null, choice, openedAt: p.openedAt, source: p })),
  ];
  const lists: Record<StashList, StashEntry[]> = { people: stash("save"), aside: stash("skip") };
  const unopened = unopenedTargets(lists.people);
  const tagNames = [...new Set(Object.values(tags).flat())];
  const account: Account | null = props.user
    ? { ...props.user, image: props.user.image ?? null }
    : null;

  useEffect(() => {
    if (guest) {
      const restored = restoreGuest();
      setPosts(restored.posts);
      setTags(restored.tags);
    }
    try {
      setShortcuts(localStorage.getItem(shortcutsKey) !== "off");
    } catch {
      /* Keyboard shortcuts stay on for this visit. */
    }
    setReady(true);
    if (props.user)
      void api("/api/me/activity", { method: "POST", body: { event: "visit" } }).catch(() => {
        /* Measurement must not block browsing. */
      });
    const back = readAuthReturn();
    if (back.step) setAuthStep({ step: back.step, code: back.code });
    if (back.returned && props.user)
      say(`Signed in as ${props.user.username ? `@${props.user.username}` : props.user.name}.`);
    if (back.signedOut) say("Signed out. This browser no longer has your session.");
    const interval = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (guest && ready) {
      try {
        localStorage.setItem(guestKey, JSON.stringify({ posts, tags }));
      } catch {
        say("Browser storage is unavailable. Guest changes last until you reload.");
      }
    }
  }, [posts, tags, guest, ready]);
  useEffect(() => {
    if (props.projectImport.status !== "pending") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const result = await api("/api/me/project/import", { retry: 0, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.status === "pending") {
          timer = setTimeout(check, 2000);
          return;
        }
        if (result.project) {
          setViewerProfile((profile) => ({ ...profile, project: result.project }));
          setProfileVersion((version) => version + 1);
          say("Project added from your bio. Review or edit it in Settings.");
        } else if (result.error) say(result.error);
        setReadingBioProject(false);
      } catch {
        if (!controller.signal.aborted) {
          setReadingBioProject(false);
          say("Couldn’t check your project import. You can review it in Settings.");
        }
      }
    }
    timer = setTimeout(check, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  // Scans stay inline; opening Stash, a dialog or sign-in never creates another modal layer.

  /**
   * Desktop shortcuts: ← Pass, → Keep, S Stash, all switchable off in Settings.
   * Native dialogs handle their own Escape. Nothing fires while typing, with a modifier held, inside
   * a dialog or filter popover, on widgets that own arrow keys, or while focus is in X's iframe (its keys never reach us).
   */
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (!shortcuts || e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (
      (e.target as HTMLElement | null)?.closest?.(
        "input, textarea, select, [contenteditable], [role=tab], [role=radio], [role=slider], [role=menu], summary",
      )
    )
      return;
    if (document.querySelector("dialog[open], [popover]:popover-open")) return;
    if (!e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      setShelf(true);
      return;
    }
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
  function setKeyboardShortcuts(value: boolean) {
    setShortcuts(value);
    try {
      localStorage.setItem(shortcutsKey, value ? "on" : "off");
    } catch {
      /* This visit still respects the choice. */
    }
  }

  function updateProfile(changes: Partial<Pick<ViewerProfile, "sentence" | "project">>) {
    setViewerProfile((profile) => ({ ...profile, ...changes }));
    setProfileVersion((version) => version + 1);
    setScanPause(null);
    setModal(null);
    say("Profile updated.");
  }
  function say(text: string, undo?: () => void) {
    setNotice({ text, undo });
  }
  /** Server responses are the source of truth: every mutation returns the viewer's whole Discovery. */
  function apply(d: Discovery) {
    setPosts(d.posts);
    setPeople(d.people);
    setTags(Object.fromEntries(d.posts.map((post) => [post.id, post.tags ?? []])));
  }
  /** In the guest state, a linked post's state belongs to its person, so it changes on all their posts. */
  function patchLocal(target: { post?: Post; person?: Person }, changes: Partial<Post>) {
    const pid = target.person?.id ?? target.post?.person?.id;
    setPosts((rows) =>
      rows.map((r) =>
        (pid ? r.person?.id === pid : r.id === target.post?.id) ? { ...r, ...changes } : r,
      ),
    );
  }
  function errorMessage(error: unknown) {
    if (error instanceof FetchError && typeof error.data === "string") return error.data;
    return "That didn’t go through. Please try again.";
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await action();
    } catch (error) {
      say(errorMessage(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function setChoice(post: Post, choice: Choice | null) {
    if (guest) patchLocal({ post }, { choice });
    else
      apply(await api("/api/me/decisions", { method: "POST", body: { postId: post.id, choice } }));
  }
  async function setEntryChoice(entry: StashEntry, choice: Choice | null) {
    if (!entry.person) {
      if (entry.source) await setChoice(entry.source, choice);
      return;
    }
    if (guest) patchLocal({ person: entry.person }, { choice });
    else
      apply(
        await api("/api/me/decisions", {
          method: "POST",
          body: { personId: entry.person.id, choice },
        }),
      );
  }
  /** A small sticker peels off Keep and lands on the Stash counter. */
  function flyKeep() {
    if (reduced) return;
    const from = document.querySelector(".big.keep")?.getBoundingClientRect();
    const to = document.querySelector("[data-jack]")?.getBoundingClientRect();
    if (!from || !to) return;
    setFly({
      key: Date.now(),
      x1: from.x + from.width - 64,
      y1: from.y + from.height / 2 - 20,
      x2: to.x + to.width / 2 - 20,
      y2: to.y + to.height / 2 - 20,
    });
  }
  function signIn() {
    void beginXSignIn(props.authReady, (step, code) => setAuthStep({ step, code }));
  }
  async function decide(post: Post, choice: Choice | null) {
    const before = post.choice;
    await run(async () => {
      setLeaving(choice);
      if (choice === "save") flyKeep();
      await setChoice(post, choice);
      const text =
        choice === "save"
          ? "Kept. Open their profile from Stash."
          : choice === "skip"
            ? "Passed. They won’t come round again."
            : before === "save"
              ? "Taken out of your Stash. Opened history stays."
              : "Back in your queue.";
      say(text, () => void run(() => setChoice({ ...post, choice }, before)));
    });
  }
  /** Moves a Stash card between People and Passed (or out of Stash), with one Undo. */
  async function moveEntry(entry: StashEntry, choice: Choice | null) {
    const text =
      choice === null
        ? entry.choice === "save"
          ? "Removed from your Stash."
          : "Back in your queue."
        : "Moved.";
    await run(async () => {
      await setEntryChoice(entry, choice);
      say(text, () => void run(() => setEntryChoice({ ...entry, choice }, entry.choice)));
    });
  }
  /** Records a click on one of our own links: a post fallback, or a person's profile. */
  async function markOpened(target: { post?: Post; person?: Person }) {
    try {
      await recordOpened(target);
      say("Marked as opened.");
    } catch {
      say("X opened, but we couldn’t save that to your history. Please try again.");
    }
  }
  async function recordOpened(target: { post?: Post; person?: Person }) {
    const key = target.person ? `person:${target.person.id}` : `post:${target.post?.id}`;
    if (opening.current.has(key)) return;
    opening.current.add(key);
    try {
      const openedAt = guest
        ? Date.now()
        : (
            await api("/api/me/openings", {
              method: "POST",
              body: target.person ? { personId: target.person.id } : { postId: target.post!.id },
            })
          ).openedAt;
      // Patch only this opening; overlapping link clicks must not replace newer discovery state.
      patchLocal(target, { openedAt });
      setHasOpened(true);
      const personId = target.person?.id ?? target.post?.person?.id;
      if (personId)
        setPeople((rows) =>
          rows.map((row) =>
            row.person.id === personId ? { ...row, openedAt, updatedAt: openedAt } : row,
          ),
        );
    } finally {
      opening.current.delete(key);
    }
  }
  async function openStash() {
    await run(async () => {
      const { opened, blocked } = openXTabs(unopened);
      let failed = 0;
      for (const target of opened) {
        try {
          await recordOpened(target);
        } catch {
          failed++;
        }
      }
      say(
        `Opened ${opened.length} ${opened.length === 1 ? "tab" : "tabs"}.${blocked ? ` ${blocked} blocked. Allow pop-ups for this site, or use the individual links.` : ""}${failed ? ` Couldn’t save ${failed} to your opened history.` : ""}`,
      );
    });
  }
  async function clearMine() {
    await run(async () => {
      if (guest)
        setPosts((rows) =>
          rows
            .filter((p) => p.pooledAt !== null)
            .map((p) => ({ ...p, choice: null, openedAt: null })),
        );
      else {
        await api("/api/me/history", { method: "DELETE" });
        apply(await api("/api/discovery"));
      }
      setModal(null);
      say("Your Stash and opened history are cleared.");
    });
  }
  async function signOut() {
    try {
      const result = await auth.signOut();
      if (!result.error) {
        window.location.assign("/?auth=signedout");
        return;
      }
    } catch {
      /* reported below */
    }
    say("Sign-out didn’t go through. You’re still signed in. Please try again.");
  }
  function show(post: Post) {
    setFocusId(post.id);
    setShelf(false);
    document
      .getElementById("post")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  // The guest state lives in browser storage, so the server render has nothing to show yet.
  const loaded = !guest || ready;
  const status =
    current?.choice === "save"
      ? "You kept this"
      : current?.choice === "skip"
        ? "You passed on this"
        : null;
  const scope = guest ? "Guest" : null;
  const hasProfile = Boolean(
    viewerProfile.bio?.trim() ||
    viewerProfile.sentence.trim() ||
    viewerProfile.project?.summary.trim(),
  );
  const availability: ScanAvailability =
    props.scanPolicy.status !== "ready" || hasProfile
      ? props.scanPolicy
      : {
          status: viewerProfile.bio === null ? "needs_bio" : "empty_bio",
          reason: "Add a project link or refresh your X bio to give scans some context.",
        };
  const postLayer = current && layer?.postId === current.id ? layer : null;
  // Signed out, the intro always takes the scan block's place, even with an empty queue.
  const scanPanel = !props.user ? (
    <SignedOutIntro onSignIn={signIn} />
  ) : (
    current && (
      <ScanPanel
        key={`${current.id}:${profileVersion}`}
        profile={viewerProfile}
        availability={availability}
        postId={current.id}
        preparingProject={readingBioProject}
        pausedReason={scanPause}
        onPause={setScanPause}
        onResume={() => setScanPause(null)}
        onProfile={() => setModal("privacy")}
        onSignIn={signIn}
        onLayer={setLayer}
      />
    )
  );

  return (
    <div className="app">
      <a className="skip-link" href="#post">
        Skip to the current post
      </a>
      <TopBar
        scope={scope}
        guest={guest}
        stashCount={lists.people.length}
        stashOpen={shelf}
        shortcuts={shortcuts}
        account={account}
        scanPause={scanPause}
        onStash={() => setShelf(!shelf)}
        onSettings={() => setModal("privacy")}
        onSignIn={signIn}
        onSignOut={signOut}
      />

      <div className={`layout${loaded ? "" : " is-loading"}`}>
        <div className="workspace" ref={workspace}>
          {scanPanel}
          <div className="work">
            {/* The queue: the first unsorted pool post that matches the tags (one per person), or one brought back from Stash.
              X's official widget renders it whole and keeps still; only the scan's pointer-transparent outlines sit over it,
              and it only changes when you decide, filter or pick another post. */}
            <section id="post" className="post-col" tabIndex={-1} aria-label="The original post">
              {(focused || status) && (
                <header className="post-head">
                  {focused && (
                    <button className="back" onClick={() => setFocusId(null)}>
                      ← Back to your queue
                    </button>
                  )}
                  {status && <span className="post-src">{status}</span>}
                </header>
              )}
              <AnimatePresence mode="wait" custom={leaving} initial={false}>
                {!loaded ? (
                  <div key="shell" className="post-shell" aria-hidden="true" />
                ) : current ? (
                  <motion.div
                    key={current.id}
                    className="post-swap"
                    custom={leaving}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    exit="leave"
                    variants={{
                      leave: (c: Choice | null) =>
                        c === "save"
                          ? { opacity: 0, y: -28, scale: 0.97, transition: { duration: 0.22 } }
                          : c === "skip"
                            ? { opacity: 0, x: -48, transition: { duration: 0.22 } }
                            : { opacity: 0, transition: { duration: 0.15 } },
                    }}
                  >
                    <Invitation
                      post={current}
                      layer={postLayer}
                      onSpots={setCorded}
                      onOpen={markOpened}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* The post block holds the human message; the queue block keeps counting (0 people to connect). */}
                    <span className="empty-sticker" aria-hidden="true">
                      {filter.length ? "#" : "✓"}
                    </span>
                    <h2>
                      {filter.length
                        ? "No one under these tags."
                        : pool.length
                          ? "All caught up."
                          : "No one here yet."}
                    </h2>
                    <p>
                      {filter.length
                        ? "Try a different hashtag, or drop one to see more people."
                        : pool.length
                          ? "You’ve reviewed everyone in this pool. Clear your history in Settings to start again."
                          : "There are no people in the pool yet."}
                    </p>
                    {filter.length > 0 ? (
                      <button className="btn" onClick={() => setFilter([])}>
                        Clear tags
                      </button>
                    ) : (
                      lists.people.length > 0 && (
                        <button className="btn primary" onClick={() => setShelf(true)}>
                          Open your Stash
                        </button>
                      )
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {current && tags[current.id]?.length ? (
                <p className="post-note">
                  <b>{tags[current.id].map((t) => `#${t}`).join(" ")}</b>
                </p>
              ) : null}
            </section>

            <aside className="panel" aria-label="Your choice">
              {/* Two attached blocks: the queue (evidence, discovery and count) docks onto the decisions. Phones stack the
                queue above the scan and post, and pin the decisions to the bottom. */}
              <div className="queue-block">
                {/* Evidence first: it continues the header's score and signals straight above it, before the queue controls. */}
                <EvidenceCards
                  evidence={postLayer?.evidence ?? []}
                  spots={corded && postLayer ? postLayer.spots : null}
                />
                <div className="panel-top">
                  <DiscoveryFilters
                    tags={tagNames.map((name) => ({
                      name,
                      count: unseen.filter((post) => tags[post.id]?.includes(name)).length,
                    }))}
                    selected={filter}
                    onChange={(next) => {
                      setFilter(next);
                      setFocusId(null);
                    }}
                  />
                  <div className="panel-head">
                    <h1>
                      {!loaded ? (
                        " "
                      ) : focused ? (
                        <>Another look.</>
                      ) : (
                        <>
                          <span className="queue-count">
                            <Count value={deck.length} />
                          </span>{" "}
                          {deck.length === 1 ? "person" : "people"}{" "}
                          <span className="br">to connect</span>
                        </>
                      )}
                    </h1>
                    {(focused || deck.length > 0) && (
                      <p className="panel-sub">
                        {focused
                          ? "Change your mind any time."
                          : "Keep someone in your Stash. Make the first move on X."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="dock-block">
                {current && (
                  <Decisions
                    post={current}
                    shortcuts={shortcuts}
                    hit={hit}
                    busy={pending}
                    onDecide={decide}
                  />
                )}

                <p className="panel-foot">
                  {current?.openedAt ? <>Opened on X {timeAgo(current.openedAt)}. </> : null}
                  {/* The one visible count on desktop; phones show it in the tower's top row instead. */}
                  {!focused && loaded ? (
                    <span className="foot-count">
                      {deck.length} {deck.length === 1 ? "person" : "people"} to connect.{" "}
                    </span>
                  ) : null}
                  {!account && (
                    <>
                      <button className="link" onClick={signIn}>
                        Continue with X
                      </button>{" "}
                      to keep future saves on your account.{" "}
                    </>
                  )}
                </p>
              </div>
            </aside>
          </div>
          {corded && postLayer && <Cords root={workspace} evidence={postLayer.evidence} />}
        </div>

        <Stash
          dialogRef={shelfRef}
          open={shelf}
          onClose={() => setShelf(false)}
          browserOnly={guest && !account}
          lists={lists}
          list={list}
          onList={setList}
          focusId={focusId}
          tags={tags}
          busy={pending}
          unopenedCount={unopened.length}
          onOpenAll={openStash}
          onOpen={markOpened}
          onView={show}
          onMove={moveEntry}
        />
      </div>

      <footer className="foot">
        <button className="link" onClick={() => setModal("privacy")}>
          {props.user ? "Your profile & settings" : "Settings & privacy"}
        </button>
        {!props.authReady && !props.user && <span>X sign-in hasn’t been configured yet.</span>}
        {props.user && hasOpened && feedback === null && (
          <ConnectionFeedback
            onAnswer={async (useful) => {
              await api("/api/me/activity", {
                method: "POST",
                body: { event: "feedback", useful },
              });
              setFeedback(useful);
            }}
          />
        )}
      </footer>

      <AnimatePresence>
        {fly && (
          <motion.span
            key={fly.key}
            className="fly"
            aria-hidden="true"
            initial={{ x: fly.x1, y: fly.y1, scale: 1, rotate: -8 }}
            animate={{ x: fly.x2, y: fly.y2, scale: 0.45, rotate: 10 }}
            exit={{ opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.55, ease: [0.5, 0, 0.2, 1] }}
            onAnimationComplete={() => setFly(null)}
          >
            +1
          </motion.span>
        )}
      </AnimatePresence>

      <Toast
        notice={notice}
        onClose={() => setNotice(null)}
        host={shelf ? shelfRef.current : null}
      />

      {authStep && (
        <SignInSheet
          step={authStep.step}
          code={authStep.code}
          authReady={props.authReady}
          onStep={(step, code) => setAuthStep({ step, code })}
          onClose={() => setAuthStep(null)}
        />
      )}

      {modal === "privacy" && (
        <Settings
          context={props.user ? viewerProfile : undefined}
          readingBioProject={readingBioProject}
          onProfileChange={updateProfile}
          shortcuts={shortcuts}
          busy={pending}
          onShortcuts={setKeyboardShortcuts}
          onClear={clearMine}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

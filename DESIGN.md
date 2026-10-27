# hashtagconnect design

How the app should look, move and read. Behaviour and APIs live in [README.md](README.md); this file is about intent and conventions, not exact pixel values.

## Intent

hashtagconnect helps small X accounts grow a relevant circle of followers. People posting #connect want more connections; shared interests give them a reason to engage beyond the invitation. The promise is **“Find your first circle on X. Meet people interested in what you share, create or sell.”** One real invitation asks one question: keep this person or pass. We promise no algorithm boost or reciprocal follow. Kept people wait in **Stash** until you open their profile on X. It should feel immediate, human and decisive: bold, clean, a little playful, never a dashboard.

## Brand

- Full name **hashtagconnect**, always lowercase. Compact brand **#connect** (on phones the wordmark drops "hashtag").
- Mark: a bold `#` on a magenta sticker with a hard ink edge, slightly tilted. The same sticker idea appears in the favicon, Stash tiles and the Keep "+1".

## Colour roles

The reading surface is **paper**; the primary decisions sit on one **slab**.

| Role  | Light                                                                      | Dark                 | Used for                                                                                                            |
| ----- | -------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Paper | bone `#f4f3ef`                                                             | near-black `#0b0b0c` | Page, where posts sit as content                                                                                    |
| Slab  | graphite `#141416`                                                         | same                 | Control panel, phone action bar, Stash, sheets, menus, toasts                                                       |
| Hot   | magenta `#ff2d87`, ink text                                                | same                 | Keep, "on" states, counts, the mark. The only loud colour                                                           |
| Scan  | highlighter lime `#c6ff3d` with ink text; readable text on paper `#4d6b00` | lime `#c6ff3d`       | The relevance score, its meters, evidence highlights and cords. Opposite magenta, so the scan never blurs into Keep |
| Focus | violet ring                                                                | lighter violet       | Every keyboard focus ring (never magenta, so it shows on Keep)                                                      |

Tokens are CSS custom properties in `pages/style.css`. Slab elements redefine the same tokens, so a component reads `--ink`, `--surface` and so on and looks right on either surface. Small text must stay at least 4.5:1; only decorative dashes and disabled states may be faint.

## Type

- **Bricolage Grotesque** (800) for headlines, buttons, stickers and handles: big, tight, confident.
- **Geist** for body and UI text. **Geist Mono** only for codes and references.
- Copy sizes jump: huge headline, plain 13–16px everything else. Avoid a ladder of in-between sizes.

## Layout and the official embed

- The workspace is built from **attached blocks**, each with the hard ink edge: the scan block docks across the top; the post block (on paper, because the post is content) and the queue block (slab) tuck under it side by side; the decisions dock tucks under the queue. Each block casts a hard shadow onto the one below, so the screen reads as something built. In dark mode the ink edge would vanish on the near-black page, so blocks take a lifted grey edge (`#3a3a41`) and the post block a slightly lighter dark paper (`#121214`); the black hard shadows still show where they fall on the block below. Below 1000px the same blocks stack into a tower: queue, scan, post, with the decisions pinned. Side by side, the post column never narrows below X’s 550px post (614px with padding), because highlights only line up at that width; the stacking point is where that would leave the queue too narrow, so evidence cards and their highlights always appear together. The queue says **N people to connect** (singular for one), using the real remaining count, including **0 people to connect** when empty. On desktop it appears once: beside evidence, in the line under Pass/Keep, with the page’s h1 hidden; without evidence (guests, before a scan) the big h1 fills the queue block instead of leaving it empty. Phones keep the count in the tower’s top row. An empty queue puts one message with a sticker and its action (Open your Stash) directly on the paper post block, never a second card inside it; without a scan block, the post and queue blocks sit flush instead of tucking under it.
- The relevance scan spans the shared header above the invitation and controls. Lime belongs to the scan; there is no decorative top rule or redundant meter. The header uses the same two columns as the blocks below. Over the post: a lime score sticker slaps on and counts up to the **relevance /100** score, beside one short explanation selected by Jev Choice; “Tentative” appears when the comparison is uncertain. Over the queue: **Interests in common**, **Related work** and **Project fit** in one aligned grid of label, thin meter and value, so labels never wrap on a laptop. While scanning, the same layout shows a waiting dashed sticker and pending meters, so nothing jumps when the result lands. Keep **Project fit** visible in every scored result. Without a saved project, show **—** rather than a percentage; its accessible label explains that no project was provided. The overall rating is Jev’s independent relevance judgment, not their average. **Sources** holds the exact bio and source link, in a popover anchored to its button so the header never changes height. Methodology and privacy live in Settings, not repeated beneath each result. A rating describes relevance of the invitation to the supplied profile, never a probability of connecting. Missing information gets no rating. The control slab keeps its shape and decisions while the scan runs.
- Phones: one compact count row, a compact scan, then the invitation. Pass and Keep stay fixed to the bottom, with room below the content so nothing becomes unreachable.
- Scan status and sign-in guidance sit in the full-width scan row. Signed out that row is an intro block in the scan block’s place: the welcome copy, Continue with X and three steps (browse #connect posts, see what you have in common, keep them in your Stash then connect on X), shown even when the queue is empty. Anonymous browsing continues below it. It has no real or invented scan data, and there is no separate welcome banner above the workspace. A paused scan service is indicated quietly in the top bar beside Stash. There is no usage quota. Signed-in users get a comparison as each post settles, with no trigger or confirmation step. A service failure pauses automatic scans until Retry. Saved results are reused until the inputs or analysis version change; that is a server concern, not another user step. The right slab holds the browsing decisions.
- **Evidence is in your words.** Up to three phrases from your bio, context or project that Jev found the post seeks or shares appear as cards at the top of the queue block (“From your profile”), directly under the header’s signals so they read as the reason behind the score, before the queue controls; each with its source and strength. We quote only the viewer, never the post. When a card's phrase is highlighted, a patch cord (the sign-in sheet's motif) runs as one continuous cable from the highlight's bottom-right corner, along the gap between lines to the embed's edge (under the words, never through them or across other lines), then curves through the gutter to the card's plug. Cards stay strongest first whether or not they are highlighted; a card without a highlight has no plug. Signed in, the slot is never blank around a scan: two placeholder cards while scanning, and a dashed “Nothing from your profile stood out here.” card (with Edit your profile) when no phrase is strong enough. Guests and unscanned posts show no slot. Phrases quote the bio as X shows it: handles whole, links as their display text (“dev at kepler.so”). A confident highlight is a plain marker stroke; only approximate ones get the dashed outline. Hovering or focusing a card lights its outline and dims the others. With evidence, the queue count shrinks to one line so the decisions stay in view on a laptop.
- On phones, the scan stays inline above the post: a short explanation, a smaller score sticker, your phrases as chips, and compact signal rows, without an extra section label or separators on completed results. Sources remains available. It never opens a sheet, steals focus or scrolls automatically.
- Stash ends in X: one **Open N tabs** action opens the remaining profile links together, with post links for unconfirmed authors. Successful openings leave the saved people in Stash; blocked tabs remain unopened. Individual links remain available. Each row’s More menu offers **View post** and **Remove**; View post returns to the main view. There is no second inline post preview or profile editing flow.
- **The embed is X's, not ours.** It renders through X's official widget, whole: never cropped, scaled, re-typeset or used as a gesture target. The one exception is the scan layer, which ignores the pointer and never hides text: a lime sweep while scanning, then unlabelled highlights where Jev located your phrases. On the paper post a highlight is a lime marker stroke multiplied behind the words, so the text stays fully legible (a lime outline would vanish on white); approximate ones are fainter with a dashed ink edge. Dark posts get a lime outline instead. Cords are cables: an ink jacket around a lime core. Highlights appear only when Jev's text check and image presence agree and the live render matches the 550px capture; otherwise they stay off. A **Highlights** toggle above the post turns the layer and its cords off. Our rounded `PostFrame` container centres it with a stable minimum height, and taller posts simply grow it. Posts load automatically. Loading and error states sit on that container; there is no enable gate or embed toggle. Keep one X embeds disclosure under Settings → Privacy. The handle sits inside our container above the widget; “The original post” has no duplicate handle. A neutral **On hashtagconnect** badge appears only when the stored handle matches a linked X identity from OAuth. Being on the service is an additional signal of openness to connecting. Keep that visible beside the author; Jev’s text-relevance score remains a separate signal.
- The scan and its original invitation remain visible together. Profile history is absent from the app for now: no tabs, secondary timeline or collapsed history section.
- This MVP never rebuilds post or profile content from embed data. Stash shows a person as their handle, a profile link and, on request, their real post. Future components built on approved API data (for example profile details) are welcome if they follow X's display requirements: author identity shown, text unmodified.

## Discovery and participation

- Discovery belongs to the service: collect public #connect posts into one shared pool. People do not apply, submit, or wait for approval. Posts are added manually to the shared pool.
- **Your profile & settings** keeps enrichment optional and inside the existing graphite sheet. Settings are labelled groups of rows on raised cards: Your profile (signed in), Keyboard, Privacy (one disclosure per topic) and Your data. One project-link field leads to a short editable description, its topics (“Scans look for: …”, the phrases scans check for the project), a supporting excerpt under “From the page”, and **Use this profile**. After the first successful X OAuth callback, the server reads the first valid project link in the bio and saves its description automatically in the background. The client only observes progress. Keep the reading status in the existing scan row and Settings; the first scan waits for that context. Users can review, edit or remove it afterward, with no confirmation step or extra onboarding screen. Subsequent manual links still use the editable preview. Remove returns to bio/context alone and does not trigger another automatic read. Keep the X bio and optional extra sentence in a disclosure below, without pre-filling the sentence with a duplicate bio. No separate onboarding, tag questionnaire or profile dashboard. Saving closes the sheet, preserves the current person and filters, and refreshes that scan. A quiet “Using your bio + [project domain]” link above the result opens these settings; it names only the inputs actually used. Never hardcode an example project.
- A project’s subject can support relevance; its features must never become invented personal skills. Scan Sources shows the saved project description and original source link. Reading and saving use inline status text; the sheet’s existing entrance motion is sufficient.
- No hashtag filters: almost every post shares #connect and most other tags appear on one or two people, so a filter mostly empties the queue. The relevance scan does the sorting; the post's own hashtags show under it. No manual publishing controls belong in the browsing interface.
- Stash copy makes the next action explicit: open profiles, then follow or speak on X. After an opening, a small optional question in the footer asks whether someone was worth connecting with.
- First-party experiment measurement stays internal; it has no review screen in the browsing experience.

## Components

`src/components/` holds UI sections; `pages/index.tsx` owns state and actions and composes them.

- `ui.tsx`: the few shared primitives (Modal, Toast, Count, Mark, Keycap, StashIcon, OpenLink, useNarrow). Add here only when two or more sections need it.
- One file per real section: `top-bar`, `decisions`, `stash`, `add-post`, `settings`, `auth`, `scan`, `evidence`, `invitation`, `post-frame`, `community`.
- Pure helpers stay outside components. The X widget loader lives with the UI components.
- Style with plain CSS classes in `pages/style.css`, grouped by section. Phone overrides must come after the rules they override.
- Add a short doc comment when a component's purpose or limits aren't obvious from its name (most sections here have one). Keep existing comments accurate when you change the code.

## Motion

Motion explains what happened; it never decorates.

- Big buttons press in like keys, sinking into a hard shadow. A shortcut briefly shows the same press.
- Keep sends a "+1" sticker to the Stash counter; the post leaves up on Keep and left on Pass.
- Counts roll; sheets rise; Stash rows settle with a short spring.
- `prefers-reduced-motion` turns animation off (the CSS and Motion's `reducedMotion="user"`); nothing depends on motion to make sense.

## Keyboard and accessibility

- Shortcuts: **←** Pass, **→** Keep, **S** Stash, **Esc** closes overlays (Stash and sheets). They're silent while typing, with modifiers, inside dialogs and inside X's iframe. **Keyboard shortcuts** can be switched off in Settings (all of them; Esc on native dialogs always works).
- Every action is also an ordinary button or link. Buttons carry `aria-keyshortcuts`.
- `Keycap` is the only way to draw a key. Hint keycaps on controls are decorative and show only with a fine pointer; keycaps in text always show and are read by name.
- Overlays are native `<dialog>`s: focus stays inside, Escape closes, focus returns. Only one layer opens at a time.

## Copy

- Short, plain and human. Say what happened ("Kept. They're in your Stash.") and offer Undo.
- Honest about data: no claims of matching, availability, follows or verdicts. A scan reports signals, not judgements; signed-out visitors get an intro with steps instead of a scan, never invented values.
- No AI-product filler, no exclamation marks, no "unlock" or "supercharge".

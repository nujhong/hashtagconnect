# hashtagconnect design

How the app should look, move and read. Behaviour and APIs live in [README.md](README.md); this file is about intent and conventions, not exact pixel values.

## Intent

hashtagconnect helps small X accounts grow a relevant circle of followers. People posting #connect want more connections; shared interests give them a reason to engage beyond the invitation. The promise is **“Grow your circle on X. Discover people who want to connect, with interests that fit yours.”** One real invitation asks one question: keep this person or pass. We promise no algorithm boost or reciprocal follow. Kept people wait in **Stash** until you open their profile on X. It should feel immediate, human and decisive: bold, clean, a little playful, never a dashboard.

## Brand

- Full name **hashtagconnect**, always lowercase. Compact brand **#connect** (on phones the wordmark drops "hashtag").
- Mark: a bold `#` on a magenta sticker with a hard ink edge, slightly tilted. The same sticker idea appears in the favicon, Stash tiles and the Keep "+1".

## Colour roles

The reading surface is **paper**; the primary decisions sit on one **slab**.

| Role | Light | Dark | Used for |
| --- | --- | --- | --- |
| Paper | bone `#f4f3ef` | near-black `#0b0b0c` | Page, where posts sit as content |
| Slab | graphite `#141416` | same | Control panel, phone action bar, Stash, sheets, menus, toasts |
| Hot | magenta `#ff2d87`, ink text | same | Keep, "on" states, counts, the mark. The only loud colour |
| Scan | violet `#9d8cff`, readable score `#6441d8` | readable score `#b9a8ff` | The relevance score |
| Focus | violet ring | lighter violet | Every keyboard focus ring (never magenta, so it shows on Keep) |

Tokens are CSS custom properties in `pages/style.css`. Slab elements redefine the same tokens, so a component reads `--ink`, `--surface` and so on and looks right on either surface. Small text must stay at least 4.5:1; only decorative dashes and disabled states may be faint.

## Type

- **Bricolage Grotesque** (800) for headlines, buttons, stickers and handles: big, tight, confident.
- **Geist** for body and UI text. **Geist Mono** only for codes and references.
- Copy sizes jump: huge headline, plain 13–16px everything else. Avoid a ladder of in-between sizes.

## Layout and the official embed

- Desktop is one connected graphite workspace: a shared scan header, the official X post on the left, and adjoining controls on the right. Hashtag filters sit at the top of the right controls, separate from the per-person decisions. The queue says **N people to connect** (singular for one), using the real remaining count.
- The bio scan spans the shared header above the invitation and controls. Violet belongs to the score; there is no decorative top rule or redundant meter. A brief plain-language explanation of the supported relevance level leads; the violet **relevance /100** rating is secondary; “Tentative” appears when the comparison is uncertain. **Interests in common** and **Related work** are always visible as vertically stacked supporting probabilities beside the overall rating (below it on phones). The overall rating is Jev’s independent relevance judgment, not their average. **Sources** holds the exact bio and source link. Methodology and privacy live in Settings, not repeated beneath each result. A rating describes relevance of the invitation to the bio, never a probability of connecting. Missing information gets no rating. The control slab keeps its shape and decisions while the scan runs.
- Phones: one compact count-and-filter toolbar, a compact scan, then the invitation. Pass and Keep stay fixed to the bottom, with room below the content so nothing becomes unreachable. Filters use a native popover with outside-click and Escape dismissal.
- Scan status and sign-in guidance sit in the full-width scan row. The configured app limit sits in the top bar beside Stash; it is a cap, not a remaining balance. Usage is quiet neutral text, visually distinct from the violet rating; it never looks like another score. Signed-in users get a comparison as each post settles, with no trigger or confirmation step. A service or quota failure pauses automatic scans until Retry. Local results stay fresh. Production can reuse unchanged inputs for a configured lifetime; that is a server concern, not another user step. The right slab holds the browsing decisions.
- On phones, the scan stays inline above the post: a short explanation, a smaller **Relevance /100** score and two plain supporting rows, without the extra Bio scan label or separators on completed results. Sources remains available. It never opens a sheet, steals focus or scrolls automatically.
- Stash ends in X: one **Open N tabs** action opens the remaining profile links together, with post links for unconfirmed authors. Successful openings leave the saved people in Stash; blocked tabs remain unopened. Individual links remain available. Each row’s More menu offers **View post** and **Remove**; View post returns to the main view. There is no second inline post preview or profile editing flow.
- **The embed is X's, not ours.** It renders through X's official widget, whole: never cropped, scaled, re-typeset, covered or used as a gesture target. Our rounded `PostFrame` container centres it with a stable minimum height, and taller posts simply grow it. Loading, error and consent states sit on that container. The handle sits inside our container above the widget; “The original post” has no duplicate handle. A neutral **On hashtagconnect** badge appears only when the stored handle matches a linked X identity from OAuth. Being on the service is an additional signal of openness to connecting. Keep that visible beside the author; Jev’s text-relevance score remains a separate signal.
- The scan and its original invitation remain visible together. Profile history is absent from the app for now: no tabs, secondary timeline or collapsed history section. Standalone embed fixtures remain available for diagnosis.
- This MVP never rebuilds post or profile content from embed data. Stash shows a person as their handle, a profile link and, on request, their real post. Future components built on approved API data (for example profile details) are welcome if they follow X's display requirements: author identity shown, text unmodified.

## Discovery and participation

- Discovery belongs to the service: collect public #connect posts into one shared pool. People do not apply, submit, or wait for approval. The existing seeded pool remains until collection is connected.
- **Your bio & context**, in Settings, offers one optional “What are you building or sharing?” sentence, prefilled from the bio. It is private scan input and never edits X or makes onboarding mandatory.
- Hashtag filters use the tags stored with collected posts. No manual publishing controls belong in the browsing interface.
- Stash copy makes the next action explicit: open profiles, then follow or speak on X. After an opening, a small optional question in the footer asks whether someone was worth connecting with.
- First-party experiment measurement stays internal; it has no review screen in the browsing experience.

## Components

`src/components/` holds UI sections; `pages/index.tsx` owns state and actions and composes them.

- `ui.tsx`: the few shared primitives (Modal, Toast, Count, Mark, Keycap, StashIcon, OpenLink, useNarrow). Add here only when two or more sections need it.
- One file per real section: `top-bar`, `discovery-filters`, `decisions`, `stash`, `add-post`, `settings`, `auth`, `scan`, `invitation`, `post-frame`, `community`.
- Pure helpers stay outside components (`src/people.ts`, `src/sandbox.ts`). The X widget loader is `src/x-embed.tsx`.
- Style with plain CSS classes in `pages/style.css`, grouped by section. Phone overrides must come after the rules they override.
- Add a short doc comment when a component's purpose or limits aren't obvious from its name (most sections here have one). Keep existing comments accurate when you change the code.

## Motion

Motion explains what happened; it never decorates.

- Big buttons press in like keys, sinking into a hard shadow. A shortcut briefly shows the same press.
- Keep sends a "+1" sticker to the Stash counter; the post leaves up on Keep and left on Pass.
- Counts roll; sheets rise; Stash rows settle with a short spring.
- `prefers-reduced-motion` turns animation off (the CSS and Motion's `reducedMotion="user"`); nothing depends on motion to make sense.

## Keyboard and accessibility

- Shortcuts: **←** Pass, **→** Keep, **S** Stash, **Esc** closes overlays (Stash and sheets). They're silent while typing, with modifiers, inside dialogs and inside X's iframe. Letter shortcuts can be switched off in Settings.
- Every action is also an ordinary button or link. Buttons carry `aria-keyshortcuts`.
- `Keycap` is the only way to draw a key. Hint keycaps on controls are decorative and show only with a fine pointer; keycaps in text always show and are read by name.
- Overlays are native `<dialog>`s: focus stays inside, Escape closes, focus returns. Only one layer opens at a time.

## Copy

- Short, plain and human. Say what happened ("Kept. They're in your Stash.") and offer Undo.
- Honest about data: no claims of matching, availability, follows or verdicts. A scan reports signals, not judgements; the demo is always labelled fictional.
- No AI-product filler, no exclamation marks, no "unlock" or "supercharge".

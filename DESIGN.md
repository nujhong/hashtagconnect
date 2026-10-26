# hashtagconnect design

How the app should look, move and read. Behaviour and APIs live in [README.md](README.md); this file is about intent and conventions, not exact pixel values.

## Intent

People post #connect invitations on X, and the feed shows them late. hashtagconnect puts one real invitation in front of you at a time and asks one question: keep this person or pass. Kept people wait in **Stash** until you open their profile on X. It should feel immediate, human and decisive: bold, clean, a little playful, never a dashboard.

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
| Scan | violet `#9d8cff`, readable score `#6441d8` | readable score `#b9a8ff` | The relevance score and its meter |
| Focus | violet ring | lighter violet | Every keyboard focus ring (never magenta, so it shows on Keep) |

Tokens are CSS custom properties in `pages/style.css`. Slab elements redefine the same tokens, so a component reads `--ink`, `--surface` and so on and looks right on either surface. Small text must stay at least 4.5:1; only decorative dashes and disabled states may be faint.

## Type

- **Bricolage Grotesque** (800) for headlines, buttons, stickers and handles: big, tight, confident.
- **Geist** for body and UI text. **Geist Mono** only for codes and references.
- Copy sizes jump: huge headline, plain 13–16px everything else. Avoid a ladder of in-between sizes.

## Layout and the official embed

- Desktop is a split workspace: the official X post on the left, the control slab on the right, top edges aligned. Hashtag stickers sit above both, never inside the per-post controls.
- The bio scan belongs with the evidence: an automatic annotation above the post, marked by violet. One bold violet **relevance /100** rating leads; “Tentative” appears when the comparison is uncertain. **Shared interests** and **Related work** are always visible as two compact supporting values. **Sources** holds the exact bio and source link. Methodology and privacy live in Settings, not repeated beneath each result. A rating describes relevance of the invitation to the bio, never a probability of connecting. Missing information gets no rating. The control slab keeps its shape and decisions while the scan runs.
- Phones: post first, Pass and Keep fixed to the bottom of the screen.
- Scan status, sign-in guidance and the configured app limit sit at the top of the left column. Usage is quiet neutral text, visually distinct from the violet rating; it never looks like another score. Signed-in users get a comparison as each post settles, with no trigger or confirmation step. A service or quota failure pauses automatic scans until Retry. No results are cached; returning to a post or refreshing starts fresh. The right slab holds the browsing decisions.
- On phones, the scan stays inline above the post. It never opens a sheet, steals focus or scrolls automatically.
- Stash ends in X: one **Open N tabs** action opens the remaining profile links together, with post links for unconfirmed authors. Successful openings leave the saved people in Stash; blocked tabs remain unopened. Individual links remain available.
- **The embed is X's, not ours.** It renders through X's official widget, whole: never cropped, scaled, re-typeset, covered or used as a gesture target. Our rounded `PostFrame` container centres it with a stable minimum height, and taller posts simply grow it. Loading, error and consent states sit on that container.
- The scan and its original invitation remain visible together. Profile history is absent from the app for now: no tabs, secondary timeline or collapsed history section. Standalone embed fixtures remain available for diagnosis.
- This MVP never rebuilds post or profile content from embed data. Stash shows a person as their handle, a profile link and, on request, their real post. Future components built on approved API data (for example profile details) are welcome if they follow X's display requirements: author identity shown, text unmodified.

## Components

`src/components/` holds UI sections; `pages/index.tsx` owns state and actions and composes them.

- `ui.tsx`: the few shared primitives (Modal, Toast, Count, Mark, Keycap, StashIcon, OpenLink, useNarrow). Add here only when two or more sections need it.
- One file per real section: `top-bar`, `decisions`, `stash`, `add-post`, `settings`, `auth`, `scan`, `invitation`, `post-frame`.
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

# hashtagconnect

Compact brand: **#connect**. (Package, worker and storage identifiers still say `xconnect`; they are deliberately unchanged.)

A shared, curator-managed pool of public #connect invitations from X. Posts appear as genuine official X embeds. You privately keep or pass the people behind them, then visit their profiles from Stash. Void + React on Cloudflare Workers + D1, animated with Motion.

Design intent, colour and type roles, the embed boundary, motion and copy style are in [DESIGN.md](DESIGN.md). Code layout: `pages/index.tsx` holds page state and actions and composes the UI sections in `src/components/`. Pure helpers are in `src/people.ts` and `src/sandbox.ts`, the X widget loader is `src/x-embed.tsx`, and server code is in `src/server/` and `routes/api/`.

## The experience

**Split workspace.** The real post sits still on one side as X's official embed. Big, tactile controls sit on the other. On phones the post comes first and the decisions are pinned to the bottom of the screen.

- **Hashtag stickers** above the workspace filter the queue. Tags are what the curator saw in each post; they're never read from X. Tag storage doesn't exist in the backend yet, so filtering works only in the preview sandbox; signed-in sessions show them disabled.
- **Keep / Pass.** The two big controls sit side by side. Each choice can be undone from the toast. Keeping sends a small sticker to the **Stash** counter. The official embed already links to X; a small app-owned post link appears only when the embed is off or unavailable.
- **Stash** opens a private native dialog listing the people you kept. An **Open N tabs** action opens all remaining profile and unlinked-post links together. Only successfully opened tabs are marked; blocked tabs remain unopened, with guidance to allow pop-ups or use individual links. Each confirmed person appears once, as a link to their profile on X; their original post, Remove and the curator's link fix sit behind the row's *More*. Saved posts without a confirmed author, *Passed* and *Add a post by link* are quieter sections below the list. Saved people survive removal of their source post. Members can save a URL privately; an unlinked URL remains explicitly post-level. The curator confirms the author's profile when publishing and can correct that profile link later. Reconfirming an existing post preserves its previous keeps, passes and opened history.
- **Automatic bio scan.** Each post a signed-in member views is compared with their OAuth bio using its official oEmbed text through `POST /api/scan`. No extra click is needed. One native Jev Score question gives a text-relevance rating out of 100. Four Noul questions check useful detail, shared interests and related work. The two supporting probabilities are always visible below the rating; Sources holds the bio and post link. Methodology and logging details live in Settings. Uncertain comparisons are marked Tentative; missing information receives no rating. No manual interests, timeline API calls, bot verdict or compatibility percentage. A clearly labelled **fictional demo** works without signing in. A missing bio, an empty bio and provider failures have separate states. No results are cached; returning to a post or refreshing starts a new scan. Service and quota failures pause automatic scanning until Retry. See [scan implementation and live status](docs/profile-scan.md).
- **Profile posts.** For curator-confirmed authors, Invitation / Profile posts switches to X's official profile timeline. It loads only when selected, with a profile link available if X cannot render it. This is a browser widget, not a timeline API fetch or an additional scan input.
- **What is recorded.** Your keeps, passes, clicks on our own profile or fallback post links, and successful tabs opened by the Stash action. Clicks inside X's iframe are not tracked. No follow or reply checks, no matching, no availability claims. Post dates and replies stay inside the embed.
- **Embeds and privacy.** Embeds stay off until you choose to load them. Loading, unavailable and retry states are handled, and the widget follows the system theme. *Settings & privacy* turns embeds on or off and clears your Stash and history.

The sandbox is seeded with five real #connect posts picked by hand from X search, merged without overwriting existing saves or choices. Shortcuts are **← Pass**, **→ Keep**, **S Stash**, and **Esc Close**. They stay silent while typing, using dialogs, or focusing the X iframe. The letter shortcut can be disabled in settings; all actions also have standard controls.

## Sign-in journey (`src/components/auth.tsx`)

| State | What you see |
| --- | --- |
| Signed out | *Continue with X* in the top bar goes straight to X. One line in the controls says it keeps future saves on your account. *Access details* (optional) separates what X asks for (`tweet.read`, `users.read`) from what hashtagconnect uses (name, username, photo, bio). |
| Handoff | "Opening X…" with a drawing cord. The tab redirects to X's own authorization page. |
| Returning | Back at `/?auth=welcome`, a toast confirms who you're signed in as. Sandbox saves are not transferred. |
| Cancelled | `?error=access_denied`: "Cancelled. Nothing was shared." with *Try again*. |
| Error | Any other `?error=` code, including an expired or missing OAuth state (`onAPIError.errorURL` in `auth.ts`): *Try again* plus a reference code. |
| Signed in | The avatar menu shows the account name and photo, a Curator badge for the curator, privacy settings and Sign out. |
| Sign out | Calls `auth.signOut()` and checks its `error` result. Success reloads with a confirmation toast. Failure says you're still signed in. |

Each step change moves focus to the new step's heading, so keyboard and screen-reader users hear the new state.

**Auth preview.** When `AUTH_TWITTER_CLIENT_ID`/`SECRET` aren't set, the handoff runs with a dashed "Preview · no real sign-in happens" label and lets you choose the outcome (approve, cancel, fail). "Approve" shows a dashed preview avatar labelled "not a real session". No session is created, and data stays in browser storage. The top bar shows a dashed *Preview* or *Preview session* label in this mode.

## Run locally

Requires Node **24.21.0 or newer**.

```sh
npm ci
npx void db migrate
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
npm run check && npm test && npm run build
```

X sign-in: create a confidential Web App in the X Developer Console with the callback `http://127.0.0.1:5173/api/auth/callback/twitter`, then set `AUTH_TWITTER_CLIENT_ID`, `AUTH_TWITTER_CLIENT_SECRET` and optionally `CURATOR_X_ID` (your numeric X account ID) in `.env`. Requested scopes are `tweet.read users.read`. Restart the dev server after changing auth config.

The current local OAuth setup has been tested with a real sign-in. The bio is collected in the same `/2/users/me` profile lookup and refreshed on subsequent sign-ins. Existing sessions without a captured bio offer *Refresh X bio*; an account with an empty X bio gets a separate explanation. Profile edits through Better Auth's `/update-user` endpoint are disabled. Curator authorization and scans use Better Auth's trusted provider account ID. For scans, configure the Cloudflare account, gateway and inference credentials from `env.example`; no X bearer token is needed. Scans are uncapped by the app when SCAN_DAILY_LIMIT is omitted. A positive value caps attempts per UTC day across all users; zero pauses model calls. Provider limits still apply. Gateway request logging is enabled; model-response caching stays off.

## API

| Route | Purpose |
| --- | --- |
| GET /api/discover | Shared pool plus the viewer's private post and person records |
| POST /api/import | Save a URL privately, or publish with a curator-confirmed author profile |
| POST /api/decisions | Set save, skip or clear a choice by postId or personId |
| DELETE /api/decisions | Clear the viewer's choices and opened history |
| POST /api/opened | Record a click on an app-owned profile or fallback post link |
| PATCH /api/people | Curator corrects a confirmed profile link |
| DELETE /api/pool | Curator removes a post; saved people remain |
| POST /api/scan | Authenticated OAuth-bio / oEmbed-post comparison through Jev |

## Proposed, for discussion (not built)

1. **Curator hashtag tags.** Add a `post_tags (post_id, tag)` table and an optional `tags` field on `POST /api/import` (pool only). Then `GET /api/discover` returns tags and the live filter switches on. Tags are a curator judgement, not data fetched from X.
2. **Hashtag collector.** Still not approved. It would poll X API v2 recent search for the channel hashtags, which X bills per returned resource ([pricing](https://docs.x.com/x-api/getting-started/pricing)). It also needs a deletion and update mechanism to satisfy the [Developer Policy](https://docs.x.com/developer-terms/policy).
3. **Sandbox to account.** Optionally offer to import sandbox saves after sign-in. Today they aren't transferred.
4. **Publication time.** Storing each post's creation time would allow honest freshness sorting. Today "added" is when the curator added the post.

Not deployed. The OAuth-bio / oEmbed-post path has been verified end to end in Personal Chrome through the existing momentium gateway, using the signed-in user's real bio and a curated post. Signed-in browsing now automatically requests a comparison for the current post. Guest browsing and the fictional demo never call Jev.

Known local issue: the first official embed can time out even for an available post; **Try again** has rendered it successfully. The container layout is independent of this unresolved widget initialization issue.

Profile timelines are wired through the official SDK but have not rendered successfully in local testing. On 26 October, the SDK's actual timeline URL returned **Rate limit exceeded** in Chrome; the plain-widget test and X Publish preview also failed. Switching views now preserves the widget to avoid redundant requests. A profile link remains available; there are no automatic retries or paid timeline lookups.

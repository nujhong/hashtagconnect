# hashtagconnect

Compact brand: **#connect**. (Package, worker and storage identifiers still say `xconnect`; they are deliberately unchanged.)

Grow your circle on X with people whose interests fit yours. Discovery is designed around a service-collected shared pool of public #connect posts. The prototype uses its existing seeded pool. Automatic collection is not connected yet. Posts appear as genuine official X embeds. You privately keep or pass the people behind them, then visit their profiles from Stash. Void + React on Cloudflare Workers + D1, animated with Motion.

Design intent, colour and type roles, the embed boundary, motion and copy style are in [DESIGN.md](DESIGN.md). Code layout: `pages/index.tsx` holds page state and actions and composes the UI sections in `src/components/`. Pure helpers are in `src/people.ts` and `src/sandbox.ts`, the X widget loader is `src/x-embed.tsx`, and server code is in `src/server/` and `routes/api/`.

## The experience

**Connected workspace.** The scan joins the official post and big controls on one graphite surface. Phones use a compact discovery toolbar and scan above the post, with decisions pinned to the bottom.

- **Hashtag filters** sit in the controls, or a popover on mobile. Filters use the hashtags stored with each post in D1. The signed-out sandbox uses its separate local tags.
- **Keep / Pass.** The two big controls sit side by side. Each choice can be undone from the toast. Keeping sends a small sticker to the **Stash** counter. The official embed already links to X; a small app-owned post link appears only when the embed is off or unavailable.
- **Stash** opens a private native dialog listing the people you kept. An **Open N tabs** action opens all remaining profile and unlinked-post links together. Only successfully opened tabs are marked; blocked tabs remain unopened, with guidance to allow pop-ups or use individual links. Each confirmed person appears once, as a link to their profile on X; **View post** returns to the main view; it and **Remove** sit behind the row's *More*. Saved posts without a confirmed author, *Passed* and *Add a post by link* are quieter sections below the list. Saved people survive removal of their source post. Members can save a URL privately; an unlinked URL remains explicitly post-level.
- **Platform membership.** Confirmed authors whose handles match a linked X account from its last sign-in show an “On hashtagconnect” badge inside the embed shell. Being on the service is an additional signal of openness to connecting, displayed separately from text relevance.
- **Connected workspace.** The scan, original invitation and controls share one surface. The right-hand controls show the remaining people to connect and hashtag filters (stored with the live pool). Phones use a compact score, a filter popover and fixed Pass/Keep buttons.
- **Automatic relevance scan.** Each post a signed-in member views is compared with their OAuth bio using its official oEmbed text through `POST /api/scan`. No extra click is needed. One native Jev Score question gives a text-relevance rating out of 100. Four Noul questions check useful detail, shared interests and related work; a fifth assesses Project fit when a saved project exists. The result spans a full row, with compact supporting probabilities stacked vertically; Sources holds the bio and post link. Methodology and logging details live in Settings. Uncertain comparisons are marked Tentative; missing information receives no rating. One optional private sentence can supplement the OAuth bio; there is no required interest questionnaire, timeline API call, bot verdict or compatibility percentage. A Choice question in the same Jev request selects one short explanation. Project fit stays visible as a dash when no project is supplied. The input label opens profile settings; saving keeps the current person and refreshes their scan. A clearly labelled **fictional demo** works without signing in. A missing bio, an empty bio and provider failures have separate states. Local results stay fresh; production reuses unchanged inputs for a configured lifetime. Service and quota failures pause automatic scanning until Retry. See [scan implementation and live status](docs/profile-scan.md).
- **What is recorded.** Your keeps, passes, clicks on our own profile or fallback post links, and successful tabs opened by the Stash action. Clicks inside X's iframe are not tracked. No follow or reply checks, no matching, no availability claims. Post dates and replies stay inside the embed.
- **Embeds and privacy.** Posts load automatically, with X’s `dnt` option enabled. Loading, unavailable and retry states are handled, and the widget follows the system theme. *Settings & privacy* holds the single embed disclosure and the control for clearing your Stash and history.

The sandbox is seeded with five real #connect posts picked by hand from X search, merged without overwriting existing saves or choices. Shortcuts are **← Pass**, **→ Keep**, **S Stash**, and **Esc Close**. They stay silent while typing, using dialogs, or focusing the X iframe. The letter shortcut can be disabled in settings; all actions also have standard controls.

## Growth experiment

**Grow your circle on X. Discover people who want to connect, with interests that fit yours.** The experiment is free; relevant follower growth is the purpose, without promising reach or follow-backs. Freshness is secondary.

Discovery is supplied by the service, shared across viewers. Authors do not need to join or request inclusion. The planned starting point is periodic #connect collection; its source and interval are still to be decided. There is no submission, approval or manual publishing flow in the app. Existing posts, people and private saves remain intact.

**Your profile & settings** accepts one public project link, with suggestions from URLs in the OAuth bio. Browser Run reads the page; Gemini drafts an editable description through the existing Cloudflare gateway. **Use this profile** adds the confirmed description to Jev alongside the untouched bio and any optional private sentence. Removing it returns to bio/context-only comparisons. Saved changes invalidate that viewer’s cached results.

Browser Run uses the native `BROWSER` binding, configured for the existing Cloudflare account and remote local development. Authenticate Wrangler before running locally. No Browser Run API token is needed. Reading is on demand, one page at a time; source descriptions are private. Production needs an explicit profile-build budget/rate policy before launch.

First-party D1 measurement stores each account’s first Keep and first app-owned link opening, first/last active UTC day, distinct active-day count, and optional usefulness response. Measurement remains internal with no public reporting endpoint. Repeated visits on the same UTC day and repeated actions do not create new conversions. These measurements start when this feature is used; existing history is not backfilled. They do not verify follows, replies or relationships. Preview use is not measured. No external analytics service is added.

## Production configuration and migrations

Before deployment, choose **SCAN_DAILY_LIMIT** (positive integer, global inference attempts per UTC day) and **SCAN_CACHE_TTL_SECONDS** (positive integer). Production builds pause scans when these are missing; no budget is invented. Set the daily limit to zero to pause inference. These are request limits, not a dollar budget; gateway/provider limits still apply. Development remains unlimited by default and never reuses stored scan results.

Production cache keys include the native Jev request, rubric/interpretation version and username, and records are isolated by viewer and post. Every scan still revalidates oEmbed before reuse; removed/unavailable posts do not fall back to a cached answer. Only successful or insufficient-evidence results are stored. Changed bio/context/project/post input triggers a fresh scan. Each viewer/post keeps at most one record; expired records are ignored and replaced on the next scan (no scheduled purge). Concurrent cache misses can both reach inference, but the atomic daily reservation bounds total attempts. No distributed lock or background collector is added.

The repository is undeployed and has **one initial schema migration**, including application and auth tables. It installs into a fresh database with `npx void db migrate`. The existing local database was backed up, its one pre-existing foreign-key mismatch corrected, and its migration ledger rebased without deleting any application rows. Do not replay this baseline over an existing populated database with an old migration ledger. Once deployed, preserve that baseline and add forward migrations.

## Sign-in journey (`src/components/auth.tsx`)

| State | What you see |
| --- | --- |
| Signed out | *Continue with X* in the top bar goes straight to X. One line in the controls says it keeps future saves on your account. *Access details* (optional) separates what X asks for (`tweet.read`, `users.read`) from what hashtagconnect uses (name, username, photo, bio). |
| Handoff | "Opening X…" with a drawing cord. The tab redirects to X's own authorization page. |
| Returning | Back at `/?auth=welcome`, a toast confirms who you're signed in as. Sandbox saves are not transferred. |
| Cancelled | `?error=access_denied`: "Cancelled. Nothing was shared." with *Try again*. |
| Error | Any other `?error=` code, including an expired or missing OAuth state (`onAPIError.errorURL` in `auth.ts`): *Try again* plus a reference code. |
| Signed in | The avatar menu shows the account name and photo, privacy settings and Sign out. |
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

X sign-in: create a confidential Web App in the X Developer Console with the callback `http://127.0.0.1:5173/api/auth/callback/twitter`, then set `AUTH_TWITTER_CLIENT_ID` and `AUTH_TWITTER_CLIENT_SECRET` in `.env`. Requested scopes are `tweet.read users.read`. Restart the dev server after changing auth config.

The current local OAuth setup has been tested with a real sign-in. The bio is collected in the same `/2/users/me` profile lookup and refreshed on subsequent sign-ins. Existing sessions without a captured bio offer *Refresh X bio*; an account with an empty X bio gets a separate explanation. Profile edits through Better Auth's `/update-user` endpoint are disabled. Scans use Better Auth's trusted provider account ID. For scans, configure the Cloudflare account, gateway and inference credentials from `env.example`; no X bearer token is needed. Local scans are uncapped by the app when SCAN_DAILY_LIMIT is omitted. Production requires an explicit positive cap and SCAN_CACHE_TTL_SECONDS before scans can run. A positive value caps attempts per UTC day across all users; zero pauses model calls. Provider limits still apply. Gateway request logging is enabled. Gateway caching stays off; the app reuses validated results only in production.

## Embed fixtures

For isolated browser comparisons, see [the standalone fixtures](fixtures/embeds/README.md). They include a URL-driven profile/post tester and bare Publish/factory HTML baselines, served independently of the app.

## API

| Route | Purpose |
| --- | --- |
| GET /api/discover | Shared pool plus the viewer's private post and person records |
| POST /api/import | Save a URL privately; only the URL is accepted |
| POST /api/decisions | Set save, skip or clear a choice by postId or personId |
| DELETE /api/decisions | Clear the viewer's choices and opened history |
| POST /api/opened | Record a click on an app-owned profile or fallback post link |
| POST /api/scan | Authenticated bio/context / oEmbed-post comparison through Jev |
| POST /api/context | Save or clear the viewer’s optional scan context |
| POST /api/project-preview | Authenticated Browser Run page read and Gemini profile draft; no persistence |
| POST /api/project | Save or remove the authenticated viewer’s confirmed project description |
| POST /api/activity | Record an active UTC day or optional usefulness feedback |

## Shared-pool data

Trusted operators and collectors write directly to D1 using its native binding, Wrangler or Cloudflare's D1 API. The app reads the shared pool independently of how posts were collected. There is no ingestion endpoint, ingestion token or custom import script. Writers normalize post URLs, deduplicate by post ID and preserve existing author links, tags and viewer state when upserting.

## Proposed, for discussion (not built)

1. **Hashtag collection.** Service-owned discovery is the agreed direction. Collection transport and polling interval remain undecided; no collection job or paid X search has been enabled.
2. **Sandbox to account.** Optionally offer to import sandbox saves after sign-in. Today they aren't transferred.
3. **Publication time.** Storing each post's creation time would allow honest freshness sorting. Today "added" is when the post entered the local database.

Not deployed. The OAuth-bio / oEmbed-post path has been verified end to end in Personal Chrome through the existing momentium gateway, using the signed-in user's real bio and a seeded post. Signed-in browsing now automatically requests a comparison for the current post. Guest browsing and the fictional demo never call Jev.

Known local issue: the first official embed can time out even for an available post; **Try again** has rendered it successfully. The container layout is independent of this unresolved widget initialization issue.

Profile timelines are excluded from the app for now. The scan and invitation stay visible together, with Pass / Keep alongside. Standalone timeline fixtures remain available for diagnosis; on 26 October the SDK’s timeline URL returned **Rate limit exceeded** in Chrome, and the plain-widget test and X Publish preview also failed.

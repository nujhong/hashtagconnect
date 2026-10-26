# Profile scan

Updated 26 October 2026. The scan compares the signed-in user's X bio with one selected connect post. It uses official OAuth and oEmbed, then Jev through the existing **momentium** Cloudflare AI Gateway. There are no timeline API calls, app-only X credentials or manual interests. Profile timelines are excluded from the app; standalone fixtures remain available for diagnosis.

## What it answers

Jev evaluates one native Score question: how directly this invitation relates to the work, skills or interests actually stated in the bio. Its four descriptive levels cover no supported connection, broad related context, clear topical relevance, and specific direct alignment. One strong shared interest is sufficient for the top level; topic count is not the criterion. The 0–3 result is normalized to 0–100 for display.

Four Noul questions are evaluated separately in the same request: whether the bio has usable detail, whether the invitation has usable detail, explicit shared interest, and related work. The last two appear as probabilities directly below the rating. They are not averaged into the headline rating, and confidence never multiplies or reduces it.

This is a text comparison. A bio and one invitation cannot establish bot status, identity, trustworthiness or whether someone will reply.

## Request flow

1. X sign-in requests `profile_image_url,description` in the existing `/2/users/me` lookup. Better Auth's native user-info hook stores the bio and username, preserving its native placeholder email and provider identity. Scopes remain `tweet.read users.read`.
2. Better Auth refreshes these fields on later sign-ins. Its field input filtering also applies to provider data, so the fields accept OAuth mapping while the native `/update-user` endpoint is disabled. The app does not offer editable interests. A missing captured bio prompts a sign-in refresh; an actually empty bio gets a distinct state.
3. A signed-in member views a post they can access. After 250 ms for navigation to settle, the client automatically requests its scan. The server uses their session bio and verifies their linked X provider identity. Client-submitted bio or interests are never used. Missing bio or model setup returns before reserving an attempt.
4. The server atomically counts each attempt. SCAN_DAILY_LIMIT is optional: absent means no app cap; a positive value enforces a shared UTC-day cap in that same reservation; zero pauses scans. Failed attempts count. Provider limits still apply. The setting limits requests, not dollars, and can be configured at deployment.
5. One unauthenticated request to `publish.x.com/oembed` obtains the selected post's fallback HTML. The ID-only `twitter.com/i/status/{id}` form works with oEmbed; `x.com/i/web/status/{id}` returned 404 for the same available post in a live check. Scripts and thread context are omitted.
6. Jev receives only the viewer bio and this text-bearing markup as inert evidence. It reads the post paragraph and ignores HTML, attribution and dates. The app neither executes this HTML nor injects it into its UI; there is no rendered-iframe extraction or headless browser.
7. Cloudflare's native `POST /accounts/{account}/ai/run` invokes `typesafe/jev` using `input.state`, one Score question and four Noul questions. Gateway request logging is explicitly enabled for these requests; caching stays disabled. Third-party inference uses Unified Billing.
8. The server validates the completed result and builds source references from the supplied data. Post HTML and scan results are not stored in the app database. The rating, supporting signals, evidence checks, uncertainty, viewer bio and source post reference return with a successful comparison; the post HTML stays server-side.

Display rules are explicit prototype choices: if either usable-detail Noul is at most 0.3, return missing information without a rating. Otherwise retain the rating and mark it Tentative when Score confidence is below 0.6 or either detail Noul is below 0.7. A low relevance score can be a certain result. These cutoffs have not been calibrated for recommendation accuracy; they need evaluation across varied bios and invitations. [TypeSafe Score](https://docs.typesafe.ai/primitives/score), [Noul](https://docs.typesafe.ai/primitives/noul), [confidence](https://docs.typesafe.ai/confidence).

Deleted/unavailable posts fail the oEmbed request rather than falling back to paid lookups. Profile URL oEmbed returns a timeline-link snippet, not the profile's bio or timeline post data.

## Interface and privacy

The scan appears automatically in a full-width row above the original post and decisions on desktop, and above the post on mobile. The control slab keeps its queue context and Pass/Keep actions. The violet rating leads; the configured shared app limit uses neutral utility text beside Stash in the header. It shows the configured cap, not remaining credits. Both supporting Noul probabilities are vertically stacked and visible without expanding anything; the overall rating remains a separate Jev Score judgment, not an average. Sources reveals the exact viewer bio and source link. Methodology and provider logging are consolidated under Scoring & privacy in Settings. Gateway operators can inspect request and result logs; the app database retains neither post HTML nor scan results. The rating is a position on the text-relevance rubric, not a compatibility probability.

The original invitation stays visible below its scan. There are no profile-history tabs or expandable timelines in the app. The standalone fixtures retain X’s official timeline markup and factory calls for isolated browser tests; timeline contents are never extracted or passed to Jev.

Only the current post is scanned; there is no pool prefetch. Navigating away cancels the settling timer or aborts the pending client request, and late responses cannot replace the next post's result. Client cancellation cannot guarantee that inference already accepted by the provider stops or avoids a charge. The timer also prevents React's development effect replay from sending duplicate requests. There is no result cache: returning to a post or refreshing starts a new request. Service and quota errors pause automatic scanning across subsequent posts for that page visit until the user retries; there is no retry loop or automatic credit purchase. A post-specific oEmbed failure does not prevent trying the next post. The app reports a configured daily cap, not an invented credit balance. Scans never steal focus or open a dialog. The demo uses the same result view with explicit fictional labels.

The page and API share readiness checks. Browser props contain status and an explanation, never provider credentials. Signing out, signing in with a different account, unavailable providers, missing data and a used daily allowance do not substitute fictional results. The separate demo is explicitly fictional and makes no network calls.

## Verification and local setup

- Native Better Auth sign-in and repeat-sign-in tests verify bio persistence, refresh, stable account identity and rejection of direct profile edits with stubbed X responses.
- Live OAuth collected the personal account's bio. An end-to-end scan in Personal Chrome compared that bio with a real curated connect post and displayed a tentative connection through the existing momentium gateway. No user bio or saved-person record was replaced.
- The original Choice design confused category uncertainty with missing evidence. The Score/Noul design now tests relevance, evidence availability and supporting signals separately; regression tests verify that uncertainty does not discard a supported rating or change its value.
- A bounded live gateway test of the new five-question request succeeded using the previously captured bio and oEmbed evidence. It returned a valid Jev 1.13.0 Score and four Noul answers without any new X API or timeline request.
- Tests verify one unauthenticated oEmbed read, no timeline calls, no inference with missing inputs, typed probability validation, uncertain versus insufficient results and sanitized provider failures.
- Automatic-scan lifecycle tests cover development effect replay, rapid navigation, aborting and ignoring stale requests, and fresh requests when returning to the same post. Provider-limit responses explicitly pause automatic scans.
- The 26 October timeline check failed in the app, a plain official-widget page in Chrome, and X Publish's own preview. Opening the exact timeline URL generated by X's SDK in Chrome returned `Rate limit exceeded`. The SDK initialized and inserted its iframe but never completed rendering. This verifies a rate-limited request in this environment, not retirement of profile timelines. X's [September 2022 parameter update](https://devcommunity.x.com/t/embedded-timelines-update-parameters-support/177112) concerns styling and live updates; it is not evidence of current service availability. The cross-origin widget does not expose its HTTP status to the host page. Profile timelines were subsequently removed from the app; the fixtures preserve the reproduction.

The Cloudflare inference token needs AI Gateway Run and Workers AI Read for the universal inference endpoint. OAuth uses the existing X client credentials. No new gateway, credit purchase or X bearer token is involved. Restart the dev server after auth or credential changes and apply the included local database migration.

## References and scope

[X user lookup](https://docs.x.com/x-api/users/get-my-user), [official oEmbed](https://docs.x.com/x-for-websites/oembed-api), [Cloudflare Jev](https://developers.cloudflare.com/ai/models/typesafe/jev/), [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/).

X documents oEmbed as an embedding interface. Its documentation does not explicitly settle permission for this inference use; technical success is not confirmation of policy approval. The owner selected this prototype approach after that distinction was discussed. Deployment and expanded collection remain separate decisions. [X Developer Agreement](https://docs.x.com/developer-terms/agreement)

The “On hashtagconnect” badge comes from the app database: a case-insensitive match against the last OAuth username with its corresponding linked X account ID. It makes no X API request and is not a Jev input or score boost. Handles can become stale between sign-ins; this is membership information, not a live-presence or identity-verification claim.

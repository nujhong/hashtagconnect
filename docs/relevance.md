# Profile scans

Scans help a signed-in member understand what they have in common with the person behind a #connect post.

## Inputs

- **Your profile:** the bio supplied by X OAuth, optional personal context, and a saved project description and topics.
- **Their post:** text from official oEmbed and a Browser Run measurement of the official widget.

The first successful X sign-in queues an import of the first valid project link in the bio. Browser Run reads the page and Cloudflare-hosted Gemma creates the project context. The job runs independently of the browser; users can review, edit or remove its result in Settings. Existing context is preserved on later sign-ins.

## Analysis

`POST /api/scans` checks the session and post access, loads the viewer’s saved context, and fetches current oEmbed evidence.

1. Clef compares the profile with the post. A Score supplies overall relevance; separate Noul questions assess shared interests, related work and project fit. A Choice selects the short explanation. Profile phrases and project topics are checked for concrete overlap.
2. Browser Run renders a 550px light-theme embed while the text request runs. Cloudflare’s Puppeteer library reads text ranges inside the official frame to measure visible body lines.
3. A second Clef request selects a measured line for each of up to three strong connections. Native Choice includes a `none` option; Noul independently checks presence. Coordinates come from the browser, not the model.

Clef runs through Cloudflare AI Gateway using the native Cloudflare inference endpoint. Both Clef and project summarization use one `CLOUDFLARE_AI_GATEWAY_TOKEN` in the `Authorization` header, with Workers AI Read and AI Gateway Run permissions. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_GATEWAY_ID` select the account and gateway. Clef-flash uses its model-specific Workers AI endpoint with native state and questions; it does not support Jev’s box type. Layout or line-selection failure preserves the text result.

## Display

The overall rating is Clef’s independent relevance judgment, not an average of the supporting signals. Project fit stays visible without a project, with a dash instead of a value. Insufficient detail receives no rating; uncertain evidence is marked Tentative.

Evidence cards quote the viewer’s own phrases. Highlights require supported text and line evidence and matching layout geometry. Low-confidence line matches use approximate styling. These thresholds are prototype choices, not calibrated accuracy guarantees.

## Saved results

Each viewer/post pair keeps one result with no time-based expiry. Matching inputs reuse it in development and production. The hash includes the model, bio, context, project, post text and analysis version; changed inputs trigger fresh analysis. oEmbed is revalidated before reuse, so unavailable posts do not return stale evidence. Saving profile context invalidates that viewer’s saved results. Failures are not cached.

Browser Run has a shared allowance of 5,000 calls per UTC calendar month, reserved atomically in D1 before embed measurements or project reads. Failed calls count; database failure blocks browser work. At US$0.09/hour, budgeting one minute per call gives US$7.50 before shared free hours against a US$10 target. Embed rendering and selector waits are bounded, and every acquired browser session closes in a `finally` block. Project reads retain their existing timeouts. This is a conservative app allowance, not a provider-enforced dollar cap; revisit it if pricing or action timeouts change. All new Browser Run callers must reserve first. Cached scans use no allowance. When exhausted, scans continue with text-only Clef results and project reads pause until the next month.

Clef has no app-level quota; its provider limits are separate. Post ingestion is manual and independent of analysis.

Discovery expires ordinary posts seven days after the creation time encoded in their X ID, spanning fourteen planned 12-hour ingestion cycles. Adjust `DISCOVERY_RETENTION_DAYS` to change the window. The pinned introduction remains eligible until withdrawn. Expiry is applied whenever discovery is loaded: expired posts are absent from the shared pool, while Stash, guest choices, saved results and author relationships remain intact. No rows are deleted or rewritten; re-ingesting a URL cannot renew its age. Already-open pages receive the updated pool on their next discovery load.

Post HTML and rendered pages are not stored in D1. Gateway caching, request logging and Logpush are disabled in the personal deployment. Project context and scan results are private to the viewer. Membership badges come from linked app accounts and are separate from the relevance score.

## Verification

```sh
pnpm run check
pnpm test
pnpm run build
```

Tests cover OAuth bio persistence, queued imports, context changes, native Clef request shapes, unsupported line selections, browser cleanup, layout failures, cache keys and automatic-scan lifecycle behavior. Network-dependent tests use mocked responses; they do not establish live model accuracy.

## References

- [Clef-flash on Workers AI](https://developers.cloudflare.com/workers-ai/models/clef-flash/): Jev-style Score, Choice and Noul decisions; Cloudflare’s model, not a TypeSafe model
- [Gemma on Workers AI](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/): project-summary generation
- [Workers AI pricing and daily allowance](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Browser Run / Puppeteer](https://developers.cloudflare.com/browser-run/puppeteer/)
- [X oEmbed](https://docs.x.com/x-for-websites/oembed-api)

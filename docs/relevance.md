# Profile scans

Scans help a signed-in member understand what they have in common with the person behind a #connect post.

## Inputs

- **Your profile:** the bio supplied by X OAuth, optional personal context, and a saved project description and topics.
- **Their post:** text from official oEmbed and a Browser Run capture of the official widget.

The first successful X sign-in queues an import of the first valid project link in the bio. Browser Run reads the page and Gemini creates the project context. The job runs independently of the browser; users can review, edit or remove its result in Settings. Existing context is preserved on later sign-ins.

## Analysis

`POST /api/scans` checks the session and post access, loads the viewer’s saved context, and fetches current oEmbed evidence.

1. Jev compares the profile with the post. A Score supplies overall relevance; separate Noul questions assess shared interests, related work and project fit. A Choice selects the short explanation. Profile phrases and project topics are checked for concrete overlap.
2. Browser Run captures a 550px light-theme embed while the text request runs.
3. If the text result and capture succeed, a second Jev request locates up to three strong connections in the image. The image must be the first state field; putting text first caused misplaced boxes in localization experiments.

Jev runs through Cloudflare AI Gateway using the native Cloudflare inference endpoint. Both Jev and project summarization use one `CLOUDFLARE_AI_GATEWAY_TOKEN` in the `Authorization` header, with Workers AI Read and AI Gateway Run permissions. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_GATEWAY_ID` select the account and gateway. Image requests include the required experimental image header. Capture or localization failure preserves the text result.

## Display

The overall rating is Jev’s independent relevance judgment, not an average of the supporting signals. Project fit stays visible without a project, with a dash instead of a value. Insufficient detail receives no rating; uncertain evidence is marked Tentative.

Evidence cards quote the viewer’s own phrases. Highlights require supported text and image evidence and matching capture geometry. Low-confidence locations use approximate styling. These thresholds are prototype choices, not calibrated accuracy guarantees.

## Saved results

Each viewer/post pair keeps one result with no time-based expiry. Matching inputs reuse it in development and production. The hash includes the model, bio, context, project, post text and analysis version; changed inputs trigger fresh analysis. oEmbed is revalidated before reuse, so unavailable posts do not return stale evidence. Saving profile context invalidates that viewer’s saved results. Failures are not cached.

Browser Run has a shared allowance of 5,000 calls per UTC calendar month, reserved atomically in D1 before screenshots or project reads. Failed calls count; database failure blocks browser work. At US$0.09/hour, budgeting one minute per call gives US$7.50 before shared free hours against a US$10 target. Screenshot stage timeouts total 42 seconds and project reads total 20 seconds. This is a conservative app allowance, not a provider-enforced dollar cap; revisit it if pricing or action timeouts change. All new Browser Run callers must reserve first. Cached scans use no allowance. When exhausted, scans continue with text-only Jev results and project reads pause until the next month.

Jev has no app-level quota; its provider limits are separate. Post ingestion is manual and independent of analysis.

Post HTML and screenshots are not stored in D1. Gateway request logging is enabled; provider logs can contain model inputs and outputs. Project context and scan results are private to the viewer. Membership badges come from linked app accounts and are separate from the relevance score.

## Verification

```sh
pnpm run check
pnpm test
pnpm run build
```

Tests cover OAuth bio persistence, queued imports, context changes, native Jev request shapes, image ordering, invalid coordinates, capture failures, cache keys and automatic-scan lifecycle behavior. Network-dependent tests use mocked responses; they do not establish live model accuracy.

## References

- [Jev on Cloudflare](https://developers.cloudflare.com/ai/models/typesafe/jev-1.14.0/)
- [TypeSafe Score](https://docs.typesafe.ai/primitives/score), [Choice](https://docs.typesafe.ai/primitives/choice), [Noul](https://docs.typesafe.ai/primitives/noul) and [images](https://docs.typesafe.ai/images)
- [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/)
- [X oEmbed](https://docs.x.com/x-for-websites/oembed-api)

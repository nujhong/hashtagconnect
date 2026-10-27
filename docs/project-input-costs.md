# Screenshot versus prepared project context

Measured 27 October 2026. Research only; the application still uses Browser Run Markdown, a confirmed project summary, and Jev scans.

## Result

A screenshot can be cheaper for a one-off evaluation than preparing a summary. Reusing a compact saved summary wins for repeated scans. In this example, the one-time summary build paid for itself after six comparisons against screenshot input, or three against raw Markdown. These are workload-specific measurements, not universal thresholds.

## Capability and rates

Jev accepts experimental PNG/JPEG assets, including in state. They require the `TypeSafe-Danger-Zone-Images: true` header. Image tokens have the same input price as text; the response reports their usage, but TypeSafe does not yet publish a token-estimation formula. Images must be 280–1568 pixels on each side. [TypeSafe image documentation](https://docs.typesafe.ai/images).

Our existing Cloudflare universal endpoint and momentium gateway successfully accepted JSON `input.assets`, an image reference in state, and that HTTP header. The completed response identified the model as `jev-1.13.0`. No direct TypeSafe account or new credential was needed. This verifies the tested request, not every image feature.

Cloudflare lists Jev at $0.042 per million input tokens with free output, and Gemini 2.5 Flash Lite at $0.10 per million input tokens and $0.40 per million output tokens. [Jev pricing](https://developers.cloudflare.com/ai/models/typesafe/jev/), [Gemini pricing](https://developers.cloudflare.com/ai/models/google/gemini-2.5-flash-lite/).

## Measured comparison

The public Kepler homepage was the sample because it was the project link involved in the preceding bug report. It is not a required project or a special case in the app.

Each Jev request used the same simple Choice question about the project's purpose. All selected the correct category. These are total input-token counts for that benchmark request, not the app's full multi-question scan:

| Input | Jev input tokens | Model cost per request | Model cost for 1,000 requests |
| --- | ---: | ---: | ---: |
| 1280 × 720 viewport screenshot | 2,795 | $0.000117390 | $0.117390 |
| Browser Run Markdown, with the app's 20,000-character cap | 4,523 | $0.000189966 | $0.189966 |
| Confirmed-style summary produced by the existing profile builder | 429 | $0.000018018 | $0.018018 |
| Browser DOM body text, for comparison | 1,168 | $0.000049056 | $0.049056 |

The existing builder successfully produced a 287-character project description from Browser Run Markdown. Gemini reported 4,584 input tokens and 111 output tokens: **$0.0005028 once per profile build**. The summary was benchmarked as Jev state; it was not saved to anyone's profile.

For the same profile reused across 1,000 comparisons, summary building plus Jev costs **$0.0185208**, versus **$0.117390** for a saved screenshot sent each time. This does not assume 1,000 separate profiles can share one build.

The break-even calculation is `ceil(build cost / (screenshot cost per scan − summary cost per scan))`, giving six comparisons. Using raw Markdown instead gives three. Rebuilding a profile repeatedly or retrying failed builds changes that result. An earlier exploratory run using DOM text failed the builder's source-excerpt validation; the successful native Markdown build is the one priced above. Failed model requests can still consume usage.

## Capture and measurement limits

Browser Run Markdown and snapshot are Quick Actions with the same browser-time tariff. Workers Paid includes 10 browser hours monthly, then $0.09/hour; actual time, rather than endpoint name, determines cost. Snapshot can return HTML, screenshot, Markdown and accessibility-tree formats in one request. [Browser pricing](https://developers.cloudflare.com/browser-run/pricing/), [snapshot formats](https://developers.cloudflare.com/browser-run/quick-actions/snapshot/).

Prices above are USD model charges before browser time, hosting, storage, taxes or gateway-credit purchase fees. Unified Billing documents a 5% credit purchase fee. [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/).

The screenshot covers the viewport; Markdown and DOM text cover more of the page. This is not an equal-content accuracy benchmark, nor proof that a screenshot preserves every detail needed for relevance. No X profile or timeline was captured. Both saved screenshot and saved summary scenarios assume capture once and reuse; taking a new screenshot for every scan would add repeated browser cost.

## Recommendation

Keep the saved summary for repeated matching. A screenshot is a viable experimental input for a one-off assessment or a page whose useful information is visual. Raw readable text is another viable no-summary path, and was cheaper than the screenshot in the DOM-text probe. Choose based on useful evidence and reuse, not an assumption that images are always more expensive. No production flow was changed for this research.

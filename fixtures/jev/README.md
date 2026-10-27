# Jev Box proof — 27 October 2026

Two real requests through the existing Cloudflare momentium gateway used `typesafe/jev-1.14.0`, each containing the post screenshot and four questions: presence and bounding box for each of two example profiles. These are historical isolated experiments; the integrated scan now adds candidates to its normal output.

Public source post: https://x.com/Qazeem48515/status/2114541736676524485

Profiles:
- Positive: “I build AI tools.” The post explicitly lists “AI Tools”.
- Negative: “I make ceramic bowls and teach wheel throwing.” No matching phrase appears.

| Capture | Positive presence | Box confidence | Negative presence | Input tokens |
| --- | --- | --- | --- | --- |
| 550 × 536 | 0.90 | 0.98 | 0.01 | 1370 |
| 320 × 493 | 0.85 | 0.80 | 0.01 | 1003 |

Wide box: top .35, bottom .42, left .04, right .21. Converted to image pixels: x22–115.5, y187.6–225.1.
Narrow box: top .34, bottom .44, left .05, right .27. Converted to image pixels: x16–86.4, y167.6–216.9.

Visual inspection: both boxes contain the relevant AI Tools text, but are not tight word-level boxes. The wide box extends into the following line; the narrow box spans portions of neighboring lines. The reported confidence is not measured coordinate accuracy. This proves capability on one post at two render sizes, not general reliability.

Box still returns coordinates for the negative profile. A separate presence question is necessary to suppress unsupported highlights. Both question types were included in the same request.

At the documented $0.042 per million input tokens, the model input cost was $0.00005754 and $0.000042126 respectively. Output was 74 tokens each, priced free. Browser capture costs are separate. These requests include two example profiles, not a full production scan benchmark.

## Integrated flow

The implementation now lives in the normal scan path: `capturePostImage` uses the existing Browser Run binding, `jevInput` includes the screenshot and Box/presence questions beside the existing scores and Choice explanation, and `scanFromAnswers` returns `boxes` plus `boxImage` metadata. There is no standalone proof command and no overlay UI.

These files preserve the original two-profile experiments: [wide response](result-550.json), [narrow response](result-320.json), [wide screenshot](post-550.jpg), [narrow screenshot](post-320.jpg). The old [single-profile response](cli-result-550.json) remains evidence from the experiment, not the current API response shape.

Run `npm test` for offline tests of the integrated request, response validation, capture and fallback behavior.

References:
- https://developers.cloudflare.com/ai/models/typesafe/jev-1.14.0/
- https://docs.typesafe.ai/primitives/box

The normal scan now captures the official widget server-side. Further overlay work still needs coordinates corresponding to the exact displayed render.

The preserved single-profile CLI was also verified live on 27 October 2026: [response](cli-result-550.json), presence 0.96, box confidence 0.98, 1,225 input tokens and 36 free output tokens. This confirms the reusable command runs through the configured gateway; it does not establish general localization accuracy.

## Live integrated check

The ordinary evaluator was tested with a fresh Browser Run capture and live oEmbed evidence on 27 October 2026: [scan response](integrated-scan.json), [captured post](integrated-post.png). One Jev request returned the existing score, Choice explanation and supporting signals together with two native candidate boxes. The combined request gave low localization confidence (0.36 and 0.21), and the coordinates missed the precise AI Tools line. This verifies the output plumbing, not reliable highlighting. The API retains these confidence/presence values rather than silently converting candidates into confident highlights.

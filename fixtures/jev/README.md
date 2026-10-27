# Jev Box proof — 27 October 2026

Two real requests through the existing Cloudflare momentium gateway used `typesafe/jev-1.14.0`, each containing the post screenshot and four questions: presence and bounding box for each of two example profiles. The app UI and production scan are unchanged.

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

## Run the preserved flow

From the repository root, with the existing Cloudflare variables in `.env` or the environment:

```sh
npm run proof:jev -- fixtures/jev/post-550.jpg "I build AI tools."
npm run proof:jev -- fixtures/jev/post-320.jpg "I make ceramic bowls and teach wheel throwing."
```

Each invocation sends one screenshot and one profile to the configured gateway, with Noul presence and Box questions in the same request, and prints the native result JSON. Gateway logging is enabled, caching disabled. Running it incurs inference usage; it does not take screenshots or call X. Capture the actual rendered post separately. Image sides must be within Jev's documented 280–1568 range.

The saved results tested both profiles in a single request. The reusable script tests one supplied profile at a time and includes an explicit instruction to treat source content as evidence. It does not invent pixel precision or hide low-presence boxes in the raw output. The native app scan still lives in `src/server/jev.ts` and continues to use bio/project + oEmbed text.

Raw responses: [wide](result-550.json) and [narrow](result-320.json). Source screenshots: [wide](post-550.jpg) and [narrow](post-320.jpg). The result files also retain the original browser geometry; box coordinates are relative to the isolated screenshot, not the full browser viewport.

`npm test` checks the saved fixture and request flow without network calls or credentials.

References:
- https://developers.cloudflare.com/ai/models/typesafe/jev-1.14.0/
- https://docs.typesafe.ai/primitives/box

No automatic screenshot pipeline or product overlay was integrated. Further overlay work would need coordinates corresponding to the exact displayed render.

The preserved single-profile CLI was also verified live on 27 October 2026: [response](cli-result-550.json), presence 0.96, box confidence 0.98, 1,225 input tokens and 36 free output tokens. This confirms the reusable command runs through the configured gateway; it does not establish general localization accuracy.

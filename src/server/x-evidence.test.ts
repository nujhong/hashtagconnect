import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { loadPublicEvidence } from "./x-evidence.ts";
import type { ScanEvidence } from "~/src/scan-contract.ts";
const evidence: ScanEvidence = {
  viewer: { bio: "Building desktop apps and design tools.", username: "viewer" },
  post: {
    id: "1234",
    html: '<blockquote class="twitter-tweet"><p>Building design tools &amp; looking for desktop developers! #connect</p>— A person</blockquote>',
  },
};

test("evidence makes exactly one unauthenticated oEmbed request and no X API reads", async () => {
  let calls = 0;
  const result = await loadPublicEvidence(
    evidence.post.id,
    evidence.viewer,
    async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://publish.x.com");
      assert.equal(url.pathname, "/oembed");
      assert.equal(url.searchParams.get("url"), "https://twitter.com/i/status/1234");
      assert.equal(url.searchParams.get("omit_script"), "true");
      assert.equal(url.searchParams.get("hide_thread"), "true");
      assert.equal(new Headers(init?.headers).has("Authorization"), false);
      return Response.json({ html: evidence.post.html, type: "rich" });
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, evidence);
});

test("unavailable or malformed embeds and arbitrary URLs cannot reach the evaluator", async () => {
  await assert.rejects(
    loadPublicEvidence("https://evil.example", evidence.viewer, async () => {
      throw new Error("must not fetch");
    }),
    /invalid_format/,
  );
  await assert.rejects(
    loadPublicEvidence(
      "1234",
      evidence.viewer,
      async () => new Response("private diagnostics", { status: 404 }),
    ),
    /removed or made private/,
  );
  await assert.rejects(
    loadPublicEvidence("1234", evidence.viewer, async () =>
      Response.json({ html: "", type: "rich" }),
    ),
    /incomplete post embed/,
  );
});

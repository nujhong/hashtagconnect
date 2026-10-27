import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { buildProjectProfile, expandShortLink } from "./project-profile.ts";
const config = {
  accountId: "a",
  gatewayId: "g",
  apiToken: "test-ai",
};
const page =
  "# Wheelhouse\nWheelhouse helps ceramic artists organize workshops and share kiln schedules. It is designed for community pottery studios.";
const excerpt = "Wheelhouse helps ceramic artists organize workshops and share kiln schedules.";
const summary = "A project for ceramic artists to organize workshops and share kiln schedules.";
const modelResponse = (draft: unknown, finishReason = "STOP") =>
  Response.json({
    success: true,
    result: {
      candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason }],
    },
  });

test("one native Browser Run read creates a bounded, source-backed preview through the gateway", async () => {
  let reads = 0,
    calls = 0;
  const draft = await buildProjectProfile(
    {
      quickAction: async (action: string, options: unknown) => {
        reads++;
        assert.equal(action, "markdown");
        assert.ok(options && typeof options === "object" && "url" in options);
        assert.equal(options.url, "https://wheelhouse.example/");
        return Response.json({ success: true, result: page + "x".repeat(30_000) });
      },
    },
    config,
    "https://wheelhouse.example",
    async (url, init) => {
      calls++;
      assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/a/ai/run");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "google/gemini-2.5-flash-lite");
      assert.equal(JSON.parse(body.input.contents[0].parts[0].text).page.length, 20_000);
      assert.equal(body.input.generationConfig.responseMimeType, "application/json");
      assert.equal(new Headers(init?.headers).get("cf-aig-gateway-id"), "g");
      return modelResponse({
        summary,
        excerpt,
        topics: ["ceramic workshops", "kiln schedules", "kiln schedules", " ", "x".repeat(80)],
      });
    },
  );
  assert.equal(reads, 1);
  assert.equal(calls, 1);
  assert.deepEqual(draft, {
    url: "https://wheelhouse.example/",
    summary,
    excerpt,
    topics: ["ceramic workshops", "kiln schedules"],
  });
});

test("failed or empty page reads do not call a model", async () => {
  for (const response of [
    new Response("private diagnostics", { status: 503 }),
    Response.json({ success: true, result: "" }),
  ]) {
    await assert.rejects(
      buildProjectProfile(
        { quickAction: async () => response },
        config,
        "https://example.com",
        async () => {
          assert.fail("No inference without readable evidence");
        },
      ),
      /Couldn’t read|enough readable/,
    );
  }
});

test("invented excerpts, empty descriptions, truncated and malformed generations cannot become a profile", async () => {
  for (const response of [
    modelResponse({ summary, excerpt: "A fabricated claim that was not in the supplied page." }),
    modelResponse({ summary: "", excerpt: "" }),
    modelResponse({ summary, excerpt }, "MAX_TOKENS"),
    Response.json({ success: false }),
    new Response("token private diagnostics", { status: 403 }),
  ]) {
    await assert.rejects(
      buildProjectProfile(
        { quickAction: async () => Response.json({ success: true, result: page }) },
        config,
        "https://example.com",
        async () => response,
      ),
      (error: Error) =>
        !error.message.includes("token") && /detail|finish|unavailable/.test(error.message),
    );
  }
});

test("oversized rendered output is stopped before inference", async () => {
  await assert.rejects(
    buildProjectProfile(
      { quickAction: async () => Response.json({ success: true, result: "x".repeat(512_001) }) },
      config,
      "https://example.com",
      async () => {
        assert.fail("No model call for oversized content");
      },
    ),
    /too large/,
  );
});

test("t.co bio links are saved as their destination, which must still be a public project page", async () => {
  const hop = (location: string) => async () =>
    new Response(null, { status: 301, headers: { location } });
  assert.equal(
    await expandShortLink("https://t.co/abc", hop("https://kepler.example/app")),
    "https://kepler.example/app",
  );
  assert.equal(
    await expandShortLink("https://example.com/", async () => {
      throw new Error("No request for ordinary links");
    }),
    "https://example.com/",
  );
  await assert.rejects(
    expandShortLink("https://t.co/abc", hop("https://x.com/someone")),
    /leads to X/,
  );
  assert.equal(
    await expandShortLink("https://t.co/abc", async () => {
      throw new Error("offline");
    }),
    "https://t.co/abc",
  );
});

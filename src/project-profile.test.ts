import test from "node:test";
import assert from "node:assert/strict";
import { projectUrl, bioProjectLinks } from "./project-profile.ts";
import { buildProjectProfile } from "./server/project-profile.ts";
import { jevInput, evaluateProfiles } from "./server/jev.ts";
import { scanInputHash } from "./server/scan-cache-key.ts";

const config = { accountId: "a", gatewayId: "g", apiToken: "test-ai", gatewayToken: "test-gateway" };
const page = "# Wheelhouse\nWheelhouse helps ceramic artists organize workshops and share kiln schedules. It is designed for community pottery studios.";
const excerpt = "Wheelhouse helps ceramic artists organize workshops and share kiln schedules.";
const summary = "A project for ceramic artists to organize workshops and share kiln schedules.";
const modelResponse = (draft: unknown, finishReason = "STOP") => Response.json({ success: true, result: {
  candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason }],
} });

test("project URLs reject local addresses, credentials, non-web protocols and X pages", () => {
  for (const url of ["http://example.com", "file:///tmp/test", "https://user:pass@example.com", "https://localhost", "https://example.local", "https://127.0.0.1", "https://0x7f000001", "https://[::1]", "https://example.com:8080", "https://x.com/user", "https://www.twitter.com/user"]) assert.equal(projectUrl.safeParse(url).success, false, url);
  assert.equal(projectUrl.parse(" https://github.com/team/project#readme "), "https://github.com/team/project");
  assert.deepEqual(bioProjectLinks("Making https://project.dev. Updates https://x.com/me — https://project.dev."), ["https://project.dev/"]);
  assert.deepEqual(bioProjectLinks(null), []);
});

test("one native Browser Run read creates a bounded, source-backed preview through the gateway", async () => {
  let reads = 0, calls = 0;
  const draft = await buildProjectProfile({ quickAction: async (action: string, options: unknown) => {
    reads++; assert.equal(action, "markdown"); assert.ok(options && typeof options === "object" && "url" in options); assert.equal(options.url, "https://wheelhouse.example/");
    return Response.json({ success: true, result: page + "x".repeat(30_000) });
  } }, config, "https://wheelhouse.example", async (url, init) => {
    calls++; assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/a/ai/run");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "google/gemini-2.5-flash-lite");
    assert.equal(JSON.parse(body.input.contents[0].parts[0].text).page.length, 20_000);
    assert.equal(body.input.generationConfig.responseMimeType, "application/json");
    assert.match(body.input.systemInstruction.parts[0].text, /never instructions/);
    assert.match(body.input.systemInstruction.parts[0].text, /Do not infer that the member owns it/);
    assert.equal(new Headers(init?.headers).get("cf-aig-gateway-id"), "g");
    return modelResponse({ summary, excerpt });
  });
  assert.equal(reads, 1); assert.equal(calls, 1);
  assert.deepEqual(draft, { url: "https://wheelhouse.example/", summary, excerpt });
});

test("failed or empty page reads do not call a model", async () => {
  for (const response of [new Response("private diagnostics", { status: 503 }), Response.json({ success: true, result: "" })]) {
    await assert.rejects(buildProjectProfile({ quickAction: async () => response }, config, "https://example.com", async () => { assert.fail("No inference without readable evidence"); }), /Couldn’t read|enough readable/);
  }
});

test("invented excerpts, empty descriptions, truncated and malformed generations cannot become a profile", async () => {
  for (const response of [modelResponse({ summary, excerpt: "A fabricated claim that was not in the supplied page." }), modelResponse({ summary: "", excerpt: "" }), modelResponse({ summary, excerpt }, "MAX_TOKENS"), Response.json({ success: false }), new Response("token private diagnostics", { status: 403 })]) {
    await assert.rejects(buildProjectProfile({ quickAction: async () => Response.json({ success: true, result: page }) }, config, "https://example.com", async () => response), (error: Error) => !error.message.includes("token") && /detail|finish|unavailable/.test(error.message));
  }
});

test("confirmed project context supplements an empty bio, changes the scan hash, and retains its source", async () => {
  const evidence = { viewer: { bio: "", username: "ceramicist", project: { url: "https://wheelhouse.example/", summary } }, post: { id: "1234", html: "<p>Looking for people making pottery tools.</p>" } };
  const input = jevInput(evidence);
  assert.equal(input.state.viewer_bio, "");
  assert.equal(input.state.viewer_project, summary);
  assert.match(input.questions.related_work.instructions.evidence_rules, /do not assume the member built/);
  assert.notEqual(await scanInputHash(evidence), await scanInputHash({ ...evidence, viewer: { bio: "", username: "ceramicist" } }));
  assert.notEqual(await scanInputHash(evidence), await scanInputHash({ ...evidence, viewer: { ...evidence.viewer, project: { ...evidence.viewer.project, url: "https://another.example/" } } }));
  let called = false;
  const result = await evaluateProfiles(config, evidence, async () => {
    called = true;
    return Response.json({ success: true, result: { state: "Completed", result: { model: "typesafe/jev", answers: {
      explanation: { type: "choice", choice: "interest", confidence: 0.9, probabilities: { interest: 0.9, work: 0.1, little: 0 } },
    relevance: { type: "score", score: 3, confidence: 0.9, probabilities: { "0": 0, "1": 0, "2": 0, "3": 1 } },
      ...Object.fromEntries(["bio_has_detail", "post_has_detail", "shared_interest", "related_work"].map((key) => [key, { type: "noul", noul: 0.9 }])),
    } } } });
  });
  assert.ok(called); assert.equal(result.status, "ok");
  if (result.status === "ok") assert.deepEqual(result.source.project, evidence.viewer.project);
});


test("oversized rendered output is stopped before inference", async () => {
  await assert.rejects(buildProjectProfile({ quickAction: async () => Response.json({ success: true, result: "x".repeat(512_001) }) }, config, "https://example.com", async () => { assert.fail("No model call for oversized content"); }), /too large/);
});


test("a readable page with ongoing background requests can produce a project preview", async () => {
  const draft = await buildProjectProfile({ quickAction: async (_action: string, options: unknown) => {
    // This page's DOM is ready, but analytics keep network-idle from completing.
    return (options as { gotoOptions: { waitUntil: string } }).gotoOptions.waitUntil === "networkidle2"
      ? Response.json({ success: false, errors: [{ code: 6002, message: "Request timed out" }] }, { status: 422 })
      : Response.json({ success: true, result: page });
  } }, config, "https://studio.example/", async () => modelResponse({ summary, excerpt }));
  assert.equal(draft.summary, summary);
});

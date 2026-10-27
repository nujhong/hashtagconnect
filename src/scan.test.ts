import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProfiles, scanFromAnswers } from "./server/jev.ts";
import { loadPublicEvidence } from "./server/x-evidence.ts";
import { scanAvailability, scanSetup } from "./server/scan-setup.ts";
import { getXUserInfo } from "./server/x-oauth.ts";
import { createPlaceholderEmail } from "@better-auth/core/utils/email";
import type { ScanEvidence } from "./scan-contract.ts";

const evidence: ScanEvidence = {
  viewer: { bio: "Building desktop apps and design tools.", username: "viewer" },
  post: { id: "1234", html: '<blockquote class="twitter-tweet"><p>Building design tools &amp; looking for desktop developers! #connect</p>— A person</blockquote>' },
};
const config = { accountId: "test-account", gatewayId: "test-gateway", apiToken: "test-inference", gatewayToken: "test-gateway-token" };
const configured = {
  CLOUDFLARE_ACCOUNT_ID: config.accountId, CLOUDFLARE_GATEWAY_ID: config.gatewayId,
  CF_WORKERS_AI_TOKEN: config.apiToken, CF_AIG_TOKEN: config.gatewayToken, SCAN_DAILY_LIMIT: 3,
};

test("readiness needs model configuration and a bio, never an X bearer token", () => {
  assert.deepEqual(scanAvailability(configured), { status: "ready", dailyLimit: 3 });
  assert.deepEqual(scanAvailability(configured, evidence.viewer.bio), { status: "ready", dailyLimit: 3 });
  assert.equal(scanAvailability(configured, null).status, "needs_bio");
  assert.equal(scanAvailability(configured, "  ").status, "empty_bio");
  assert.equal(scanSetup({ ...configured, CF_WORKERS_AI_TOKEN: undefined }).status, "unavailable");
  assert.equal(scanSetup({ ...configured, SCAN_DAILY_LIMIT: 0 }).status, "unavailable");
  assert.equal(scanSetup({ ...configured, SCAN_DAILY_LIMIT: NaN }).status, "unavailable");
  const setup = scanSetup(configured);
  assert.equal(setup.status, "ready");
  if (setup.status === "ready") { assert.deepEqual(setup.jev, config); assert.equal(setup.dailyLimit, 3); }
  const unlimited = scanSetup({ ...configured, SCAN_DAILY_LIMIT: undefined });
  assert.equal(unlimited.status, "ready");
  if (unlimited.status === "ready") assert.equal(unlimited.dailyLimit, null);
});

test("OAuth collects the bio in one profile request and keeps the native account identity", async () => {
  let calls = 0;
  const result = await getXUserInfo({ accessToken: "oauth-test" }, async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.x.com");
    assert.equal(url.pathname, "/2/users/me");
    assert.equal(url.searchParams.get("user.fields"), "profile_image_url,description");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer oauth-test");
    return Response.json({ data: { id: "10", name: "Viewer", username: "viewer", description: evidence.viewer.bio } });
  });
  assert.equal(calls, 1);
  assert.equal(result?.user.xBio, evidence.viewer.bio);
  assert.equal(result?.data.data.id, "10");
  assert.equal(result?.user.email, createPlaceholderEmail({ identifier: "10", namespace: "twitter" }));
  assert.equal(result?.user.emailVerified, false);
});

test("empty OAuth bio is distinct from a sign-in that never collected it", async () => {
  const result = await getXUserInfo({ accessToken: "test" }, async () => Response.json({ data: { id: "10", name: "Viewer", username: "viewer" } }));
  assert.equal(result?.user.xBio, "");
  assert.equal(await getXUserInfo({}, async () => { throw new Error("must not fetch"); }), null);
  assert.equal(await getXUserInfo({ accessToken: "test" }, async () => new Response(null, { status: 401 })), null);
  assert.equal(await getXUserInfo({ accessToken: "test" }, async () => Response.json({ data: { name: "No identity" } })), null);
});

function answers(score = 2.4, confidence = 0.8) {
  return { model: "jev-test", answers: {
    explanation: { type: "choice", choice: "interest", confidence: 0.9, probabilities: { interest: 0.9, work: 0.1, little: 0 } },
    relevance: { type: "score", score, confidence, probabilities: { "0": 0, "1": 0, "2": 0.6, "3": 0.4 } },
    bio_has_detail: { type: "noul", noul: 0.98 }, post_has_detail: { type: "noul", noul: 0.97 },
    shared_interest: { type: "noul", noul: 0.8 }, related_work: { type: "noul", noul: 0.9 },
  } };
}

test("Jev receives only the OAuth bio and oEmbed markup through the native Cloudflare API", async () => {
  const result = await evaluateProfiles(config, evidence, async (url, init) => {
    assert.equal(String(url), "https://api.cloudflare.com/client/v4/accounts/test-account/ai/run");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-inference");
    assert.equal(headers.get("cf-aig-authorization"), "Bearer test-gateway-token");
    assert.equal(headers.get("cf-aig-gateway-id"), "test-gateway");
    assert.equal(headers.get("cf-aig-collect-log"), "true");
    assert.equal(headers.get("cf-aig-skip-cache"), "true");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "typesafe/jev-1.14.0");
    assert.deepEqual(body.input.state, { viewer_bio: evidence.viewer.bio, connect_post_html: evidence.post.html });
    assert.equal(body.input.questions.relevance.type, "score");
    assert.equal(body.input.questions.relevance.criteria.length, 4);
    assert.deepEqual(Object.keys(body.input.questions), ["relevance", "explanation", "bio_has_detail", "post_has_detail", "shared_interest", "related_work"]);
    for (const key of ["bio_has_detail", "post_has_detail", "shared_interest", "related_work"]) assert.equal(body.input.questions[key].type, "noul");
    return Response.json({ success: true, result: { state: "Completed", result: answers() } });
  });
  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    assert.equal(result.relevance, 80);
    assert.equal(result.tentative, false);
    assert.deepEqual(result.signals, { sharedInterest: 0.8, relatedWork: 0.9 });
    assert.deepEqual(result.source, { bio: evidence.viewer.bio, username: "viewer", postId: "1234" });
    assert.equal(JSON.stringify(result).includes(config.apiToken), false);
    assert.equal(JSON.stringify(result).includes(evidence.post.html), false);
  }
});

test("missing bio or post does not make a paid model request", async () => {
  let calls = 0;
  const request = async () => { calls++; return Response.json({}); };
  const noBio = await evaluateProfiles(config, { ...evidence, viewer: { ...evidence.viewer, bio: "" } }, request);
  const noPost = await evaluateProfiles(config, { ...evidence, post: { ...evidence.post, html: "" } }, request);
  assert.equal(noBio.status, "not_enough_data");
  assert.equal(noPost.status, "not_enough_data");
  assert.equal(calls, 0);
});

test("relevance is the native score rescaled, never multiplied by confidence or averaged with signals", () => {
  const raw = answers(2.4, 0.2);
  raw.answers.shared_interest.noul = 0.1;
  const result = scanFromAnswers(raw, evidence);
  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    assert.equal(result.relevance, 80);
    assert.equal(result.tentative, true);
    assert.equal(result.signals.sharedInterest, 0.1);
    assert.equal(result.source.bio, evidence.viewer.bio);
  }
  for (const [score, normalized] of [[0, 0], [3, 100], [1.43, 48]]) {
    const result = scanFromAnswers(answers(score), evidence);
    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.relevance, normalized);
  }
});

test("missing detail has no rating; uncertain evidence retains a tentative rating", () => {
  for (const key of ["bio_has_detail", "post_has_detail"] as const) {
    const raw = answers(3);
    raw.answers[key].noul = 0.3;
    const missing = scanFromAnswers(raw, evidence);
    assert.equal(missing.status, "not_enough_data");
    assert.equal("relevance" in missing, false);
    raw.answers[key].noul = 0.5;
    const uncertain = scanFromAnswers(raw, evidence);
    assert.equal(uncertain.status, "ok");
    if (uncertain.status === "ok") { assert.equal(uncertain.relevance, 100); assert.equal(uncertain.tentative, true); }
  }
});

test("malformed or out-of-range Score and Noul answers stay unavailable", () => {
  assert.equal(scanFromAnswers({ model: "jev", answers: {} }, evidence).status, "unavailable");
  for (const score of [-0.1, 3.01, NaN]) assert.equal(scanFromAnswers(answers(score), evidence).status, "unavailable");
  assert.equal(scanFromAnswers(answers(1, 2), evidence).status, "unavailable");
  const badSignal = answers();
  badSignal.answers.related_work.noul = 1.2;
  assert.equal(scanFromAnswers(badSignal, evidence).status, "unavailable");
  const badDistribution = answers();
  badDistribution.answers.relevance.probabilities["0"] = -0.1;
  assert.equal(scanFromAnswers(badDistribution, evidence).status, "unavailable");
  const missingSignal = answers();
  assert.equal(scanFromAnswers({ ...missingSignal, answers: { relevance: missingSignal.answers.relevance } }, evidence).status, "unavailable");
});

test("provider failures stay unavailable without leaking diagnostics or tokens", async () => {
  for (const status of [401, 429, 503]) {
    const result = await evaluateProfiles(config, evidence, async () => new Response("private diagnostics", { status }));
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") assert.equal(result.pauseAuto, true);
    assert.equal(JSON.stringify(result).includes("private diagnostics"), false);
  }
});

test("evidence makes exactly one unauthenticated oEmbed request and no X API reads", async () => {
  let calls = 0;
  const result = await loadPublicEvidence(evidence.post.id, evidence.viewer, async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://publish.x.com");
    assert.equal(url.pathname, "/oembed");
    assert.equal(url.searchParams.get("url"), "https://twitter.com/i/status/1234");
    assert.equal(url.searchParams.get("omit_script"), "true");
    assert.equal(url.searchParams.get("hide_thread"), "true");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return Response.json({ html: evidence.post.html, type: "rich" });
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, evidence);
});

test("unavailable or malformed embeds and arbitrary URLs cannot reach the evaluator", async () => {
  await assert.rejects(loadPublicEvidence("https://evil.example", evidence.viewer, async () => { throw new Error("must not fetch"); }), /invalid_format/);
  await assert.rejects(loadPublicEvidence("1234", evidence.viewer, async () => new Response("private diagnostics", { status: 404 })), /removed or made private/);
  await assert.rejects(loadPublicEvidence("1234", evidence.viewer, async () => Response.json({ html: "", type: "rich" })), /incomplete post embed/);
});

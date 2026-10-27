import test from "node:test";
import assert from "node:assert/strict";
import { explainScan } from "./server/scan-explanation.ts";
import { profileInputLabel } from "./project-profile.ts";
import { jevInput, scanFromAnswers } from "./server/jev.ts";
import type { ScanEvidence, ScanResult } from "./scan-contract.ts";

const config = { accountId: "a", gatewayId: "g", apiToken: "test", gatewayToken: "test" };
const evidence: ScanEvidence = { viewer: { username: "viewer", bio: "I make small tools.", project: { url: "https://studio.example/", summary: "A scheduling tool for pottery studios and ceramic artists." } }, post: { id: "1234", html: "<blockquote><p>Looking to connect with ceramic artists. #connect</p>— A musician</blockquote>" } };
const rated: Extract<ScanResult, { status: "ok" }> = {
  status: "ok", model: "jev", checkedAt: "2026-10-27T00:00:00Z", relevance: 90, reason: "An interest you’ve shared is relevant to this invitation.", tentative: false, confidence: 0.9,
  signals: { sharedInterest: 0.8, relatedWork: 0.9, projectFit: 0.95 }, evidence: { bioDetail: 0.9, postDetail: 0.9 }, source: { ...evidence.viewer, postId: "1234" }, unknowns: [],
};
const draft = { reason: "Your pottery scheduling project relates to their interest in ceramic artists.", viewerSource: "project", viewerQuote: "pottery studios and ceramic artists", postQuote: "ceramic artists" };
const reply = (output: unknown, finishReason = "STOP") => Response.json({ success: true, result: { candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] }, finishReason }] } });

test("the short explanation cites both inputs and cannot change Jev's scores", async () => {
  const result = await explainScan(config, evidence, rated, async (url, init) => {
    assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/a/ai/run");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "google/gemini-2.5-flash-lite");
    const inputs = JSON.parse(body.input.contents[0].parts[0].text);
    assert.equal(inputs.profile.project, evidence.viewer.project!.summary);
    assert.equal(inputs.assessment.relevance, rated.relevance);
    return reply(draft);
  });
  assert.equal(result.reason, draft.reason);
  assert.deepEqual(result.signals, rated.signals);
  assert.equal(result.relevance, rated.relevance);
  assert.deepEqual(result.explanation, { viewerSource: "project", viewerQuote: draft.viewerQuote, postQuote: draft.postQuote });
});

test("missing, invented or attribution-only excerpts and excessive prose retain the existing summary", async () => {
  for (const output of [
    { ...draft, viewerQuote: "I am a professional potter" },
    { ...draft, viewerSource: "context" },
    { ...draft, postQuote: "A musician" },
    { ...draft, reason: "word ".repeat(25) },
    { ...draft, reason: "A connection.\nMore text." },
    { ...draft, reason: "", viewerQuote: "", postQuote: "" },
  ]) assert.strictEqual(await explainScan(config, evidence, rated, async () => reply(output)), rated);
});

test("an explanation failure or truncated generation never hides a completed rating", async () => {
  for (const response of [new Response("private diagnostic", { status: 500 }), reply(draft, "MAX_TOKENS"), Response.json({ invalid: true })]) {
    assert.strictEqual(await explainScan(config, evidence, rated, async () => response), rated);
  }
  assert.strictEqual(await explainScan(config, evidence, rated, async () => { throw new Error("secret"); }), rated);
});

test("Project fit is requested and shown only with project evidence", () => {
  assert.ok(jevInput(evidence).questions.project_fit);
  const withoutProject = { ...evidence, viewer: { bio: evidence.viewer.bio, username: "viewer" } };
  assert.equal("project_fit" in jevInput(withoutProject).questions, false);
  const answers = {
    relevance: { type: "score", score: 2, confidence: 0.9, probabilities: { "0": 0, "1": 0, "2": 1, "3": 0 } },
    ...Object.fromEntries(["bio_has_detail", "post_has_detail", "shared_interest", "related_work", "project_fit"].map((key) => [key, { type: "noul", noul: 0.8 }])),
  };
  const withResult = scanFromAnswers({ model: "jev", answers }, evidence);
  const withoutResult = scanFromAnswers({ model: "jev", answers }, withoutProject);
  assert.equal(withResult.status, "ok"); assert.equal(withoutResult.status, "ok");
  if (withResult.status === "ok" && withoutResult.status === "ok") {
    assert.equal(withResult.signals.projectFit, 0.8);
    assert.equal("projectFit" in withoutResult.signals, false);
    assert.equal(withResult.relevance, withoutResult.relevance);
  }
  const missing = scanFromAnswers({ model: "jev", answers: { ...answers, bio_has_detail: { type: "noul", noul: 0.1 } } }, evidence);
  assert.equal(missing.status, "not_enough_data");
  if (missing.status === "not_enough_data") assert.equal(missing.missing, "viewer");
});

test("input labels reflect actual supplied context and project URL", () => {
  assert.equal(profileInputLabel({ bio: "Hi", sentence: "", project: evidence.viewer.project! }), "Using your bio + studio.example");
  assert.equal(profileInputLabel({ bio: "", sentence: "", project: { url: "https://github.com/team/tools", summary: "Example project" } }), "Using github.com/team/tools");
  assert.equal(profileInputLabel({ bio: null, sentence: "Building things", project: null }), "Using your context");
  assert.equal(profileInputLabel({ bio: " ", sentence: "", project: null }), "Add context for your scan");
});

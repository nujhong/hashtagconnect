import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { capturePostImage } from "./server/post-image.ts";
import { evaluateProfiles, jevInput, scanFromAnswers } from "./server/jev.ts";
import type { ScanEvidence } from "./scan-contract.ts";

const evidence: ScanEvidence = {
  viewer: { bio: "I build AI tools.", username: "example" },
  post: { id: "2114541736676524485", html: "<p>AI Tools #connect</p>", image: {
    format: "jpg", dataBase64: readFileSync(new URL("../fixtures/jev/post-550.jpg", import.meta.url)).toString("base64"),
    width: 550, height: 536, theme: "light",
  } },
};
const config = { accountId: "a", gatewayId: "g", apiToken: "fake", gatewayToken: "fake" };
const coordinates = { top: .35, bottom: .41, left: .04, right: .19 };
function answers(presence = .96) {
  return { model: "jev-1.14.0", answers: {
    relevance: { type: "score", score: 3, confidence: .9, probabilities: { "0": 0, "1": 0, "2": 0, "3": 1 } },
    explanation: { type: "choice", choice: "interest", confidence: .9, probabilities: { interest: 1 } },
    ...Object.fromEntries(["bio_has_detail", "post_has_detail", "shared_interest", "related_work"].map((key) => [key, { type: "noul", noul: .9 }])),
    sharedInterest_visible: { type: "noul", noul: presence }, relatedWork_visible: { type: "noul", noul: .01 },
    sharedInterest_box: { type: "box", confidence: .98, box: { ...coordinates } },
    relatedWork_box: { type: "box", confidence: .1, box: { ...coordinates } },
  } };
}

test("one normal scan returns scores, Choice explanation and candidate boxes without image bytes", async () => {
  let calls = 0;
  const result = await evaluateProfiles(config, evidence, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "typesafe/jev-1.14.0");
    assert.equal(body.input.assets[body.input.state.post_image].data_base64, evidence.post.image!.dataBase64);
    assert.equal(body.input.state.connect_post_html, evidence.post.html);
    assert.equal(body.input.questions.relevance.type, "score");
    assert.equal(body.input.questions.explanation.type, "choice");
    assert.equal(body.input.questions.sharedInterest_box.type, "box");
    assert.equal(body.input.questions.sharedInterest_visible.type, "noul");
    assert.equal(body.input.questions.projectFit_box, undefined);
    assert.equal(new Headers(init?.headers).get("TypeSafe-Danger-Zone-Images"), "true");
    return Response.json({ success: true, result: { state: "Completed", result: answers() } });
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.relevance, 100);
  assert.equal(result.reason, "You share a specific interest.");
  assert.deepEqual(result.boxes, [{ signal: "sharedInterest", box: coordinates, presence: .96, confidence: .98 }, { signal: "relatedWork", box: coordinates, presence: .01, confidence: .1 }]);
  assert.deepEqual(result.boxImage, { width: 550, height: 536, theme: "light" });
  assert.equal(JSON.stringify(result).includes(evidence.post.image!.dataBase64), false);
});

test("native box uncertainty is retained; malformed coordinates cannot discard scores", () => {
  const absent = scanFromAnswers(answers(.01), evidence);
  assert.equal(absent.status, "ok");
  if (absent.status === "ok") { assert.equal(absent.boxes[0]?.presence, .01); assert.ok(absent.boxImage); }
  const uncertain = answers(); uncertain.answers.sharedInterest_box.confidence = .2;
  const tentative = scanFromAnswers(uncertain, evidence);
  assert.equal(tentative.status, "ok");
  if (tentative.status === "ok") assert.equal(tentative.boxes[0]?.confidence, .2);
  for (const box of [{ ...coordinates, top: -1 }, { ...coordinates, left: .9 }, { ...coordinates, bottom: 2 }]) {
    const raw = answers(); raw.answers.sharedInterest_box.box = box;
    const result = scanFromAnswers(raw, evidence);
    assert.equal(result.status, "ok");
    if (result.status === "ok") { assert.equal(result.relevance, 100); assert.deepEqual(result.boxes, []); assert.equal(result.boxImage, null); }
  }
  const noImage = { ...evidence, post: { id: evidence.post.id, html: evidence.post.html } };
  const fallback = scanFromAnswers(answers(), noImage);
  assert.equal(fallback.status, "ok");
  if (fallback.status === "ok") { assert.deepEqual(fallback.boxes, []); assert.equal(fallback.boxImage, null); }
  assert.equal("assets" in jevInput(noImage), false);
});

test("project localization is requested only when confirmed project context is supplied", () => {
  const input = jevInput({ ...evidence, viewer: { ...evidence.viewer, project: { url: "https://example.com/", summary: "An AI writing tool." } } });
  assert.ok("projectFit_box" in input.questions);
  assert.ok("projectFit_visible" in input.questions);
  assert.ok(input.questions.project_fit);
});

function pngHeader(width = 550, height = 536) {
  const png = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(width, 16); png.writeUInt32BE(height, 20); return png;
}

test("capture uses a fixed official widget and waits for it before taking a bounded screenshot", async () => {
  const image = await capturePostImage({ quickAction: async (action, options) => {
    assert.equal(action, "screenshot");
    assert.ok(options && "html" in options);
    assert.match(options.html, /createTweet\("2114541736676524485"/);
    assert.match(options.html, /dnt:true,conversation:"none"/);
    assert.equal(options.waitForSelector?.selector, '#post[data-ready="true"]');
    assert.equal(options.cacheTTL, 0);
    assert.equal(options.viewport?.width, 550);
    return new Response(pngHeader());
  } }, evidence.post.id);
  assert.equal(image.width, 550); assert.equal(image.height, 536);
  await assert.rejects(capturePostImage({ quickAction: async () => { throw new Error("Must not capture"); } }, '1";alert(1)'), /invalid_format/);
  for (const response of [new Response(null, { status: 503 }), new Response("not a screenshot"), new Response(pngHeader(550, 1800)), new Response(new Uint8Array(4_000_001))]) {
    await assert.rejects(capturePostImage({ quickAction: async () => response }, evidence.post.id));
  }
});

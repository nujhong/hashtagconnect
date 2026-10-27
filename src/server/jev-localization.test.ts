import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { evaluateProfiles, jevInput, locateEvidence, scanFromAnswers } from "./jev.ts";
import type { ScanEvidence } from "~/src/scan-contract.ts";

const evidence: ScanEvidence = {
  viewer: { bio: "I build AI tools.", username: "example" },
  post: {
    id: "2114541736676524485",
    html: "<p>AI Tools #connect</p>",
    image: {
      // Requests are mocked; these bytes exercise image forwarding, not image decoding.
      format: "png",
      dataBase64: pngHeader().toString("base64"),
      width: 550,
      height: 536,
      theme: "light",
    },
  },
};
const config = { accountId: "a", gatewayId: "g", apiToken: "fake" };
const coordinates = { top: 0.35, bottom: 0.41, left: 0.04, right: 0.19 };
function textAnswers(strength = 0.96) {
  return {
    model: "jev-1.14.0",
    answers: {
      relevance: {
        type: "score",
        score: 3,
        confidence: 0.9,
        probabilities: { "0": 0, "1": 0, "2": 0, "3": 1 },
      },
      explanation: {
        type: "choice",
        choice: "interest",
        confidence: 0.9,
        probabilities: { interest: 1 },
      },
      ...Object.fromEntries(
        ["bio_has_detail", "post_has_detail", "shared_interest", "related_work"].map((key) => [
          key,
          { type: "noul", noul: 0.9 },
        ]),
      ),
      phrase_0_text: { type: "noul", noul: strength },
    },
  };
}
const reply = (result: unknown) =>
  Response.json({ success: true, result: { state: "Completed", result } });

test("the text request checks each profile phrase without the image", async () => {
  const result = await evaluateProfiles(config, evidence, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.input.assets, undefined);
    assert.equal(body.input.state.post_image, undefined);
    assert.equal(body.input.state.phrase_0, "I build AI tools");
    assert.equal(body.input.questions.phrase_0_text.type, "noul");
    assert.equal(
      Object.keys(body.input.questions).some((key) => key.endsWith("_box")),
      false,
    );
    assert.equal(new Headers(init?.headers).get("TypeSafe-Danger-Zone-Images"), null);
    return reply(textAnswers());
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.reason, "You share a specific interest.");
  assert.deepEqual(result.phrases, [{ text: "I build AI tools", source: "bio", strength: 0.96 }]);
  assert.equal(result.boxImage, null);
});

test("locating puts the image first, asks only for strong phrases and never discards scores", async () => {
  const scored = scanFromAnswers(textAnswers(), evidence);
  assert.equal(scored.status, "ok");
  if (scored.status !== "ok") return;
  const base = {
    ...scored,
    phrases: [{ text: "ceramics", source: "bio" as const, strength: 0.02 }, ...scored.phrases],
  };
  const located = await locateEvidence(config, base, evidence.post.image!, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(Object.keys(body.input.state)[0], "post_image");
    assert.equal(
      body.input.assets[body.input.state.post_image].data_base64,
      evidence.post.image!.dataBase64,
    );
    assert.deepEqual(Object.keys(body.input.questions), ["phrase_0_present", "phrase_0_box"]);
    assert.equal(body.input.state.phrase_0, "I build AI tools");
    assert.equal(new Headers(init?.headers).get("TypeSafe-Danger-Zone-Images"), "true");
    return reply({
      answers: {
        phrase_0_present: { type: "noul", noul: 0.97 },
        phrase_0_box: { type: "box", confidence: 0.98, box: coordinates },
      },
    });
  });
  assert.equal(located.status, "ok");
  if (located.status !== "ok") return;
  assert.equal(located.phrases[0].located, undefined);
  assert.deepEqual(located.phrases[1].located, {
    box: coordinates,
    presence: 0.97,
    confidence: 0.98,
  });
  assert.deepEqual(located.boxImage, { width: 550, height: 536, theme: "light" });
  assert.equal(JSON.stringify(located).includes(evidence.post.image!.dataBase64), false);
  for (const bad of [
    { ...coordinates, top: -1 },
    { ...coordinates, left: 0.9 },
  ]) {
    const kept = await locateEvidence(config, base, evidence.post.image!, async () =>
      reply({
        answers: {
          phrase_0_present: { type: "noul", noul: 0.97 },
          phrase_0_box: { type: "box", confidence: 0.98, box: bad },
        },
      }),
    );
    assert.deepEqual(kept, base);
  }
  assert.deepEqual(
    await locateEvidence(
      config,
      base,
      evidence.post.image!,
      async () => new Response("down", { status: 503 }),
    ),
    base,
  );
  const weak = { ...base, phrases: base.phrases.map((phrase) => ({ ...phrase, strength: 0.1 })) };
  assert.equal(
    await locateEvidence(config, weak, evidence.post.image!, async () => {
      throw new Error("Must not call");
    }),
    weak,
  );
});

function pngHeader(width = 550, height = 536) {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}

test("project details after an introductory list reach both phrase scoring and localization", async () => {
  const projectEvidence = {
    ...evidence,
    viewer: {
      username: "example",
      bio: "co-founder & THE dev at https://example.com",
      project: {
        url: "https://example.com",
        summary:
          "A tool that saves web pages, videos, and posts, along with notes, to use as context for AI models like ChatGPT and Claude.",
      },
    },
  };
  assert.ok(
    Object.entries(jevInput(projectEvidence).state).some(
      ([key, value]) => /^phrase_\d+$/.test(key) && String(value).includes("AI models"),
    ),
    "The project’s AI subject must reach the phrase questions",
  );
  const scored = await evaluateProfiles(config, projectEvidence, async (_url, init) => {
    const input = JSON.parse(String(init?.body)).input;
    const target = Object.entries(input.state).find(
      ([key, value]) => /^phrase_\d+$/.test(key) && String(value).includes("AI models"),
    );
    assert.ok(target, "The project’s AI subject must reach the phrase questions");
    return reply({
      ...textAnswers(0),
      answers: { ...textAnswers(0).answers, [`${target[0]}_text`]: { type: "noul", noul: 0.96 } },
    });
  });
  assert.equal(scored.status, "ok");
  if (scored.status !== "ok") return;
  const located = await locateEvidence(config, scored, evidence.post.image!, async (_url, init) => {
    const input = JSON.parse(String(init?.body)).input;
    assert.match(input.state.phrase_0, /AI models/);
    return reply({
      answers: {
        phrase_0_present: { type: "noul", noul: 0.97 },
        phrase_0_box: { type: "box", confidence: 0.98, box: coordinates },
      },
    });
  });
  assert.equal(located.status, "ok");
  if (located.status === "ok")
    assert.ok(
      located.phrases.some((phrase) => phrase.text.includes("AI models") && phrase.located),
    );
});

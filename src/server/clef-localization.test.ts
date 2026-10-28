import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { evaluateProfiles, clefInput, locateEvidence, scanFromAnswers } from "./clef.ts";
import type { PostLayout } from "./post-layout";
import type { ScanEvidence } from "~/shared/scan-contract.ts";

const evidence: ScanEvidence = {
  viewer: { bio: "I build AI tools.", username: "example" },
  post: {
    id: "2114541736676524485",
    html: "<p>AI Tools #connect</p>",
  },
};
const config = { accountId: "a", gatewayId: "g", apiToken: "fake" };
const coordinates = { top: 0.35, bottom: 0.41, left: 0.04, right: 0.19 };
const layout: PostLayout = {
  width: 550,
  height: 536,
  theme: "light",
  lines: [{ text: "AI Tools", box: coordinates }],
};
function textAnswers(strength = 0.96) {
  return {
    model: "clef-flash",
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
const reply = (result: unknown) => Response.json({ success: true, result });

test("the text request checks each profile phrase without the image", async () => {
  const result = await evaluateProfiles(config, evidence, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.assets, undefined);
    assert.equal(body.state.post_image, undefined);
    assert.equal(body.state.phrase_0, "I build AI tools");
    assert.equal(body.questions.phrase_0_text.type, "noul");
    assert.equal(
      Object.keys(body.questions).some((key) => key.endsWith("_box")),
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

test("localization selects measured lines for strong phrases without inventing coordinates", async () => {
  const scored = scanFromAnswers(textAnswers(), evidence);
  assert.equal(scored.status, "ok");
  if (scored.status !== "ok") return;
  const base = {
    ...scored,
    phrases: [{ text: "ceramics", source: "bio" as const, strength: 0.02 }, ...scored.phrases],
  };
  const located = await locateEvidence(config, base, layout, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "clef-flash");
    assert.equal(body.images, undefined);
    assert.deepEqual(Object.keys(body.questions), ["phrase_0_present", "phrase_0_line"]);
    assert.equal(body.questions.phrase_0_line.criteria.line_0, "AI Tools");
    assert.equal(
      body.questions.phrase_0_line.criteria.none,
      "No visible body line supports this phrase.",
    );
    assert.equal(body.state.phrase_0, "I build AI tools");
    return reply({
      answers: {
        phrase_0_present: { type: "noul", noul: 0.97 },
        phrase_0_line: { type: "choice", confidence: 0.98, choice: "line_0" },
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
  for (const choice of ["none", "line_999", "invented"]) {
    const kept = await locateEvidence(config, base, layout, async () =>
      reply({
        answers: {
          phrase_0_present: { type: "noul", noul: 0.97 },
          phrase_0_line: { type: "choice", confidence: 0.98, choice },
        },
      }),
    );
    assert.deepEqual(kept, base);
  }
  assert.deepEqual(
    await locateEvidence(config, base, layout, async () => new Response("down", { status: 503 })),
    base,
  );
  const weak = { ...base, phrases: base.phrases.map((phrase) => ({ ...phrase, strength: 0.1 })) };
  assert.equal(
    await locateEvidence(config, weak, layout, async () => {
      throw new Error("Must not call");
    }),
    weak,
  );
});

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
    Object.entries(clefInput(projectEvidence).state).some(
      ([key, value]) => /^phrase_\d+$/.test(key) && String(value).includes("AI models"),
    ),
    "The project’s AI subject must reach the phrase questions",
  );
  const scored = await evaluateProfiles(config, projectEvidence, async (_url, init) => {
    const input = JSON.parse(String(init?.body));
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
  const located = await locateEvidence(config, scored, layout, async (_url, init) => {
    const input = JSON.parse(String(init?.body));
    assert.match(input.state.phrase_0, /AI models/);
    return reply({
      answers: {
        phrase_0_present: { type: "noul", noul: 0.97 },
        phrase_0_line: { type: "choice", confidence: 0.98, choice: "line_0" },
      },
    });
  });
  assert.equal(located.status, "ok");
  if (located.status === "ok")
    assert.ok(
      located.phrases.some((phrase) => phrase.text.includes("AI models") && phrase.located),
    );
});

import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { clefInput, scanFromAnswers, evaluateProfiles } from "./clef.ts";
import type { ScanEvidence } from "~/shared/scan-contract.ts";

const config = { accountId: "a", gatewayId: "g", apiToken: "test" };
const evidence: ScanEvidence = {
  viewer: {
    username: "viewer",
    bio: "I make small tools.",
    project: {
      url: "https://studio.example/",
      summary: "A scheduling tool for pottery studios and ceramic artists.",
    },
  },
  post: { id: "1234", html: "<p>Looking to connect with ceramic artists. #connect</p>" },
};

test("Project fit is assessed only with project evidence", () => {
  assert.ok(clefInput(evidence).questions.project_fit);
  const withoutProject = { ...evidence, viewer: { bio: evidence.viewer.bio, username: "viewer" } };
  assert.equal("project_fit" in clefInput(withoutProject).questions, false);
  const answers = {
    explanation: {
      type: "choice",
      choice: "interest",
      confidence: 0.9,
      probabilities: { interest: 0.9, work: 0.1, little: 0 },
    },
    relevance: {
      type: "score",
      score: 2,
      confidence: 0.9,
      probabilities: { "0": 0, "1": 0, "2": 1, "3": 0 },
    },
    ...Object.fromEntries(
      ["bio_has_detail", "post_has_detail", "shared_interest", "related_work", "project_fit"].map(
        (key) => [key, { type: "noul", noul: 0.8 }],
      ),
    ),
  };
  const withResult = scanFromAnswers({ model: "jev", answers }, evidence);
  const withoutResult = scanFromAnswers({ model: "jev", answers }, withoutProject);
  assert.equal(withResult.status, "ok");
  assert.equal(withoutResult.status, "ok");
  if (withResult.status === "ok" && withoutResult.status === "ok") {
    assert.equal(withResult.signals.projectFit, 0.8);
    assert.equal("projectFit" in withoutResult.signals, false);
    assert.equal(withResult.relevance, withoutResult.relevance);
  }
  const missing = scanFromAnswers(
    { model: "jev", answers: { ...answers, bio_has_detail: { type: "noul", noul: 0.1 } } },
    evidence,
  );
  assert.equal(missing.status, "not_enough_data");
  if (missing.status === "not_enough_data") assert.equal(missing.missing, "viewer");
});

test("one Clef request returns the Choice explanation and independent scores", async () => {
  const expected = {
    project: "Your project fits what they’re looking for.",
    interest: "You share a specific interest.",
    work: "Your work is in a related field.",
    little: "There’s little overlap in the available context.",
  };
  for (const [choice, reason] of Object.entries(expected)) {
    let calls = 0;
    const result = await evaluateProfiles(config, evidence, async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "clef-flash");
      assert.equal(body.questions.explanation.type, "choice");
      assert.deepEqual(Object.keys(body.questions.explanation.criteria), Object.keys(expected));
      return Response.json({
        success: true,
        result: {
          model: "jev",
          answers: {
            relevance: {
              type: "score",
              score: 2.4,
              confidence: 0.9,
              probabilities: { "0": 0, "1": 0, "2": 0.6, "3": 0.4 },
            },
            explanation: {
              type: "choice",
              choice,
              confidence: 0.9,
              probabilities: { [choice]: 1 },
            },
            ...Object.fromEntries(
              [
                "bio_has_detail",
                "post_has_detail",
                "shared_interest",
                "related_work",
                "project_fit",
              ].map((key) => [key, { type: "noul", noul: 0.9 }]),
            ),
          },
        },
      });
    });
    assert.equal(calls, 1);
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.equal(result.reason, reason);
      assert.equal(result.relevance, 80);
    }
  }
  const withoutProject = { ...evidence, viewer: { bio: evidence.viewer.bio, username: "viewer" } };
  assert.equal("project" in clefInput(withoutProject).questions.explanation.criteria, false);
  assert.equal(
    scanFromAnswers(
      { model: "jev", answers: { explanation: { type: "choice", choice: "invented" } } },
      evidence,
    ).status,
    "unavailable",
  );
});

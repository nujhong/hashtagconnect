import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { jevInput, evaluateProfiles } from "~/src/server/jev.ts";
import { scanInputHash } from "~/src/server/scan-cache-key.ts";
const config = { accountId: "a", gatewayId: "g", apiToken: "test-ai" };
const summary = "A project for ceramic artists to organize workshops and share kiln schedules.";
test("confirmed project context supplements an empty bio, changes the scan hash, and retains its source", async () => {
  const evidence = {
    viewer: {
      bio: "",
      username: "ceramicist",
      project: { url: "https://wheelhouse.example/", summary },
    },
    post: { id: "1234", html: "<p>Looking for people making pottery tools.</p>" },
  };
  const input = jevInput(evidence);
  assert.equal(input.state.viewer_bio, "");
  assert.equal(input.state.viewer_project, summary);
  assert.notEqual(
    await scanInputHash(evidence),
    await scanInputHash({ ...evidence, viewer: { bio: "", username: "ceramicist" } }),
  );
  assert.notEqual(
    await scanInputHash(evidence),
    await scanInputHash({
      ...evidence,
      viewer: {
        ...evidence.viewer,
        project: { ...evidence.viewer.project, url: "https://another.example/" },
      },
    }),
  );
  let called = false;
  const result = await evaluateProfiles(config, evidence, async () => {
    called = true;
    return Response.json({
      success: true,
      result: {
        state: "Completed",
        result: {
          model: "typesafe/jev",
          answers: {
            explanation: {
              type: "choice",
              choice: "interest",
              confidence: 0.9,
              probabilities: { interest: 0.9, work: 0.1, little: 0 },
            },
            relevance: {
              type: "score",
              score: 3,
              confidence: 0.9,
              probabilities: { "0": 0, "1": 0, "2": 0, "3": 1 },
            },
            ...Object.fromEntries(
              ["bio_has_detail", "post_has_detail", "shared_interest", "related_work"].map(
                (key) => [key, { type: "noul", noul: 0.9 }],
              ),
            ),
          },
        },
      },
    });
  });
  assert.ok(called);
  assert.equal(result.status, "ok");
  if (result.status === "ok") assert.deepEqual(result.source.project, evidence.viewer.project);
});

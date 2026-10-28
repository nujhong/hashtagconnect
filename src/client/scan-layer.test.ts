import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { aligns, evidenceOf, postSpots } from "./scan-layer.ts";
import type { ScanResult } from "~/shared/scan-contract.ts";

const box = { top: 0.21, bottom: 0.35, left: 0.08, right: 0.32 };
const result = (phrases: unknown[]) =>
  ({ status: "ok", phrases }) as unknown as Extract<ScanResult, { status: "ok" }>;

test("evidence is the three strongest phrases, keeping their index", () => {
  const evidence = evidenceOf(
    result([
      { text: "a", source: "bio", strength: 0.6 },
      { text: "b", source: "bio", strength: 0.2 },
      { text: "c", source: "bio", strength: 0.9 },
      { text: "d", source: "bio", strength: 0.7 },
      { text: "e", source: "project", strength: 0.8 },
    ]),
  );
  assert.deepEqual(
    evidence.map(({ index }) => index),
    [2, 4, 3],
  );
});

test("outlines need presence; same-words boxes merge; low confidence is approximate", () => {
  const spots = postSpots(
    evidenceOf(
      result([
        {
          text: "AI tools",
          source: "bio",
          strength: 0.9,
          located: { box, presence: 0.98, confidence: 0.36 },
        },
        {
          text: "building AI tools",
          source: "bio",
          strength: 0.8,
          located: {
            box: { ...box, left: 0.05, right: 0.31, bottom: 0.34 },
            presence: 0.97,
            confidence: 0.21,
          },
        },
        {
          text: "ceramics",
          source: "bio",
          strength: 0.7,
          located: { box: { ...box, top: 0.6, bottom: 0.7 }, presence: 0.1, confidence: 0.9 },
        },
      ]),
    ),
  );
  assert.deepEqual(spots, [{ phrases: [0, 1], box, approximate: true }]);
  const sure = postSpots(
    evidenceOf(
      result([
        {
          text: "x",
          source: "bio",
          strength: 0.9,
          located: { box, presence: 0.9, confidence: 0.9 },
        },
      ]),
    ),
  );
  assert.equal(sure[0].approximate, false);
});

test("the overlay needs the capture's geometry", () => {
  assert.equal(aligns({ width: 550, height: 557 }, { width: 550, height: 560 }), true);
  assert.equal(aligns({ width: 550, height: 557 }, { width: 320, height: 760 }), false);
  assert.equal(aligns({ width: 550, height: 557 }, { width: 550, height: 640 }), false);
  assert.equal(aligns({ width: 550, height: 280 }, { width: 550, height: 214 }), true);
});

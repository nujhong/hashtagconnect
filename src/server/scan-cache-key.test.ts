import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { scanInputHash } from "./scan-cache-key.ts";
import type { ScanEvidence } from "~/src/scan-contract.ts";
const evidence: ScanEvidence = {
  viewer: { bio: "I make ceramics.", username: "potter" },
  post: { id: "1234", html: "<p>Looking to connect with potters. #connect</p>" },
};

test("unchanged inference inputs reuse a hash, changed evidence or optional context invalidates it", async () => {
  const hash = await scanInputHash(evidence);
  assert.equal(hash, await scanInputHash(structuredClone(evidence)));
  for (const changed of [
    { ...evidence, viewer: { ...evidence.viewer, bio: "I write music." } },
    { ...evidence, viewer: { ...evidence.viewer, context: "Teaching wheel throwing." } },
    { ...evidence, viewer: { ...evidence.viewer, username: "newhandle" } },
    { ...evidence, post: { ...evidence.post, html: "<p>Looking for musicians</p>" } },
  ])
    assert.notEqual(hash, await scanInputHash(changed));
});

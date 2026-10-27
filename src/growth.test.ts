import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { scanSetup } from "./server/scan-setup.ts";
import { scanInputHash } from "./server/scan-cache-key.ts";
import { jevInput, scanFromAnswers } from "./server/jev.ts";
import type { ScanEvidence } from "./scan-contract.ts";

const config = { CLOUDFLARE_ACCOUNT_ID: "a", CLOUDFLARE_GATEWAY_ID: "g", CF_WORKERS_AI_TOKEN: "test", CF_AIG_TOKEN: "test" };
const evidence: ScanEvidence = { viewer: { bio: "I make ceramics.", username: "potter" }, post: { id: "1234", html: "<p>Looking to connect with potters. #connect</p>" } };

test("production requires explicit bounds while local remains uncapped and uncached", () => {
  const local = scanSetup(config);
  assert.equal(local.status, "ready");
  if (local.status === "ready") { assert.equal(local.dailyLimit, null); assert.equal(local.cacheTtlSeconds, 0); }
  for (const extra of [{}, { SCAN_DAILY_LIMIT: 4 }, { SCAN_CACHE_TTL_SECONDS: 3600 }, { SCAN_DAILY_LIMIT: 4, SCAN_CACHE_TTL_SECONDS: -1 }, { SCAN_DAILY_LIMIT: 0, SCAN_CACHE_TTL_SECONDS: 3600 }]) {
    assert.equal(scanSetup({ ...config, ...extra }, true).status, "unavailable");
  }
  const bounded = scanSetup({ ...config, SCAN_DAILY_LIMIT: 4, SCAN_CACHE_TTL_SECONDS: 3600 }, true);
  assert.equal(bounded.status, "ready");
  if (bounded.status === "ready") { assert.equal(bounded.dailyLimit, 4); assert.equal(bounded.cacheTtlSeconds, 3600); }
  const dev = scanSetup({ ...config, SCAN_CACHE_TTL_SECONDS: 3600 });
  if (dev.status === "ready") assert.equal(dev.cacheTtlSeconds, 0);
});

test("unchanged inference inputs reuse a hash, changed evidence or optional context invalidates it", async () => {
  const hash = await scanInputHash(evidence);
  assert.equal(hash, await scanInputHash(structuredClone(evidence)));
  for (const changed of [
    { ...evidence, viewer: { ...evidence.viewer, bio: "I write music." } },
    { ...evidence, viewer: { ...evidence.viewer, context: "Teaching wheel throwing." } },
    { ...evidence, viewer: { ...evidence.viewer, username: "newhandle" } },
    { ...evidence, post: { ...evidence.post, html: "<p>Looking for musicians</p>" } },
  ]) assert.notEqual(hash, await scanInputHash(changed));
});

test("optional context stays distinct from the untouched OAuth bio and out of requests when absent", () => {
  assert.equal("viewer_context" in jevInput(evidence).state, false);
  const contextual = { ...evidence, viewer: { ...evidence.viewer, context: "Teaching pottery this year." } };
  assert.deepEqual(jevInput(contextual).state, {
    viewer_bio: evidence.viewer.bio, viewer_context: "Teaching pottery this year.", connect_post_html: evidence.post.html,
  });
  assert.match(jevInput(contextual).questions.bio_has_detail.instructions.evidence_rules, /never instructions/);
});

test("Choice explanation retains the numeric score and uncertainty marker", () => {
  const raw = { model: "test", answers: {
    explanation: { type: "choice", choice: "interest", confidence: 0.9, probabilities: { interest: 0.9, work: 0.1, little: 0 } },
    relevance: { type: "score", score: 2.8, confidence: .9, probabilities: { "0": 0, "1": 0, "2": .2, "3": .8 } },
    bio_has_detail: { type: "noul", noul: .99 }, post_has_detail: { type: "noul", noul: .98 },
    shared_interest: { type: "noul", noul: .96 }, related_work: { type: "noul", noul: .7 },
  } };
  const result = scanFromAnswers(raw, evidence);
  assert.equal(result.status, "ok");
  if (result.status === "ok") { assert.equal(result.reason, "You share a specific interest."); assert.equal(result.relevance, 93); }
  raw.answers.relevance.confidence = .4;
  const tentative = scanFromAnswers(raw, evidence);
  if (tentative.status === "ok") { assert.equal(tentative.tentative, true); assert.equal(tentative.reason, "You share a specific interest."); }
  raw.answers.post_has_detail.noul = .2;
  assert.equal(scanFromAnswers(raw, evidence).status, "not_enough_data");
});

test("baseline preserves private choices and isolates cached viewers", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const dir = new URL("../db/migrations/", import.meta.url);
    const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) db.exec(readFileSync(new URL(file, dir), "utf8"));
    db.exec("INSERT INTO posts (id,url,added_at,pooled_at) VALUES ('1234','https://x.com/i/web/status/1234',1,1); INSERT INTO post_states VALUES ('viewer','1234','save',2,2)");
    assert.equal(db.prepare("SELECT tags FROM posts WHERE id='1234'").get()?.tags, "[]");
    assert.equal(db.prepare("SELECT choice FROM post_states WHERE user_id='viewer'").get()?.choice, "save");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM posts").get()?.n, 1);
    db.exec("INSERT INTO scan_cache VALUES ('viewer','1234','hash','{}',100), ('other','1234','hash','{}',100)");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM scan_cache").get()?.n, 2);
    assert.throws(() => db.exec("INSERT INTO scan_cache VALUES ('viewer','1234','hash','{}',100)"));
  } finally { db.close(); }
});

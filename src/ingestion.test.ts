import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { Hono } from "hono";
import { ingestionAuth, ingestionBody, poolPostSQL } from "./server/ingestion.ts";

const url = "https://x.com/example/status/1234";

test("ingestion accepts URL variants and rejects the entire invalid or oversized batch", () => {
  assert.deepEqual(ingestionBody.parse({ urls: [url, "https://twitter.com/other/status/1234?s=20", "https://x.com/i/web/status/5678"] }).urls, ["1234", "1234", "5678"]);
  for (const body of [{ urls: [] }, { urls: Array(101).fill(url) }, { urls: [url, "https://example.com/status/1"] }, { urls: [url], pooledAt: 1 }, { urls: ["https://x.com/example"] }]) {
    assert.equal(ingestionBody.safeParse(body).success, false);
  }
});

test("pool writes require the ingestion secret, not a viewer cookie or another bearer token", async () => {
  let token: string | undefined;
  let writes = 0;
  const app = new Hono().post("/ingest", ingestionAuth(() => token), (c) => { writes++; return c.json({ ok: true }); });
  const request = (headers = {}) => app.request("/ingest", { method: "POST", headers });
  assert.equal((await request()).status, 503);
  token = "test-ingestion-secret";
  assert.equal((await request()).status, 401);
  assert.equal((await request({ Cookie: "better-auth.session_token=viewer-session" })).status, 401);
  assert.equal((await request({ Authorization: "Bearer x-api-token" })).status, 401);
  assert.equal(writes, 0);
  assert.equal((await request({ Authorization: `Bearer ${token}` })).status, 200);
  assert.equal(writes, 1);
});

test("ingestion inserts and promotes idempotently without resetting authors, tags or saved choices", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const dir = new URL("../db/migrations/", import.meta.url);
    for (const file of readdirSync(dir).filter((file) => file.endsWith(".sql"))) db.exec(readFileSync(new URL(file, dir), "utf8"));
    db.exec(`PRAGMA foreign_keys = ON;
      INSERT INTO people VALUES ('person-1', 'example', 'https://x.com/example', 'seed', 1);
      INSERT INTO posts (id, url, added_at, person_id, tags) VALUES ('1234', 'https://x.com/example/status/1234', 1, 'person-1', '["connect"]');
      INSERT INTO post_states VALUES ('viewer', '1234', 'skip', 2, 2);
      INSERT INTO person_states VALUES ('viewer', 'person-1', '1234', 'save', 3, 3);`);
    const ingest = (id: string, now: number) => {
      db.prepare(poolPostSQL).run(id, `https://x.com/i/web/status/${id}`, now, now);
    };
    const states = () => [db.prepare("SELECT * FROM post_states").all(), db.prepare("SELECT * FROM person_states").all()];
    const before = states();
    ingest("1234", 100);
    ingest("5678", 100);
    const first = db.prepare("SELECT * FROM posts ORDER BY id").all();
    ingest("1234", 200);
    ingest("5678", 200);
    assert.deepEqual(db.prepare("SELECT * FROM posts ORDER BY id").all(), first);
    assert.deepEqual(states(), before);
    assert.equal(first[0]?.added_at, 1);
    assert.equal(first[0]?.pooled_at, 100);
    assert.equal(first[0]?.person_id, "person-1");
    assert.equal(first[0]?.tags, '["connect"]');
    assert.equal(first[1]?.url, "https://x.com/i/web/status/5678");
    assert.equal(first[1]?.person_id, null);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});

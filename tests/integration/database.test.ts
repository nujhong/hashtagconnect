import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

test("migrations create an empty application database", () => {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../../db/migrations/", import.meta.url);
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql"));
  for (const file of files.sort()) db.exec(readFileSync(new URL(file, dir), "utf8"));
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((row) => row.name);
  for (const table of [
    "user",
    "account",
    "session",
    "people",
    "posts",
    "person_states",
    "post_states",
    "scan_cache",
    "viewer_context",
    "funnel",
  ])
    assert.ok(tables.includes(table), table);
  assert.equal(db.prepare("SELECT count(*) AS count FROM posts").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM people").get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("saved people survive source-post deletion and profile renames", () => {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(new URL(file, dir), "utf8"));
  db.exec(`PRAGMA foreign_keys = ON;
    INSERT INTO people VALUES ('person-1', 'alice', 'https://x.com/alice', 'seed', 1);
    INSERT INTO posts (id, url, added_at, pooled_at, person_id) VALUES ('1234', 'https://x.com/i/web/status/1234', 1, 1, 'person-1');
    INSERT INTO person_states VALUES ('viewer-a', 'person-1', '1234', 'save', 2, 2);
    DELETE FROM posts WHERE id = '1234';
    UPDATE people SET handle = 'alice_new', profile_url = 'https://x.com/alice_new' WHERE id = 'person-1';`);
  const saved = db.prepare("SELECT * FROM person_states WHERE user_id = 'viewer-a'").get();
  assert.equal(saved?.choice, "save");
  assert.equal(saved?.opened_at, 2);
  assert.equal(saved?.source_post_id, null);
  assert.equal(saved?.person_id, "person-1");
  assert.equal(
    db.prepare("SELECT handle FROM people WHERE id = 'person-1'").get()?.handle,
    "alice_new",
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO people VALUES ('person-2', 'other', 'https://x.com/alice_new', 'seed', 2)",
    ),
  );
  db.close();
});

test("saved results allow separate viewers and reject duplicates for the same viewer/post", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const dir = new URL("../../db/migrations/", import.meta.url);
    const files = readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) db.exec(readFileSync(new URL(file, dir), "utf8"));
    db.exec(
      "INSERT INTO posts (id,url,added_at,pooled_at) VALUES ('1234','https://x.com/i/web/status/1234',1,1);",
    );
    db.exec(
      "INSERT INTO scan_cache VALUES ('viewer','1234','hash','{}'), ('other','1234','hash','{}')",
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM scan_cache").get()?.n, 2);
    assert.throws(() => db.exec("INSERT INTO scan_cache VALUES ('viewer','1234','hash','{}')"));
  } finally {
    db.close();
  }
});

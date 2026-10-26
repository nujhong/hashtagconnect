import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

test("migration preserves saved post references and removes only the content snapshot", () => {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../db/migrations/", import.meta.url);
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const conversion = files.findIndex((file) => readFileSync(new URL(file, dir), "utf8").includes("INSERT INTO post_states"));
  assert.ok(conversion >= 0, "the candidate-to-post migration must exist");
  for (const file of files.slice(0, conversion)) db.exec(readFileSync(new URL(file, dir), "utf8"));
  db.exec(`INSERT INTO candidates VALUES ('10', '1234', 'Name', 'oldhandle', 'bio', NULL, 'text', '2026-10-25', 1000, 2000, 1);
    INSERT INTO decisions VALUES ('viewer-a', '10', 'save', 1100);`);
  for (const file of files.slice(conversion)) db.exec(readFileSync(new URL(file, dir), "utf8"));
  const post = db.prepare("SELECT * FROM posts WHERE id = '1234'").get();
  assert.equal(post?.url, "https://x.com/i/web/status/1234");
  assert.equal(post?.pooled_at, 1000);
  const state = db.prepare("SELECT * FROM post_states WHERE user_id = 'viewer-a'").get();
  assert.equal(state?.choice, "save");
  assert.equal(state?.opened_at, null);
  assert.equal(state?.post_id, "1234");
  assert.equal(db.prepare("SELECT count(*) as n FROM sqlite_master WHERE name = 'candidates'").get()?.n, 0);
  db.exec("PRAGMA foreign_keys = ON; DELETE FROM posts WHERE id = '1234';");
  assert.equal(db.prepare("SELECT count(*) as n FROM post_states").get()?.n, 0);
  db.close();
});

test("saved people survive source-post deletion and profile renames", () => {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(file, dir), "utf8"));
  db.exec(`PRAGMA foreign_keys = ON;
    INSERT INTO people VALUES ('person-1', 'alice', 'https://x.com/alice', 'curator', 1);
    INSERT INTO posts VALUES ('1234', 'https://x.com/i/web/status/1234', 1, 1, 'person-1');
    INSERT INTO person_states VALUES ('viewer-a', 'person-1', '1234', 'save', 2, 2);
    DELETE FROM posts WHERE id = '1234';
    UPDATE people SET handle = 'alice_new', profile_url = 'https://x.com/alice_new' WHERE id = 'person-1';`);
  const saved = db.prepare("SELECT * FROM person_states WHERE user_id = 'viewer-a'").get();
  assert.equal(saved?.choice, "save");
  assert.equal(saved?.opened_at, 2);
  assert.equal(saved?.source_post_id, null);
  assert.equal(saved?.person_id, "person-1");
  assert.equal(db.prepare("SELECT handle FROM people WHERE id = 'person-1'").get()?.handle, "alice_new");
  assert.throws(() => db.exec("INSERT INTO people VALUES ('person-2', 'other', 'https://x.com/alice_new', 'curator', 2)"));
  db.close();
});

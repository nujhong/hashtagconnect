import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "~/db/schema.ts";
import { mergeGuestState } from "~/src/server/guest-state.ts";

test("guest import resolves authors server-side, preserves account decisions, and safely retries", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      d1Databases: ["DB"],
    }),
  );
  try {
    const binding = await mf.getD1Database("DB");
    const dir = new URL("../../db/migrations/", import.meta.url);
    for (const file of readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(new URL(file, dir), "utf8")
        .replace(/--[^\n]*/g, "")
        .split(";")
        .map((statement) => statement.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(";\n");
      await binding.exec(sql);
    }
    const db = drizzle(binding, { schema });

    await db.insert(schema.people).values({
      id: "person",
      handle: "author",
      profileUrl: "https://x.com/author",
      confirmedBy: "test",
      updatedAt: 1,
    });
    await db.insert(schema.posts).values([
      { id: "1000", url: "https://x.com/i/web/status/1000", addedAt: 1, pooledAt: 1 },
      {
        id: "1001",
        url: "https://x.com/i/web/status/1001",
        addedAt: 1,
        pooledAt: 1,
        personId: "person",
      },
      { id: "1002", url: "https://x.com/i/web/status/1002", addedAt: 1, pooledAt: null },
      { id: "1003", url: "https://x.com/i/web/status/1003", addedAt: 1, pooledAt: 1 },
    ]);
    await db
      .insert(schema.postStates)
      .values({ userId: "viewer", postId: "1003", choice: null, openedAt: 7, updatedAt: 1 });
    const entries = [
      { postId: "1000", choice: "save" as const, openedAt: 2 },
      { postId: "1001", choice: "skip" as const, openedAt: null },
      { postId: "1002", choice: "save" as const, openedAt: null },
      { postId: "1003", choice: "save" as const, openedAt: 9 },
      { postId: "9999", choice: "save" as const, openedAt: null },
    ];
    await mergeGuestState(db, "viewer", entries);
    const posts = await db.select().from(schema.postStates);
    assert.equal(posts.length, 2, "Unknown and non-pooled posts are not imported");
    assert.equal(posts.find((p) => p.postId === "1000")?.choice, "save");
    assert.equal(posts.find((p) => p.postId === "1000")?.openedAt, 2);
    assert.equal(posts.find((p) => p.postId === "1003")?.choice, null, "An account clear wins");
    assert.equal(posts.find((p) => p.postId === "1003")?.openedAt, 7);
    const [person] = await db.select().from(schema.personStates);
    assert.equal(person.personId, "person");
    assert.equal(person.choice, "skip");
    await db.update(schema.personStates).set({ choice: "save", openedAt: 10 });
    await db.update(schema.postStates).set({ choice: "skip" });
    await Promise.all([
      mergeGuestState(db, "viewer", entries),
      mergeGuestState(db, "viewer", entries),
    ]);
    assert.ok((await db.select().from(schema.postStates)).every((p) => p.choice === "skip"));
    assert.equal((await db.select().from(schema.personStates))[0].choice, "save");
    assert.equal((await db.select().from(schema.personStates))[0].openedAt, 10);
    await mergeGuestState(db, "other-viewer", entries.slice(0, 2));
    assert.equal((await db.select().from(schema.personStates)).length, 2, "Accounts stay separate");
  } finally {
    await mf.dispose();
  }
});

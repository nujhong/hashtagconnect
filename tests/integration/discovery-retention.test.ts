import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "~/db/schema";
import { DISCOVERY_RETENTION_DAYS } from "~/shared/discovery-retention";
import { guestKey, restoreGuest } from "~/client/guest-state";
import { dedupePeople } from "~/shared/people";
import { mergeGuestState } from "~/server/guest-state";

const database = vi.hoisted(() => ({
  current: undefined as DrizzleD1Database<typeof schema> | undefined,
}));
vi.mock("@schema", () => import("~/db/schema"));
vi.mock("void/db", async (original) => ({
  ...(await original<typeof import("void/db")>()),
  get db() {
    return database.current;
  },
}));
import { listPosts, requirePostAccess } from "~/server/discovery";

const now = Date.UTC(2026, 9, 28);
const idAt = (timestamp: number) => String(BigInt(timestamp - 1288834974657) << 22n);

test("expiry preserves Stash and guest imports; re-ingestion cannot renew old posts", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      d1Databases: ["DB"],
    }),
  );
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    const binding = await mf.getD1Database("DB");
    const dir = new URL("../../src/db/migrations/", import.meta.url);
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const statements = readFileSync(new URL(file, dir), "utf8")
        .replace(/--[^\n]*/g, "")
        .split(";")
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(";\n");
      await binding.exec(statements);
    }
    const db = drizzle(binding, { schema });
    database.current = db;
    const old = idAt(now - DISCOVERY_RETENTION_DAYS * 86_400_000);
    const fresh = idAt(now - 1);
    const another = idAt(now - 2);
    await db.insert(schema.people).values({
      id: "author",
      handle: "author",
      profileUrl: "https://x.com/author",
      confirmedBy: "test",
      updatedAt: now,
    });
    await db.insert(schema.posts).values(
      [old, fresh, another].map((id) => ({
        id,
        url: `https://x.com/i/web/status/${id}`,
        addedAt: now,
        pooledAt: now,
        personId: "author",
      })),
    );
    await db.insert(schema.personStates).values({
      userId: "member",
      personId: "author",
      sourcePostId: old,
      choice: "save",
      openedAt: 123,
      updatedAt: now,
    });
    await db.insert(schema.postStates).values({
      userId: "unlinked-save",
      postId: old,
      choice: "save",
      updatedAt: now,
    });
    await db.insert(schema.scanCache).values({
      userId: "member",
      postId: old,
      inputHash: "existing-result",
      result: { status: "not_enough_data", reason: "No usable profile detail." },
    });
    const guest = await listPosts();
    assert.deepEqual(new Set(guest.posts.map((p) => p.id)), new Set([fresh, another]));
    assert.equal(dedupePeople(guest.posts).length, 1, "Fresh posts still deduplicate by author");
    const member = await listPosts("member");
    assert.equal(member.posts.find((p) => p.id === old)?.pooledAt, null);
    assert.equal(member.people[0].sourcePost?.id, old);
    assert.equal(member.people[0].sourcePost?.pooledAt, null);
    assert.equal(member.people[0].choice, "save");
    assert.equal(member.people[0].openedAt, 123);
    assert.equal(
      (await listPosts("unlinked-save")).posts.find((p) => p.id === old)?.choice,
      "save",
    );
    assert.equal((await requirePostAccess("member", old)).id, old);
    assert.equal((await db.select().from(schema.scanCache)).length, 1);
    assert.equal((await db.select().from(schema.posts)).length, 3);

    const browserSaved = { ...member.people[0].sourcePost!, pooledAt: now };
    const restored = restoreGuest(
      { getItem: (key) => (key === guestKey ? JSON.stringify({ posts: [browserSaved] }) : null) },
      guest.posts,
    );
    assert.equal(restored.posts.find((p) => p.id === old)?.choice, "save");
    assert.equal(restored.posts.find((p) => p.id === old)?.pooledAt, null);
    await mergeGuestState(db, "guest-signing-in", [
      { postId: old, choice: "save", openedAt: null },
    ]);
    assert.equal((await listPosts("guest-signing-in")).people[0].sourcePost?.id, old);

    await db
      .insert(schema.posts)
      .values({ id: old, url: browserSaved.url, addedAt: now, pooledAt: now })
      .onConflictDoUpdate({ target: schema.posts.id, set: { addedAt: now, pooledAt: now } });
    await db
      .insert(schema.posts)
      .values({
        id: fresh,
        url: `https://x.com/i/web/status/${fresh}`,
        addedAt: now,
        pooledAt: now,
      })
      .onConflictDoNothing();
    assert.equal(
      (await listPosts()).posts.some((p) => p.id === old),
      false,
    );
    assert.equal((await db.select().from(schema.posts)).length, 3);
    assert.equal((await listPosts("member")).people[0].sourcePost?.id, old);
    assert.equal((await listPosts("member")).people[0].choice, "save");
  } finally {
    clock.mockRestore();
    database.current = undefined;
    await mf.dispose();
  }
});

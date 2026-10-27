import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { postFromUrl } from "./people.ts";
import { guestKey, restoreGuest, importGuestState } from "./guest.ts";

const saved = {
  posts: [
    {
      id: "1234",
      url: "https://x.com/example/status/1234",
      addedAt: 1,
      pooledAt: 1,
      choice: "save",
      openedAt: 2,
      person: { id: "person-1", handle: "example", profileUrl: "https://x.com/example" },
    },
  ],
  tags: { "1234": ["connect"] },
  seeded: ["1234"],
};

test("renaming guest storage preserves old saves without restoring cleared current data", () => {
  const values = new Map([["xconnect-preview-v3", JSON.stringify(saved)]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  const restored = restoreGuest(storage);
  assert.equal(restored.posts[0].choice, "save");
  assert.equal(restored.posts[0].openedAt, 2);
  assert.deepEqual(restored.posts[0].person, saved.posts[0].person);
  assert.deepEqual(restored.tags, saved.tags);
  values.set(guestKey, JSON.stringify({ posts: [], tags: {} }));
  assert.deepEqual(restoreGuest(storage), { posts: [], tags: {} });
});

test("damaged guest storage cannot restore external profile links or inject sample posts", () => {
  for (const value of [null, "invalid json"]) {
    assert.deepEqual(restoreGuest({ getItem: () => value }), { posts: [], tags: {} });
  }
  const unsafe = {
    ...saved,
    posts: [
      {
        ...saved.posts[0],
        person: { ...saved.posts[0].person, profileUrl: "https://example.com/" },
      },
    ],
  };
  const restored = restoreGuest({ getItem: () => JSON.stringify(unsafe) });
  assert.equal(restored.posts.length, 1);
  assert.equal(restored.posts[0].person, null);
  assert.equal(restored.posts[0].choice, "save");
});

test("guests see the shared pool even with empty browser storage", () => {
  const post = {
    ...postFromUrl("https://x.com/example/status/5678")!,
    pooledAt: 3,
    tags: ["connect"],
  };
  const result = restoreGuest({ getItem: () => null }, [post]);
  assert.deepEqual(result.posts, [post]);
  assert.deepEqual(result.tags, { "5678": ["connect"] });
});

test("refresh merges new pool posts with guest choices without resurrecting withdrawn posts", () => {
  const existing = { ...postFromUrl(saved.posts[0].url)!, pooledAt: 3, tags: ["buildinpublic"] };
  const incoming = {
    ...postFromUrl("https://x.com/example/status/5678")!,
    pooledAt: 4,
    tags: ["connect"],
  };
  const storage = { getItem: () => JSON.stringify(saved) };
  const result = restoreGuest(storage, [incoming, existing]);
  assert.deepEqual(
    result.posts.map((post) => post.id),
    ["5678", "1234"],
  );
  assert.equal(result.posts[1].choice, "save");
  assert.equal(result.posts[1].openedAt, 2);
  assert.deepEqual(result.tags["1234"], ["buildinpublic"]);
  const withdrawn = restoreGuest(storage, []);
  assert.equal(withdrawn.posts[0].pooledAt, null);
  assert.equal(withdrawn.posts[0].choice, "save");
});

test("guest import keeps local saves on failure and clears them only after every batch succeeds", async () => {
  const original = JSON.stringify({
    posts: Array.from({ length: 51 }, (_, i) => ({
      ...saved.posts[0],
      url: `https://x.com/example/status/${1000 + i}`,
    })),
    tags: {},
  });
  let value = original;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  let calls = 0;
  await assert.rejects(
    importGuestState(storage, async () => {
      if (++calls === 2) throw new Error("offline");
    }),
    /offline/,
  );
  assert.equal(value, original);
  const batches: number[] = [];
  assert.equal(
    await importGuestState(storage, async (entries) => {
      batches.push(entries.length);
      assert.equal(entries[0].choice, "save");
      assert.equal(entries[0].openedAt, 2);
      assert.equal(value, original);
    }),
    true,
  );
  assert.deepEqual(batches, [50, 1]);
  assert.deepEqual(JSON.parse(value), { posts: [], tags: {} });
  assert.equal(
    await importGuestState(storage, async () => {
      assert.fail("already imported");
    }),
    false,
  );
});

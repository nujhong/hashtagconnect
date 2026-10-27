import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { guestKey, restoreGuest } from "./guest.ts";

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

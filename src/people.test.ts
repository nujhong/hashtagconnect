import test from "node:test";
import assert from "node:assert/strict";
import { dedupePeople, profileFromInput, postFromUrl, postIdFromUrl, postUrl, timeAgo } from "./people.ts";

test("only X post URLs are accepted; URLs cannot become arbitrary outbound targets", () => {
  assert.equal(postIdFromUrl("https://x.com/nujhongc/status/2114219937699074213?s=20"), "2114219937699074213");
  assert.equal(postIdFromUrl("https://twitter.com/i/web/status/1234"), "1234");
  assert.equal(postIdFromUrl("https://x.com/person/status/1234/photo/1"), "1234");
  for (const url of ["https://x.com.evil.test/u/status/1234", "https://x.com@evil.test/u/status/1234",
    "http://x.com/u/status/1234", "https://x.com:8443/u/status/1234", "file:///etc/passwd",
    "https://x.com/user", "https://x.com/u/status/abc", "https://x.com/u/status/0", "https://x.com/u/status/1234/evil"]) {
    assert.equal(postIdFromUrl(url), null, url);
  }
});

test("aliases and tracking queries resolve to the same post, without trusting a URL's handle", () => {
  const first = postFromUrl("https://twitter.com/oldhandle/status/1234?s=20", 1000);
  const second = postFromUrl("https://x.com/wronghandle/status/1234", 1000);
  assert.deepEqual(first, second);
  assert.equal(first?.url, postUrl("1234"));
  assert.equal(first?.pooledAt, null);
  assert.equal(first?.openedAt, null);
  assert.equal(first?.choice, null);
});

test("opened age is derived from our timestamp, with safe future clock handling", () => {
  assert.equal(timeAgo(2000, 1000), "just now");
  assert.equal(timeAgo(0, 120000), "2m ago");
  assert.equal(timeAgo(0, 7200000), "2h ago");
});

test("sandbox seeds merge once without overwriting the visitor's posts, choices or tags", async () => {
  const { mergeSeeds, SANDBOX_SEEDS, LEGACY_DEMO_ID } = await import("./people.ts");
  const kept = { ...postFromUrl(SANDBOX_SEEDS[1].url, 5)!, pooledAt: 5, choice: "save" as const };
  const demo = postFromUrl(`https://x.com/XDevelopers/status/${LEGACY_DEMO_ID}`, 1)!;
  const mine = postFromUrl("https://x.com/me/status/42", 1)!;
  const first = mergeSeeds({ posts: [demo, mine, kept], tags: { [kept.id]: ["mine"] }, seeded: [] }, 9);
  assert.equal(first.posts.some((p) => p.id === LEGACY_DEMO_ID), false);
  assert.equal(first.posts.length, 1 + SANDBOX_SEEDS.length);
  const upgraded = first.posts.find((p) => p.id === kept.id)!;
  assert.deepEqual({ ...upgraded, person: null }, kept);
  assert.equal(upgraded.person?.profileUrl, SANDBOX_SEEDS[1].profileUrl);
  assert.deepEqual(first.tags[kept.id], ["mine"]);
  const removed = first.posts.filter((p) => p.id !== first.seeded[0]);
  assert.equal(mergeSeeds({ ...first, posts: removed }, 10).posts.length, removed.length);
});

test("curator profile links normalize aliases and reject post links or arbitrary targets", () => {
  assert.deepEqual(profileFromInput("@Example_Name"), { handle: "Example_Name", profileUrl: "https://x.com/example_name" });
  assert.deepEqual(profileFromInput("https://twitter.com/Example_Name/?s=21"), profileFromInput("@Example_Name"));
  for (const value of ["https://x.com/a/status/1234", "https://x.com/home", "https://x.com@evil.test/name",
    "https://x.com.evil.test/name", "https://user@x.com/name", "https://x.com:8443/name", "javascript:alert(1)", "@too_long_for_an_x_handle"]) {
    assert.equal(profileFromInput(value), null, value);
  }
});

test("people deduplicate by local identity while unconfirmed post links remain distinct", () => {
  const person = { id: "person-1", ...profileFromInput("@Example_Name")! };
  const first = { ...postFromUrl("https://x.com/example_name/status/20")!, person };
  const second = { ...postFromUrl("https://x.com/example_name/status/10")!, person };
  const unlinked = postFromUrl("https://x.com/unconfirmed/status/30")!;
  assert.deepEqual(dedupePeople([first, second, unlinked]), [first, unlinked]);
  assert.equal(dedupePeople([{ ...first, person: null }, { ...second, person: null }]).length, 2);
});

test("already-seeded browsers acquire confirmed authors without restoring removed posts", async () => {
  const { mergeSeeds, SANDBOX_SEEDS } = await import("./people.ts");
  const kept = { ...postFromUrl(SANDBOX_SEEDS[0].url, 2)!, choice: "save" as const, openedAt: 3 };
  const seeded = SANDBOX_SEEDS.map((seed) => postIdFromUrl(seed.url)!);
  const upgraded = mergeSeeds({ posts: [kept], tags: {}, seeded }, 10);
  assert.equal(upgraded.posts.length, 1);
  assert.equal(upgraded.posts[0]?.person?.handle, "kunalsahu20_");
  assert.equal(upgraded.posts[0]?.choice, "save");
  assert.equal(upgraded.posts[0]?.openedAt, 3);
});

import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { dedupePeople, profileFromInput, postFromUrl, postIdFromUrl, postUrl } from "./people.ts";

test("only X post URLs are accepted; URLs cannot become arbitrary outbound targets", () => {
  assert.equal(
    postIdFromUrl("https://x.com/nujhongc/status/2114219937699074213?s=20"),
    "2114219937699074213",
  );
  assert.equal(postIdFromUrl("https://twitter.com/i/web/status/1234"), "1234");
  assert.equal(postIdFromUrl("https://x.com/person/status/1234/photo/1"), "1234");
  for (const url of [
    "https://x.com.evil.test/u/status/1234",
    "https://x.com@evil.test/u/status/1234",
    "http://x.com/u/status/1234",
    "https://x.com:8443/u/status/1234",
    "file:///etc/passwd",
    "https://x.com/user",
    "https://x.com/u/status/abc",
    "https://x.com/u/status/0",
    "https://x.com/u/status/1234/evil",
  ]) {
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

test("X profile links normalize aliases and reject post links or arbitrary targets", () => {
  assert.deepEqual(profileFromInput("@Example_Name"), {
    handle: "Example_Name",
    profileUrl: "https://x.com/example_name",
  });
  assert.deepEqual(
    profileFromInput("https://twitter.com/Example_Name/?s=21"),
    profileFromInput("@Example_Name"),
  );
  for (const value of [
    "https://x.com/a/status/1234",
    "https://x.com/home",
    "https://x.com@evil.test/name",
    "https://x.com.evil.test/name",
    "https://user@x.com/name",
    "https://x.com:8443/name",
    "javascript:alert(1)",
    "@too_long_for_an_x_handle",
  ]) {
    assert.equal(profileFromInput(value), null, value);
  }
});

test("people deduplicate by local identity while unconfirmed post links remain distinct", () => {
  const person = { id: "person-1", ...profileFromInput("@Example_Name")! };
  const first = { ...postFromUrl("https://x.com/example_name/status/20")!, person };
  const second = { ...postFromUrl("https://x.com/example_name/status/10")!, person };
  const unlinked = postFromUrl("https://x.com/unconfirmed/status/30")!;
  assert.deepEqual(dedupePeople([first, second, unlinked]), [first, unlinked]);
  assert.equal(
    dedupePeople([
      { ...first, person: null },
      { ...second, person: null },
    ]).length,
    2,
  );
});

test("a pin leads the eligible deck without duplicating its author or restoring an excluded post", () => {
  const person = { id: "maker", ...profileFromInput("@nujhongc")! };
  const newer = { ...postFromUrl("https://x.com/nujhongc/status/30")!, person };
  const other = postFromUrl("https://x.com/other/status/20")!;
  const pinned = { ...postFromUrl("https://x.com/nujhongc/status/10")!, person };
  const input = [newer, other, pinned];
  assert.deepEqual(dedupePeople(input, pinned.id), [pinned, other]);
  assert.deepEqual(input, [newer, other, pinned], "Ordering does not mutate stored posts");
  assert.deepEqual(dedupePeople([newer, other], pinned.id), [newer, other]);
  assert.deepEqual(dedupePeople([], pinned.id), []);
});

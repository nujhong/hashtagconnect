import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { openXTabs, unopenedTargets } from "./open-tabs.ts";
import type { Person, Post } from "./people.ts";

const person: Person = { id: "person-1", handle: "someone", profileUrl: "https://x.com/someone" };
const post: Post = {
  id: "1234",
  url: "https://x.com/i/status/1234",
  addedAt: 0,
  pooledAt: 0,
  choice: "save",
  openedAt: null,
  person: null,
};

test("bulk targets keep a person once and skip opened or unavailable entries", () => {
  const entries = [
    { person, source: post, openedAt: null },
    { person, source: post, openedAt: null },
    { person: { ...person, id: "visited" }, source: post, openedAt: 1 },
    { person: null, source: post, openedAt: null },
    { person: null, source: null, openedAt: null },
  ];
  assert.deepEqual(unopenedTargets(entries), [{ person }, { post }]);
});

test("only successfully opened tabs are returned for history; the opener is detached before navigation", () => {
  const events: string[] = [];
  let calls = 0;
  const targets = [{ person }, { post }];
  const result = openXTabs(targets, (url, target) => {
    events.push(`open:${url}:${target}`);
    if (++calls === 2) return null;
    const tab = {
      opener: {},
      location: {
        replace(destination: string) {
          assert.equal(tab.opener, null);
          events.push(`navigate:${destination}`);
        },
      },
      close() {},
    };
    return tab as Window;
  });
  assert.deepEqual(result.opened, [{ person }]);
  assert.equal(result.blocked, 1);
  assert.deepEqual(events, [
    "open:about:blank:_blank",
    "navigate:https://x.com/someone",
    "open:about:blank:_blank",
  ]);
});

test("a navigation failure closes the blank tab and leaves that target unopened", () => {
  let closed = false;
  const result = openXTabs([{ post }], () => {
    const tab = {
      opener: {},
      location: {
        replace(_url: string): void {
          throw new Error("blocked");
        },
      },
      close() {
        closed = true;
      },
    };
    return tab as Window;
  });
  assert.equal(closed, true);
  assert.deepEqual(result, { opened: [], blocked: 1 });
});

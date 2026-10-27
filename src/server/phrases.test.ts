import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { profilePhrases } from "./phrases.ts";

test("profiles split into quotable phrases without dropping later details", () => {
  assert.deepEqual(
    profilePhrases({
      bio: "Building local-first desktop apps. Design, small tools and side projects.",
      username: "x",
    }).map((p) => p.text),
    ["Building local-first desktop apps", "Design", "small tools", "side projects"],
  );
  const phrases = profilePhrases({
    bio: "Copywriter for #DTC brands | writing about building in public 🚀 https://t.co/abc @friend",
    username: "x",
    context: "Mostly SaaS & AI tools",
    project: { url: "https://example.com/", summary: "An invoicing app for freelancers." },
  });
  assert.deepEqual(phrases, [
    { text: "Copywriter for DTC brands", source: "bio" },
    { text: "writing about building in public 🚀 https://t.co/abc @friend", source: "bio" },
    { text: "Mostly SaaS", source: "context" },
    { text: "AI tools", source: "context" },
    { text: "An invoicing app for freelancers", source: "project" },
  ]);
  assert.equal(
    profilePhrases({
      bio: "a, b, c, d, e, f, g, h, i".replace(/\w/g, (c) => c + c + " things"),
      username: "x",
    }).length,
    9,
  );
  assert.deepEqual(
    profilePhrases({ bio: "Hi. AI tools, ai tools. 👋", username: "x" }).map((p) => p.text),
    ["Hi", "AI tools"],
  );
});

test("long clauses retain their trailing subject", () => {
  const clause =
    "I work on tools that help people collect their notes from different sources for use with AI models";
  assert.deepEqual(profilePhrases({ bio: clause, username: "x" }), [
    { text: clause, source: "bio" },
  ]);
});

test("handles stay whole in a phrase", () => {
  assert.deepEqual(
    profilePhrases({ bio: "THE dev at @kepler. @maker of tiny tools", username: "x" }).map(
      (p) => p.text,
    ),
    ["THE dev at @kepler", "@maker of tiny tools"],
  );
});

test("links and dotted names stay whole, as the bio shows them", () => {
  assert.deepEqual(
    profilePhrases({ bio: "THE dev at kepler.so. Node.js tinkerer", username: "x" }).map(
      (p) => p.text,
    ),
    ["THE dev at kepler.so", "Node.js tinkerer"],
  );
});

test("a project contributes its topics, not a split-up summary", () => {
  const project = {
    url: "https://kepler.so/",
    summary: "Kepler saves web pages, videos and posts, to use as context for AI models.",
    topics: ["saving web pages", "AI model context"],
  };
  assert.deepEqual(profilePhrases({ bio: "", username: "x", project }), [
    { text: "saving web pages", source: "project" },
    { text: "AI model context", source: "project" },
  ]);
  assert.ok(
    profilePhrases({
      bio: "",
      username: "x",
      project: { url: project.url, summary: project.summary },
    }).some((p) => p.text === "videos"),
  );
});

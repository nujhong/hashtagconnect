import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "void/db";
import * as schema from "~/db/schema.ts";
import {
  enqueueBioProject,
  importBioProject,
  type ProjectImportMessage,
} from "~/server/project-from-bio.ts";
import { ProjectReadError } from "~/server/project-profile.ts";
import { projectImportProgress } from "~/shared/project-profile.ts";

const draft = {
  url: "https://project.example/",
  topics: ["Community workshops"],
  summary: "A tool for organizing community workshops.",
  excerpt: "A tool for organizing community workshops.",
};

test("OAuth queues once; the consumer imports independently of the client and respects manual edits", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      d1Databases: ["DB"],
    }),
  );
  try {
    const binding = await mf.getD1Database("DB");
    const dir = new URL("../../src/db/migrations/", import.meta.url);
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(new URL(file, dir), "utf8")
        .replace(/--[^\n]*/g, "")
        .split(";")
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(";\n");
      await binding.exec(sql);
    }
    const db = drizzle(binding, { schema });
    const row = async (id: string) =>
      (await db.select().from(schema.viewerContext).where(eq(schema.viewerContext.userId, id)))[0];
    const messages: ProjectImportMessage[] = [];
    const send = async (message: ProjectImportMessage) => {
      messages.push(message);
    };
    let reads = 0;
    const read = async (url: string) => {
      reads++;
      assert.equal(url, draft.url);
      return draft;
    };

    await Promise.all(
      [1, 2].map(() =>
        enqueueBioProject(
          db,
          "new-user",
          "Building https://project.example and https://second.example",
          send,
        ),
      ),
    );
    assert.equal(messages.length, 1);
    assert.equal(reads, 0, "The OAuth request enqueues without waiting for a browser/model read");
    assert.equal(projectImportProgress((await row("new-user")).projectImport).status, "pending");
    await importBioProject(db, messages[0], read);
    assert.deepEqual((await row("new-user")).project, {
      url: draft.url,
      summary: draft.summary,
      topics: draft.topics,
    });
    assert.equal(projectImportProgress((await row("new-user")).projectImport).status, "done");
    await importBioProject(db, messages[0], read);
    assert.equal(reads, 1, "Duplicate delivery does not spend another read");
    await enqueueBioProject(db, "new-user", "https://changed.example", send);
    assert.equal(messages.length, 1);
    await db
      .update(schema.viewerContext)
      .set({ project: null, projectImport: null })
      .where(eq(schema.viewerContext.userId, "new-user"));
    await enqueueBioProject(db, "new-user", draft.url, send);
    assert.equal(messages.length, 1, "Removal does not re-import on the next login");

    await enqueueBioProject(db, "no-link", "Building on https://x.com/example", send);
    await enqueueBioProject(db, "no-link", draft.url, send);
    assert.equal(messages.length, 1);
    assert.equal((await row("no-link")).projectImport, null);

    await enqueueBioProject(db, "failed", draft.url, send);
    await importBioProject(db, messages.at(-1)!, async () => {
      throw new ProjectReadError("Couldn’t read the page.");
    });
    assert.deepEqual(projectImportProgress((await row("failed")).projectImport), {
      status: "failed",
      error: "Couldn’t read the page.",
    });
    await importBioProject(db, messages.at(-1)!, read);
    assert.equal(reads, 1, "Failed reads require a manual retry");
    await enqueueBioProject(db, "send-failed", draft.url, async () => {
      throw new Error("queue down");
    });
    assert.equal(projectImportProgress((await row("send-failed")).projectImport).status, "failed");

    const saved = {
      url: "https://edited.example/",
      summary: "The description the member already saved.",
    };
    await db
      .insert(schema.viewerContext)
      .values({ userId: "existing", sentence: "My context", project: saved });
    await enqueueBioProject(db, "existing", draft.url, send);
    assert.deepEqual((await row("existing")).project, saved);
    assert.equal(messages.length, 2);

    await enqueueBioProject(db, "concurrent", draft.url, send);
    let finish!: (value: typeof draft) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = importBioProject(db, messages.at(-1)!, async () => {
      reads++;
      started();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    await ready;
    await importBioProject(db, messages.at(-1)!, read);
    assert.equal(reads, 2);
    // Saving/removing through /api/me/project clears the reservation even when the final project is null.
    await db
      .update(schema.viewerContext)
      .set({ project: saved, projectImport: null, sentence: "Keep my context" })
      .where(eq(schema.viewerContext.userId, "concurrent"));
    await db
      .update(schema.viewerContext)
      .set({ project: null })
      .where(eq(schema.viewerContext.userId, "concurrent"));
    finish(draft);
    await pending;
    assert.equal(
      (await row("concurrent")).project,
      null,
      "A late result cannot restore a removed project",
    );
    assert.equal((await row("concurrent")).sentence, "Keep my context");
  } finally {
    await mf.dispose();
  }
});

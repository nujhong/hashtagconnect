import { and, eq, type DrizzleD1Database } from "void/db";
import { viewerContext } from "../db/schema.ts";
import {
  bioProjectLinks,
  type ProjectDraft,
  type ProjectImport,
} from "../shared/project-profile.ts";
import { BrowserRunBudgetError } from "./browser-run-budget.ts";
import { ProjectReadError } from "./project-profile.ts";

type Database = DrizzleD1Database<typeof import("../db/schema.ts")>;
export type ProjectImportMessage = { userId: string; url: string; startedAt: number };

/** Initialize a private profile once after OAuth. Reserve before publishing; existing contexts are never re-imported. */
export async function enqueueBioProject(
  db: Database,
  userId: string,
  bio: string | null,
  send: (message: ProjectImportMessage) => Promise<unknown>,
) {
  const url = bioProjectLinks(bio)[0];
  const pending: ProjectImport | null = url ? { state: "queued", startedAt: Date.now() } : null;
  const [claimed] = await db
    .insert(viewerContext)
    .values({ userId, sentence: "", projectImport: pending })
    .onConflictDoNothing()
    .returning();
  if (!claimed || !pending || !url) return;
  try {
    await send({ userId, url, startedAt: pending.startedAt });
  } catch {
    await db
      .update(viewerContext)
      .set({
        projectImport: {
          ...pending,
          state: "failed",
          error: "Couldn’t start your project import. You can read the link in Settings.",
        },
      })
      .where(and(eq(viewerContext.userId, userId), eq(viewerContext.projectImport, pending)));
  }
}

/** Consume the reserved read once. Manual edits cancel the reservation and take precedence over a late result. */
export async function importBioProject(
  db: Database,
  message: ProjectImportMessage,
  read: (url: string) => Promise<ProjectDraft>,
) {
  const queued: ProjectImport = { state: "queued", startedAt: message.startedAt };
  const reading: ProjectImport = { ...queued, state: "reading" };
  const [claimed] = await db
    .update(viewerContext)
    .set({ projectImport: reading })
    .where(and(eq(viewerContext.userId, message.userId), eq(viewerContext.projectImport, queued)))
    .returning();
  if (!claimed) return;
  const ownsRead = and(
    eq(viewerContext.userId, message.userId),
    eq(viewerContext.projectImport, reading),
  );
  try {
    const draft = await read(message.url);
    await db
      .update(viewerContext)
      .set({
        project: { url: draft.url, summary: draft.summary, topics: draft.topics },
        projectImport: null,
      })
      .where(ownsRead);
  } catch (error) {
    const reason =
      error instanceof ProjectReadError || error instanceof BrowserRunBudgetError
        ? error.message
        : "Couldn’t read the project in your bio. You can try again in Settings.";
    await db
      .update(viewerContext)
      .set({ projectImport: { ...reading, state: "failed", error: reason } })
      .where(ownsRead);
  }
}

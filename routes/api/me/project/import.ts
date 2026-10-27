import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { viewerContext } from "@schema";
import { projectImportProgress } from "~/src/project-profile";

/** Read-only progress for the session owner. Import work starts only in the OAuth callback. */
export const GET = defineHandler(async (c) => {
  const user = requireAuth(c);
  const [context] = await db.select().from(viewerContext).where(eq(viewerContext.userId, user.id));
  return {
    project: context?.project ?? null,
    ...projectImportProgress(context?.projectImport ?? null),
  };
});

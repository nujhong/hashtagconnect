import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { viewerContext, scanCache } from "@schema";
import { z } from "zod";
import { projectProfileSchema } from "~/src/project-profile";

/** Confirmed text is private self-description; only the session owner can save or remove it. */
export const POST = defineHandler.withValidator({
  body: z.object({ project: projectProfileSchema.nullable() }),
})(async (c, { body }) => {
  const user = requireAuth(c);
  await db.batch([
    db
      .insert(viewerContext)
      .values({ userId: user.id, sentence: "", project: body.project })
      .onConflictDoUpdate({
        target: viewerContext.userId,
        set: { project: body.project, projectImport: null },
      }),
    db.delete(scanCache).where(eq(scanCache.userId, user.id)),
  ]);
  return { project: body.project };
});

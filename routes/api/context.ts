import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { viewerContext, scanCache } from "@schema";
import { z } from "zod";

export const POST = defineHandler.withValidator({ body: z.object({ sentence: z.string().trim().max(280) }) })(async (c, { body }) => {
  const user = requireAuth(c);
  await db.batch([
    db.insert(viewerContext).values({ userId: user.id, sentence: body.sentence }).onConflictDoUpdate({ target: viewerContext.userId, set: { sentence: body.sentence } }),
    db.delete(scanCache).where(eq(scanCache.userId, user.id)),
  ]);
  return { sentence: body.sentence };
});

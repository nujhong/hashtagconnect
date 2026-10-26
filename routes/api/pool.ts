import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { posts } from "@schema";
import { z } from "zod";
import { listPosts, requireCurator } from "../../src/server/discovery";

export const DELETE = defineHandler.withValidator({ body: z.object({ postId: z.string().regex(/^[1-9]\d{0,24}$/) }) })(async (c, { body }) => {
  const user = requireAuth(c);
  await requireCurator(user);
  // Removing a post also removes its private post references through the foreign key; saved people remain.
  await db.delete(posts).where(eq(posts.id, body.postId));
  return listPosts(user.id);
});

import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db } from "void/db";
import { personStates, postStates } from "@schema";
import { z } from "zod";
import { listPosts, resolveTarget } from "~/src/server/discovery";

const target = z.union([
  z
    .object({
      postId: z.string().regex(/^[1-9]\d{0,24}$/),
      choice: z.enum(["save", "skip"]).nullable(),
    })
    .strict(),
  z.object({ personId: z.string().uuid(), choice: z.enum(["save", "skip"]).nullable() }).strict(),
]);

import { milestone } from "~/src/server/funnel";

export const POST = defineHandler.withValidator({ body: target })(async (c, { body }) => {
  const user = requireAuth(c);
  const resolved = await resolveTarget(user.id, body);
  const updatedAt = Date.now();
  if (resolved.personId) {
    const mutation = db
      .insert(personStates)
      .values({
        userId: user.id,
        personId: resolved.personId,
        sourcePostId: resolved.postId,
        choice: body.choice,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [personStates.userId, personStates.personId],
        set: {
          choice: body.choice,
          updatedAt,
          ...("postId" in body ? { sourcePostId: resolved.postId } : {}),
        },
      });
    if (body.choice === "save") await db.batch([mutation, milestone(user.id, "keep")]);
    else await mutation;
  } else {
    const mutation = db
      .insert(postStates)
      .values({ userId: user.id, postId: resolved.postId!, choice: body.choice, updatedAt })
      .onConflictDoUpdate({
        target: [postStates.userId, postStates.postId],
        set: { choice: body.choice, updatedAt },
      });
    if (body.choice === "save") await db.batch([mutation, milestone(user.id, "keep")]);
    else await mutation;
  }
  return listPosts(user.id);
});

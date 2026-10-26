import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db } from "void/db";
import { personStates, postStates } from "@schema";
import { listPosts, resolveTarget, stateTarget } from "../../src/server/discovery";

export const POST = defineHandler.withValidator({ body: stateTarget })(async (c, { body }) => {
  const user = requireAuth(c);
  const resolved = await resolveTarget(user.id, body);
  const openedAt = Date.now();
  if (resolved.personId) {
    await db.insert(personStates).values({ userId: user.id, personId: resolved.personId, sourcePostId: resolved.postId, openedAt, updatedAt: openedAt })
      .onConflictDoUpdate({ target: [personStates.userId, personStates.personId], set: { openedAt, updatedAt: openedAt } });
  } else {
    await db.insert(postStates).values({ userId: user.id, postId: resolved.postId!, openedAt, updatedAt: openedAt })
      .onConflictDoUpdate({ target: [postStates.userId, postStates.postId], set: { openedAt, updatedAt: openedAt } });
  }
  return { openedAt, ...await listPosts(user.id) };
});

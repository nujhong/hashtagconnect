import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { personStates, postStates } from "@schema";

/** Clear only the session owner's choices and opened history. */
export const DELETE = defineHandler(async (c) => {
  const user = requireAuth(c);
  await db.batch([
    db.delete(personStates).where(eq(personStates.userId, user.id)),
    db.delete(postStates).where(eq(postStates.userId, user.id)),
  ]);
  return { ok: true };
});

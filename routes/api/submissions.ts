import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { submissions } from "@schema";
import { submissionInput } from "../../src/submission";

export const GET = defineHandler(async (c) => {
  const user = requireAuth(c);
  const [submission] = await db.select().from(submissions).where(eq(submissions.userId, user.id));
  return { submission: submission ?? null };
});

export const POST = defineHandler.withValidator({ body: submissionInput })(async (c, { body }) => {
  const user = requireAuth(c);
  const values = { ...body, status: "pending" as const, version: crypto.randomUUID(), updatedAt: Date.now() };
  const [submission] = await db.insert(submissions).values({ ...values, id: crypto.randomUUID(), userId: user.id })
    .onConflictDoUpdate({ target: submissions.userId, set: values }).returning();
  return { submission: submission! };
});

import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { and, db, eq, asc, sql } from "void/db";
import { submissions, funnel } from "@schema";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { importPost, requireCurator } from "../../src/server/discovery";
import { curatorTags } from "../../src/submission";

export const GET = defineHandler(async (c) => {
  await requireCurator(requireAuth(c));
  const pending = await db.select().from(submissions).where(eq(submissions.status, "pending")).orderBy(asc(submissions.updatedAt)).limit(100);
  const [metrics] = await db.select({
    visitors: sql<number>`count(${funnel.firstVisitDay})`,
    kept: sql<number>`count(${funnel.firstKeepAt})`,
    opened: sql<number>`count(${funnel.firstOpenAt})`,
    returned: sql<number>`coalesce(sum(case when ${funnel.activeDays} > 1 then 1 else 0 end), 0)`,
    useful: sql<number>`coalesce(sum(case when ${funnel.feedback} = 1 then 1 else 0 end), 0)`,
    responses: sql<number>`count(${funnel.feedback})`,
  }).from(funnel);
  return { pending, metrics: metrics! };
});

export const POST = defineHandler.withValidator({ body: z.object({
  id: z.string().uuid(), version: z.string().uuid(), action: z.enum(["publish", "decline"]),
  confirmed: z.boolean().default(false), tags: curatorTags.default([]),
}) })(async (c, { body }) => {
  const user = requireAuth(c);
  await requireCurator(user);
  const condition = and(eq(submissions.id, body.id), eq(submissions.version, body.version), eq(submissions.status, "pending"));
  const [submission] = await db.select().from(submissions).where(condition);
  if (!submission) throw new HTTPException(409, { message: "This submission changed. Refresh the review list." });
  if (body.action === "publish") {
    if (!body.confirmed) throw new HTTPException(400, { message: "Check the author and connection intent on X before publishing." });
    await importPost(user.id, submission.postUrl, true, { profileUrl: submission.profileUrl, confirmed: true }, body.tags);
  }
  // A concurrent edit becomes a new pending version; never mark that unreviewed version as published.
  await db.update(submissions).set({ status: body.action === "publish" ? "published" : "declined" }).where(condition);
  return { ok: true };
});

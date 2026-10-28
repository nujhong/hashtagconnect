import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, sql } from "void/db";
import { funnel } from "@schema";
import { z } from "zod";

export const POST = defineHandler.withValidator({
  body: z.discriminatedUnion("event", [
    z.object({ event: z.literal("visit") }),
    z.object({ event: z.literal("feedback"), useful: z.boolean() }),
  ]),
})(async (c, { body }) => {
  const user = requireAuth(c);
  if (body.event === "feedback") {
    await db
      .insert(funnel)
      .values({ userId: user.id, feedback: body.useful })
      .onConflictDoUpdate({ target: funnel.userId, set: { feedback: body.useful } });
  } else {
    const day = new Date().toISOString().slice(0, 10);
    await db
      .insert(funnel)
      .values({ userId: user.id, firstVisitDay: day, lastVisitDay: day, activeDays: 1 })
      .onConflictDoUpdate({
        target: funnel.userId,
        set: {
          firstVisitDay: sql`coalesce(${funnel.firstVisitDay}, ${day})`,
          lastVisitDay: day,
          activeDays: sql`${funnel.activeDays} + case when ${funnel.lastVisitDay} = ${day} then 0 else 1 end`,
        },
      });
  }
  return { ok: true };
});

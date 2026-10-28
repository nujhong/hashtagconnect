import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db } from "void/db";
import { z } from "zod";
import { mergeGuestState } from "~/server/guest-state";

const body = z
  .object({
    entries: z
      .array(
        z
          .object({
            postId: z.string().regex(/^[1-9]\d{0,24}$/),
            choice: z.enum(["save", "skip"]).nullable(),
            openedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export const POST = defineHandler.withValidator({ body })(async (c, { body }) => {
  await mergeGuestState(db, requireAuth(c).id, body.entries);
  return { ok: true };
});

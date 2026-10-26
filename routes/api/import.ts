import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { z } from "zod";
import { importPost, requireCurator } from "../../src/server/discovery";

export const POST = defineHandler.withValidator({ body: z.object({
  url: z.string().max(500),
  destination: z.enum(["queue", "pool"]).default("queue"),
  profileUrl: z.string().max(200).optional(),
  profileConfirmed: z.boolean().optional(),
}) })(async (c, { body }) => {
  const user = requireAuth(c);
  if (body.destination === "pool") await requireCurator(user);
  return importPost(user.id, body.url, body.destination === "pool", body.profileUrl ? {
    profileUrl: body.profileUrl, confirmed: body.profileConfirmed === true,
  } : undefined);
});

import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { z } from "zod";
import { requireCurator, updatePerson } from "../../src/server/discovery";

export const PATCH = defineHandler.withValidator({ body: z.object({
  personId: z.string().uuid(), profileUrl: z.string().max(200),
}) })(async (c, { body }) => {
  const user = requireAuth(c);
  await requireCurator(user);
  return updatePerson(user.id, body.personId, body.profileUrl);
});

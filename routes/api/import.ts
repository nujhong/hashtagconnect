import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { z } from "zod";
import { savePost } from "../../src/server/discovery";

export const POST = defineHandler.withValidator({ body: z.object({ url: z.string().max(500) }).strict() })(async (c, { body }) => {
  return savePost(requireAuth(c).id, body.url);
});

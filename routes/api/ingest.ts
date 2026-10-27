import { defineHandler } from "void";
import { env } from "void/env";
import { bodyLimit } from "hono/body-limit";
import { ingestionAuth, ingestionBody, poolPostSQL } from "../../src/server/ingestion";
import { postUrl } from "../../src/people";

export const POST = defineHandler(
  ingestionAuth(() => env.INGESTION_TOKEN),
  bodyLimit({ maxSize: 64 * 1024 }),
  defineHandler.withValidator({ body: ingestionBody })(async (c, { body }) => {
    const ids = [...new Set(body.urls)];
    const now = Date.now();
    await c.env.DB.batch(ids.map((id) => c.env.DB.prepare(poolPostSQL).bind(id, postUrl(id), now, now)));
    return { accepted: ids.length, ids };
  }),
);

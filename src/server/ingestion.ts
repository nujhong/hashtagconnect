import { bearerAuth } from "hono/bearer-auth";
import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { postIdFromUrl } from "../people.ts";

export const ingestionBody = z.object({
  urls: z.array(z.string().max(500).transform((url, ctx) => {
    const id = postIdFromUrl(url);
    if (id) return id;
    ctx.addIssue({ code: "custom", message: "Expected an HTTPS X or Twitter post URL." });
    return z.NEVER;
  })).min(1).max(100),
}).strict();

/** Only the service secret grants pool writes; viewer cookies grant no ingestion access. */
export function ingestionAuth(getToken: () => string | undefined): MiddlewareHandler {
  return async (c, next) => {
    const token = getToken();
    if (!token) throw new HTTPException(503, { message: "Ingestion is not configured." });
    return bearerAuth({ token })(c, next);
  };
}

/** Promote private posts without replacing author links, tags, original dates or viewer state. */
export const poolPostSQL = `INSERT INTO posts (id, url, added_at, pooled_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET pooled_at = coalesce(posts.pooled_at, excluded.pooled_at)`;

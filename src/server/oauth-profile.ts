import { createAuthMiddleware } from "better-auth/api";

/** Only a successful X callback schedules enrichment; a failed callback or session read cannot start it. */
export function bioProjectAfterOAuth(
  enqueue: (userId: string, bio: string | null) => Promise<unknown>,
) {
  return createAuthMiddleware(async (ctx) => {
    const user = ctx.context.newSession?.user;
    if (!ctx.path.startsWith("/callback/") || ctx.params?.id !== "twitter" || !user) return;
    try {
      await enqueue(user.id, "xBio" in user && typeof user.xBio === "string" ? user.xBio : null);
    } catch {
      console.warn("profile.import_enqueue_failed");
    }
  });
}

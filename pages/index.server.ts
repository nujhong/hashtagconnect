import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { db, eq } from "void/db";
import { viewerContext, funnel } from "@schema";
import { env } from "void/env";
import { isCurator, listPosts } from "../src/server/discovery";
import { scanAvailability } from "../src/server/scan-setup";

export type Props = InferProps<typeof loader>;
export const loader = defineHandler(async () => {
  const user = getUser();
  const [context] = user ? await db.select().from(viewerContext).where(eq(viewerContext.userId, user.id)) : [];
  const [activity] = user ? await db.select({ feedback: funnel.feedback, firstOpenAt: funnel.firstOpenAt }).from(funnel).where(eq(funnel.userId, user.id)) : [];
  const bio = user && "xBio" in user && typeof user.xBio === "string" ? user.xBio : null;
  return {
    context: context?.sentence ?? "",
    bio,
    feedback: activity?.feedback ?? null,
    hasOpened: Boolean(activity?.firstOpenAt),
    ...(user ? await listPosts(user.id) : { posts: [], people: [] }),
    user: user ? {
      name: user.name, image: user.image,
      username: "xUsername" in user && typeof user.xUsername === "string" ? user.xUsername : null,
    } : null,
    curator: user ? await isCurator(user) : false,
    authReady: Boolean(env.AUTH_TWITTER_CLIENT_ID && env.AUTH_TWITTER_CLIENT_SECRET),
    scanPolicy: scanAvailability(env, undefined, import.meta.env.PROD),
    scanAvailability: scanAvailability(env, user ? (bio?.trim() || context?.sentence || bio) : undefined, import.meta.env.PROD),
  };
});

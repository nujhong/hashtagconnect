import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { env } from "void/env";
import { isCurator, listPosts } from "../src/server/discovery";
import { scanAvailability } from "../src/server/scan-setup";

export type Props = InferProps<typeof loader>;
export const loader = defineHandler(async () => {
  const user = getUser();
  return {
    ...(user ? await listPosts(user.id) : { posts: [], people: [] }),
    user: user ? {
      name: user.name, image: user.image,
      username: "xUsername" in user && typeof user.xUsername === "string" ? user.xUsername : null,
    } : null,
    curator: user ? await isCurator(user) : false,
    authReady: Boolean(env.AUTH_TWITTER_CLIENT_ID && env.AUTH_TWITTER_CLIENT_SECRET),
    scanPolicy: scanAvailability(env),
    scanAvailability: scanAvailability(env, user ? ("xBio" in user && typeof user.xBio === "string" ? user.xBio : null) : undefined),
  };
});

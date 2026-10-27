import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { db, eq } from "void/db";
import { viewerContext, funnel } from "@schema";
import { env } from "void/env";
import { listPosts } from "~/src/server/discovery";
import { projectImportProgress } from "~/src/project-profile";
import { scanAvailability } from "~/src/server/scan-setup";

export type Props = InferProps<typeof loader>;
export const loader = defineHandler(async () => {
  const user = getUser();
  const [context] = user
    ? await db.select().from(viewerContext).where(eq(viewerContext.userId, user.id))
    : [];
  const [activity] = user
    ? await db
        .select({ feedback: funnel.feedback, firstOpenAt: funnel.firstOpenAt })
        .from(funnel)
        .where(eq(funnel.userId, user.id))
    : [];
  const bio = user && "xBio" in user && typeof user.xBio === "string" ? user.xBio : null;
  return {
    projectImport: projectImportProgress(context?.projectImport ?? null),
    context: context?.sentence ?? "",
    bio,
    project: context?.project ?? null,
    feedback: activity?.feedback ?? null,
    hasOpened: Boolean(activity?.firstOpenAt),
    ...(await listPosts(user?.id)),
    user: user
      ? {
          name: user.name,
          image: user.image,
          username:
            "xUsername" in user && typeof user.xUsername === "string" ? user.xUsername : null,
        }
      : null,
    authReady: Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET),
    scanPolicy: scanAvailability(env, undefined),
    scanAvailability: scanAvailability(
      env,
      user ? bio?.trim() || context?.sentence || context?.project?.summary || bio : undefined,
    ),
  };
});

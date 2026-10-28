import { defineAuth } from "void/auth";
import { db } from "void/db";
import { queues } from "void/queues";
import { enqueueBioProject } from "./server/project-from-bio.ts";
import { bioProjectAfterOAuth } from "./server/oauth-profile.ts";
import { getXUserInfo } from "./server/x-oauth.ts";

export default defineAuth(({ defaults, env }) => ({
  ...defaults,
  appName: "hashtagconnect",
  hooks: {
    ...defaults.hooks,
    after: bioProjectAfterOAuth((userId, bio) =>
      enqueueBioProject(db, userId, bio, (message) =>
        queues["hashtagconnect-project-import"].send(message),
      ),
    ),
  },
  emailAndPassword: { enabled: false },
  // Better Auth applies input filtering to provider profiles too; profile edits are disabled instead.
  disabledPaths: [...(defaults.disabledPaths ?? []), "/update-user"],
  // Expired or missing OAuth state lands on the app's own sign-in error sheet, not /api/auth/error.
  onAPIError: { ...defaults.onAPIError, errorURL: "/?auth=failed" },
  user: {
    ...defaults.user,
    additionalFields: {
      xUsername: { type: "string", required: false },
      xAccountId: { type: "string", required: false },
      xBio: { type: "string", required: false },
    },
  },
  account: { ...defaults.account, encryptOAuthTokens: true },
  socialProviders:
    typeof env.X_CLIENT_ID === "string" &&
    typeof env.X_CLIENT_SECRET === "string" &&
    env.X_CLIENT_ID &&
    env.X_CLIENT_SECRET
      ? {
          twitter: {
            clientId: env.X_CLIENT_ID,
            clientSecret: env.X_CLIENT_SECRET,
            disableDefaultScope: true,
            scope: ["tweet.read", "users.read"],
            getUserInfo: getXUserInfo,
            overrideUserInfoOnSignIn: true,
          },
        }
      : {},
}));

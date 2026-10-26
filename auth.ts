import { defineAuth } from "void/auth";
import { getXUserInfo } from "./src/server/x-oauth.ts";

export default defineAuth(({ defaults, env }) => ({
  ...defaults,
  appName: "hashtagconnect",
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
    env.AUTH_TWITTER_CLIENT_ID && env.AUTH_TWITTER_CLIENT_SECRET
      ? {
          twitter: {
            clientId: String(env.AUTH_TWITTER_CLIENT_ID),
            clientSecret: String(env.AUTH_TWITTER_CLIENT_SECRET),
            disableDefaultScope: true,
            scope: ["tweet.read", "users.read"],
            getUserInfo: getXUserInfo,
            overrideUserInfoOnSignIn: true,
          },
        }
      : {},
}));

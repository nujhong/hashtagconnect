import { defineEnv, string } from "void/env";

export default defineEnv({
  X_CLIENT_ID: string(),
  X_CLIENT_SECRET: string(),
  CLOUDFLARE_ACCOUNT_ID: string(),
  CLOUDFLARE_AI_GATEWAY_ID: string(),
  CLOUDFLARE_AI_GATEWAY_TOKEN: string(),
});

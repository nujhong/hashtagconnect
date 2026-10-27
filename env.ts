import { defineEnv, string } from "void/env";

export default defineEnv({
  X_CLIENT_ID: string().optional(),
  X_CLIENT_SECRET: string().optional(),
  CLOUDFLARE_ACCOUNT_ID: string().optional(),
  CLOUDFLARE_AI_GATEWAY_ID: string().optional(),
  CLOUDFLARE_AI_GATEWAY_TOKEN: string().optional(),
});

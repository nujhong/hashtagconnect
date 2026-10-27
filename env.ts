import { defineEnv, number, string } from "void/env";

export default defineEnv({
  INGESTION_TOKEN: string().optional(),
  AUTH_TWITTER_CLIENT_ID: string().optional(),
  AUTH_TWITTER_CLIENT_SECRET: string().optional(),
  CLOUDFLARE_ACCOUNT_ID: string().optional(),
  CLOUDFLARE_GATEWAY_ID: string().optional(),
  CF_AIG_TOKEN: string().optional(),
  CF_WORKERS_AI_TOKEN: string().optional(),
  // Optional shared daily request cap; omit for unlimited attempts, or set 0 to pause scans.
  SCAN_DAILY_LIMIT: number().optional(),
  // Production requires an explicit positive cache lifetime (seconds); local scans stay fresh.
  SCAN_CACHE_TTL_SECONDS: number().optional(),
});

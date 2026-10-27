import type { ScanAvailability } from "../scan-contract.ts";
import type { JevConfig } from "./jev.ts";

type ScanEnvironment = {
  CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_GATEWAY_ID?: string;
  CF_WORKERS_AI_TOKEN?: string; CF_AIG_TOKEN?: string;
  SCAN_DAILY_LIMIT?: number; SCAN_CACHE_TTL_SECONDS?: number;
};
type ScanSetup = { status: "unavailable"; reason: string } |
  { status: "ready"; jev: JevConfig; dailyLimit: number | null; cacheTtlSeconds: number };

/** The page and API use the same prerequisite check; no external requests or allowance reservations. */
export function scanSetup(env: ScanEnvironment, production = false): ScanSetup {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_GATEWAY_ID: gatewayId,
    CF_WORKERS_AI_TOKEN: apiToken, CF_AIG_TOKEN: gatewayToken } = env;
  if (!accountId || !gatewayId || !apiToken || !gatewayToken) {
    return { status: "unavailable", reason: "The profile analysis service hasn’t been connected yet." };
  }
  const dailyLimit = env.SCAN_DAILY_LIMIT === undefined ? null : Math.floor(env.SCAN_DAILY_LIMIT);
  if (dailyLimit !== null && (!Number.isSafeInteger(dailyLimit) || dailyLimit <= 0)) return { status: "unavailable", reason: "Profile scans are paused." };
  const cacheTtlSeconds = production ? env.SCAN_CACHE_TTL_SECONDS : 0;
  if (production && (dailyLimit === null || !Number.isSafeInteger(cacheTtlSeconds) || !cacheTtlSeconds || cacheTtlSeconds < 0)) {
    return { status: "unavailable", reason: "Scans are paused until the production allowance and cache lifetime are configured." };
  }
  return { status: "ready", jev: { accountId, gatewayId, apiToken, gatewayToken }, dailyLimit, cacheTtlSeconds: cacheTtlSeconds ?? 0 };
}

/** Only this public projection belongs in page props, never the ready server configuration. */
export function scanAvailability(env: ScanEnvironment, bio?: string | null, production = false): ScanAvailability {
  const setup = scanSetup(env, production);
  if (setup.status !== "ready") return setup;
  if (bio === null) return { status: "needs_bio", reason: "Refresh your X sign-in once to bring in your bio." };
  if (bio !== undefined && !bio.trim()) return { status: "empty_bio", reason: "Add a project link to give scans some context, or update your X bio and sign in again." };
  return { status: "ready", dailyLimit: setup.dailyLimit };
}

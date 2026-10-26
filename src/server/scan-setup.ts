import type { ScanAvailability } from "../scan-contract.ts";
import type { JevConfig } from "./jev.ts";

type ScanEnvironment = {
  CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_GATEWAY_ID?: string;
  CF_WORKERS_AI_TOKEN?: string; CF_AIG_TOKEN?: string;
  SCAN_DAILY_LIMIT?: number;
};
type ScanSetup = { status: "unavailable"; reason: string } |
  { status: "ready"; jev: JevConfig; dailyLimit: number | null };

/** The page and API use the same prerequisite check; no external requests or allowance reservations. */
export function scanSetup(env: ScanEnvironment): ScanSetup {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_GATEWAY_ID: gatewayId,
    CF_WORKERS_AI_TOKEN: apiToken, CF_AIG_TOKEN: gatewayToken } = env;
  if (!accountId || !gatewayId || !apiToken || !gatewayToken) {
    return { status: "unavailable", reason: "The profile analysis service hasn’t been connected yet." };
  }
  const dailyLimit = env.SCAN_DAILY_LIMIT === undefined ? null : Math.floor(env.SCAN_DAILY_LIMIT);
  if (dailyLimit !== null && (!Number.isFinite(dailyLimit) || dailyLimit <= 0)) return { status: "unavailable", reason: "Profile scans are paused." };
  return { status: "ready", jev: { accountId, gatewayId, apiToken, gatewayToken }, dailyLimit };
}

/** Only this public projection belongs in page props, never the ready server configuration. */
export function scanAvailability(env: ScanEnvironment, bio?: string | null): ScanAvailability {
  const setup = scanSetup(env);
  if (setup.status !== "ready") return setup;
  if (bio === null) return { status: "needs_bio", reason: "Refresh your X sign-in once to bring in your bio." };
  if (bio !== undefined && !bio.trim()) return { status: "empty_bio", reason: "X returned an empty bio for this account. Use an X account with a bio, or update it on X before refreshing." };
  return { status: "ready", dailyLimit: setup.dailyLimit };
}

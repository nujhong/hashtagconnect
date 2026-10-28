import type { ScanAvailability } from "~/shared/scan-contract.ts";
import type { AiGatewayConfig } from "./clef.ts";

type ScanEnvironment = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_GATEWAY_ID?: string;
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
};
type ScanSetup =
  | { status: "unavailable"; reason: string }
  | { status: "ready"; inference: AiGatewayConfig };

/** The page and API use the same prerequisite check; no external requests. */
export function scanSetup(env: ScanEnvironment): ScanSetup {
  const {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_AI_GATEWAY_ID: gatewayId,
    CLOUDFLARE_AI_GATEWAY_TOKEN: apiToken,
  } = env;
  if (!accountId || !gatewayId || !apiToken) {
    return {
      status: "unavailable",
      reason: "The profile analysis service hasn’t been connected yet.",
    };
  }
  return { status: "ready", inference: { accountId, gatewayId, apiToken } };
}

/** Only this public projection belongs in page props, never the ready server configuration. */
export function scanAvailability(env: ScanEnvironment, bio?: string | null): ScanAvailability {
  const setup = scanSetup(env);
  if (setup.status !== "ready") return setup;
  if (bio === null)
    return { status: "needs_bio", reason: "Refresh your X sign-in once to bring in your bio." };
  if (bio !== undefined && !bio.trim())
    return {
      status: "empty_bio",
      reason:
        "Add a project link to give scans some context, or update your X bio and sign in again.",
    };
  return { status: "ready" };
}

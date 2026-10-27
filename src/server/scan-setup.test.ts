import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { scanAvailability, scanSetup } from "./scan-setup.ts";
const config = {
  accountId: "test-account",
  gatewayId: "test-gateway",
  apiToken: "test-inference",
};
const configured = {
  CLOUDFLARE_ACCOUNT_ID: config.accountId,
  CLOUDFLARE_AI_GATEWAY_ID: config.gatewayId,
  CLOUDFLARE_AI_GATEWAY_TOKEN: config.apiToken,
};

test("readiness needs model configuration and a bio, never an X bearer token", () => {
  assert.deepEqual(scanAvailability(configured), { status: "ready" });
  assert.deepEqual(scanAvailability(configured, "Building web tools."), { status: "ready" });
  assert.equal(scanAvailability(configured, null).status, "needs_bio");
  assert.equal(scanAvailability(configured, "  ").status, "empty_bio");
  assert.equal(
    scanSetup({ ...configured, CLOUDFLARE_AI_GATEWAY_TOKEN: undefined }).status,
    "unavailable",
  );
  const setup = scanSetup(configured);
  assert.equal(setup.status, "ready");
  if (setup.status === "ready") assert.deepEqual(setup.jev, config);
});

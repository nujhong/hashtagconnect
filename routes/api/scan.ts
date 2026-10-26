import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, sql } from "void/db";
import { env } from "void/env";
import { scanUsage } from "@schema";
import { z } from "zod";
import { requirePostAccess } from "../../src/server/discovery";
import { evaluateProfiles } from "../../src/server/jev";
import { loadPublicEvidence, XEvidenceError } from "../../src/server/x-evidence";
import type { ScanResult } from "../../src/scan-contract";
import { xAccountId } from "../../src/server/x-identity";
import { scanAvailability, scanSetup } from "../../src/server/scan-setup";

export const POST = defineHandler.withValidator({ body: z.object({ postId: z.string().regex(/^[1-9]\d{0,24}$/) }) })(async (c, { body }): Promise<ScanResult> => {
  const user = requireAuth(c);
  await requirePostAccess(user.id, body.postId);
  const setup = scanSetup(env);
  if (setup.status === "unavailable") return { ...setup, pauseAuto: true };
  const viewerId = await xAccountId(user.id);
  if (!viewerId) return { status: "unavailable", reason: "Sign in with X again to connect your profile.", pauseAuto: true };
  const bio = "xBio" in user && typeof user.xBio === "string" ? user.xBio : null;
  const available = scanAvailability(env, bio);
  if (available.status !== "ready") return available;
  if (bio === null) return { status: "needs_bio", reason: "Refresh your X sign-in to bring in your bio." };
  const username = "xUsername" in user && typeof user.xUsername === "string" ? user.xUsername : "";
  const day = new Date().toISOString().slice(0, 10);
  // Count every attempt; when configured, enforce the cap in the same atomic reservation.
  const reserved = await db.insert(scanUsage).values({ day, attempts: 1 }).onConflictDoUpdate({
    target: scanUsage.day, set: { attempts: sql`${scanUsage.attempts} + 1` },
    setWhere: setup.dailyLimit === null ? undefined : sql`${scanUsage.attempts} < ${setup.dailyLimit}`,
  }).returning({ attempts: scanUsage.attempts });
  if (!reserved.length) return { status: "unavailable", reason: "Today’s scan allowance is used up. Try again tomorrow.", pauseAuto: true };
  try {
    const evidence = await loadPublicEvidence(body.postId, { bio, username });
    return await evaluateProfiles(setup.jev, evidence);
  } catch (error) {
    return { status: "unavailable", reason: error instanceof XEvidenceError ? error.message : "The profile scan couldn’t finish. Try again later.", pauseAuto: !(error instanceof XEvidenceError) };
  }
});

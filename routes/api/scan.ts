import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { and, db, eq, gt, sql } from "void/db";
import { env } from "void/env";
import { scanUsage, scanCache, viewerContext } from "@schema";
import { z } from "zod";
import { requirePostAccess } from "../../src/server/discovery";
import { evaluateProfiles } from "../../src/server/jev";
import { loadPublicEvidence, XEvidenceError } from "../../src/server/x-evidence";
import type { ScanResult } from "../../src/scan-contract";
import { xAccountId } from "../../src/server/x-identity";
import { scanAvailability, scanSetup } from "../../src/server/scan-setup";

import { scanInputHash } from "../../src/server/scan-cache-key";

export const POST = defineHandler.withValidator({ body: z.object({ postId: z.string().regex(/^[1-9]\d{0,24}$/) }) })(async (c, { body }): Promise<ScanResult> => {
  const user = requireAuth(c);
  await requirePostAccess(user.id, body.postId);
  const setup = scanSetup(env, import.meta.env.PROD);
  if (setup.status === "unavailable") return { ...setup, pauseAuto: true };
  const viewerId = await xAccountId(user.id);
  if (!viewerId) return { status: "unavailable", reason: "Sign in with X again to connect your profile.", pauseAuto: true };
  const bio = "xBio" in user && typeof user.xBio === "string" ? user.xBio : null;
  const [context] = await db.select().from(viewerContext).where(eq(viewerContext.userId, user.id));
  const sentence = context?.sentence || undefined;
  const available = scanAvailability(env, bio?.trim() || sentence || bio, import.meta.env.PROD);
  if (available.status !== "ready") return available;

  const username = "xUsername" in user && typeof user.xUsername === "string" ? user.xUsername : "";
  try {
    // Fetch oEmbed before checking the hash: changes or removal on X must not return stale evidence.
    const evidence = await loadPublicEvidence(body.postId, { bio: bio ?? "", username });
    evidence.viewer.context = sentence;
    const inputHash = await scanInputHash(evidence);
    if (setup.cacheTtlSeconds) {
      const [cached] = await db.select().from(scanCache).where(and(
        eq(scanCache.userId, user.id), eq(scanCache.postId, body.postId), eq(scanCache.inputHash, inputHash), gt(scanCache.expiresAt, Date.now()),
      ));
      if (cached) return cached.result;
    }
    const day = new Date().toISOString().slice(0, 10);
    // Atomic reservation includes failed inference attempts; cached results consume no allowance.
    const reserved = await db.insert(scanUsage).values({ day, attempts: 1 }).onConflictDoUpdate({
      target: scanUsage.day, set: { attempts: sql`${scanUsage.attempts} + 1` },
      setWhere: setup.dailyLimit === null ? undefined : sql`${scanUsage.attempts} < ${setup.dailyLimit}`,
    }).returning({ attempts: scanUsage.attempts });
    if (!reserved.length) return { status: "unavailable", reason: "Today’s scan allowance is used up. Try again tomorrow.", pauseAuto: true };
    const result = await evaluateProfiles(setup.jev, evidence);
    if (setup.cacheTtlSeconds && (result.status === "ok" || result.status === "not_enough_data")) {
      const values = { inputHash, result, expiresAt: Date.now() + setup.cacheTtlSeconds * 1000 };
      await db.insert(scanCache).values({ userId: user.id, postId: body.postId, ...values })
        .onConflictDoUpdate({ target: [scanCache.userId, scanCache.postId], set: values });
    }
    return result;
  } catch (error) {
    return { status: "unavailable", reason: error instanceof XEvidenceError ? error.message : "The profile scan couldn’t finish. Try again later.", pauseAuto: !(error instanceof XEvidenceError) };
  }
});

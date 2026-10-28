import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { and, db, eq } from "void/db";
import { env } from "void/env";
import { scanCache, viewerContext } from "@schema";
import { z } from "zod";
import { requirePostAccess } from "~/server/discovery";
import { reserveBrowserRun } from "~/server/browser-run-budget";
import { capturePostLayout } from "~/server/post-layout";
import { evaluateProfiles, locateEvidence } from "~/server/clef";
import { loadPublicEvidence, XEvidenceError } from "~/server/x-evidence";
import type { ScanResult } from "~/shared/scan-contract";
import { xAccountId } from "~/server/x-identity";
import { scanAvailability, scanSetup } from "~/server/scan-setup";

import { scanInputHash } from "~/server/scan-cache-key";

export const POST = defineHandler.withValidator({
  body: z.object({ postId: z.string().regex(/^[1-9]\d{0,24}$/) }),
})(async (c, { body }): Promise<ScanResult> => {
  const user = requireAuth(c);
  await requirePostAccess(user.id, body.postId);
  const setup = scanSetup(env);
  if (setup.status === "unavailable") return { ...setup, pauseAuto: true };
  const viewerId = await xAccountId(user.id);
  if (!viewerId)
    return {
      status: "unavailable",
      reason: "Sign in with X again to connect your profile.",
      pauseAuto: true,
    };
  const bio = "xBio" in user && typeof user.xBio === "string" ? user.xBio : null;
  const [context] = await db.select().from(viewerContext).where(eq(viewerContext.userId, user.id));
  const sentence = context?.sentence || undefined;
  const available = scanAvailability(
    env,
    bio?.trim() || sentence || context?.project?.summary || bio,
  );
  if (available.status !== "ready") return available;

  const username = "xUsername" in user && typeof user.xUsername === "string" ? user.xUsername : "";
  try {
    // Fetch oEmbed before checking the hash: changes or removal on X must not return stale evidence.
    const evidence = await loadPublicEvidence(body.postId, { bio: bio ?? "", username });
    evidence.viewer.context = sentence;
    evidence.viewer.project = context?.project ?? undefined;
    const inputHash = await scanInputHash(evidence);
    const [cached] = await db
      .select()
      .from(scanCache)
      .where(
        and(
          eq(scanCache.userId, user.id),
          eq(scanCache.postId, body.postId),
          eq(scanCache.inputHash, inputHash),
        ),
      );
    if (cached) return cached.result;
    // The widget layout is measured while the text request runs; strong phrases are then matched to body lines.
    const capture = reserveBrowserRun(db)
      .then(() => capturePostLayout(c.env.BROWSER, body.postId))
      .catch(() => {
        console.warn("scan.post_layout_unavailable", { postId: body.postId });
        return undefined;
      });
    let result = await evaluateProfiles(setup.inference, evidence);
    const layout = await capture;
    if (result.status === "ok" && layout)
      result = await locateEvidence(setup.inference, result, layout);
    if (result.status === "ok" || result.status === "not_enough_data") {
      const values = { inputHash, result };
      await db
        .insert(scanCache)
        .values({ userId: user.id, postId: body.postId, ...values })
        .onConflictDoUpdate({ target: [scanCache.userId, scanCache.postId], set: values });
    }
    return result;
  } catch (error) {
    return {
      status: "unavailable",
      reason:
        error instanceof XEvidenceError
          ? error.message
          : "The profile scan couldn’t finish. Try again later.",
      pauseAuto: !(error instanceof XEvidenceError),
    };
  }
});

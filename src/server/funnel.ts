import { db, sql } from "void/db";
import { funnel } from "@schema";

/** Idempotent first milestones; retrying a user action never creates a second conversion. */
export function milestone(userId: string, event: "keep" | "open", now = Date.now()) {
  const field = event === "keep" ? "firstKeepAt" : "firstOpenAt";
  return db.insert(funnel).values({ userId, [field]: now }).onConflictDoUpdate({
    target: funnel.userId, set: { [field]: sql`coalesce(${funnel[field]}, ${now})` },
  });
}

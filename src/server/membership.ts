import { sql } from "void/db";

/** Membership follows the last OAuth handle and its linked X account, never an inference from the post. */
export function platformMembership(handle: ReturnType<typeof sql>) {
  return sql<boolean>`exists (
    SELECT 1 FROM "user" AS member
    JOIN account AS identity ON identity.userId = member.id
    WHERE identity.providerId = 'twitter' AND identity.accountId = member.xAccountId
      AND lower(member.xUsername) = lower(${handle})
  )`.mapWith(Boolean);
}

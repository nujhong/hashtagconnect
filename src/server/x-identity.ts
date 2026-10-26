import { db, sql } from "void/db";

/** Better Auth owns the verified provider identity; client-editable profile fields never grant access. */
export async function xAccountId(userId: string): Promise<string | null> {
  const account = await db.get<{ accountId: string }>(sql`
    SELECT accountId FROM account WHERE userId = ${userId} AND providerId = 'twitter' LIMIT 1
  `);
  return account?.accountId ?? null;
}

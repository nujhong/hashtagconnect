import { sql, type DrizzleD1Database } from "void/db";
import { personStates, postStates } from "~/db/schema";
import type { GuestDecision } from "~/src/guest";

type Database = DrizzleD1Database<typeof import("~/db/schema")>;

/** Import only shared posts; account state wins, including explicit clears. Replays are harmless. */
export async function mergeGuestState(db: Database, userId: string, entries: GuestDecision[]) {
  if (!entries.length) return;
  const now = Date.now();
  const mutations = entries.flatMap(({ postId, choice, openedAt }) => [
    db
      .insert(personStates)
      .select(sql`
      SELECT ${userId}, p.person_id, p.id,
        CASE WHEN old.user_id IS NOT NULL THEN old.choice ELSE ${choice} END,
        CASE WHEN old.user_id IS NOT NULL THEN old.opened_at ELSE ${openedAt} END,
        ${now}
      FROM posts p
      LEFT JOIN post_states old ON old.user_id = ${userId} AND old.post_id = p.id
      WHERE p.id = ${postId} AND p.pooled_at IS NOT NULL AND p.person_id IS NOT NULL
    `)
      .onConflictDoNothing(),
    db
      .insert(postStates)
      .select(sql`
      SELECT ${userId}, p.id, ${choice}, ${openedAt}, ${now}
      FROM posts p
      WHERE p.id = ${postId} AND p.pooled_at IS NOT NULL AND p.person_id IS NULL
    `)
      .onConflictDoNothing(),
  ]);
  await db.batch([mutations[0]!, ...mutations.slice(1)]);
}

import { lt, sql, type DrizzleD1Database } from "void/db";
import { browserRunUsage } from "../../db/schema.ts";

type Database = DrizzleD1Database<typeof import("../../db/schema.ts")>;

// 5,000 one-minute calls at $0.09/hour budget $7.50 against the US$10 target, ignoring free hours.
// Screenshot stage timeouts total 42s; project reads total 20s. Revisit if either grows.
export const BROWSER_RUN_MONTHLY_LIMIT = 5_000;

export class BrowserRunBudgetError extends Error {
  constructor() {
    super("Browser reads are paused until next month. Your saved profile is unchanged.");
  }
}

/** Reserve before starting paid work. One atomic upsert prevents concurrent overspend; never refund failures. */
export async function reserveBrowserRun(db: Database, now = new Date()): Promise<void> {
  const [reserved] = await db
    .insert(browserRunUsage)
    .values({ month: now.toISOString().slice(0, 7), runs: 1 })
    .onConflictDoUpdate({
      target: browserRunUsage.month,
      set: { runs: sql`${browserRunUsage.runs} + 1` },
      setWhere: lt(browserRunUsage.runs, BROWSER_RUN_MONTHLY_LIMIT),
    })
    .returning({ runs: browserRunUsage.runs });
  if (!reserved) throw new BrowserRunBudgetError();
}

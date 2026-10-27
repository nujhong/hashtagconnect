import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "void/db";
import * as schema from "~/db/schema.ts";
import {
  BROWSER_RUN_MONTHLY_LIMIT,
  BrowserRunBudgetError,
  reserveBrowserRun,
} from "~/src/server/browser-run-budget.ts";

test("shared Browser Run reservations enforce the month atomically and fail closed", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      d1Databases: ["DB"],
    }),
  );
  try {
    const binding = await mf.getD1Database("DB");
    const dir = new URL("../../db/migrations/", import.meta.url);
    for (const file of readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(new URL(file, dir), "utf8")
        .replace(/--[^\n]*/g, "")
        .split(";")
        .map((statement) => statement.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(";\n");
      await binding.exec(sql);
    }
    const db = drizzle(binding, { schema });
    const otherWorker = drizzle(binding, { schema });
    const december = new Date("2026-12-31T23:59:59.000Z");
    const usage = async (month: string) =>
      (
        await db
          .select()
          .from(schema.browserRunUsage)
          .where(eq(schema.browserRunUsage.month, month))
      )[0]?.runs;

    // A failed provider attempt still consumes its reservation.
    await assert.rejects(async () => {
      await reserveBrowserRun(db, december);
      throw new Error("Provider timed out");
    }, /Provider timed out/);
    assert.equal(await usage("2026-12"), 1);

    await db.update(schema.browserRunUsage).set({ runs: BROWSER_RUN_MONTHLY_LIMIT - 10 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 40 }, (_, i) => reserveBrowserRun(i % 2 ? db : otherWorker, december)),
    );
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 10);
    for (const result of attempts.filter((result) => result.status === "rejected")) {
      assert.ok(result.reason instanceof BrowserRunBudgetError);
    }
    assert.equal(await usage("2026-12"), BROWSER_RUN_MONTHLY_LIMIT);

    // The new UTC month gets a new allowance without resetting the old record.
    await reserveBrowserRun(db, new Date("2027-01-01T00:00:00.000Z"));
    assert.equal(await usage("2027-01"), 1);
    assert.equal(await usage("2026-12"), BROWSER_RUN_MONTHLY_LIMIT);

    await binding.exec("DROP TABLE browser_run_usage");
    await assert.rejects(reserveBrowserRun(db, december));
  } finally {
    await mf.dispose();
  }
});

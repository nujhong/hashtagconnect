import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { sql } from "void/db";
import { SQLiteSyncDialect } from "void/schema-d1";
import { platformMembership } from "./server/membership.ts";

test("membership requires the last OAuth handle and matching linked X identity", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE user (id TEXT, xUsername TEXT, xAccountId TEXT);
      CREATE TABLE account (userId TEXT, providerId TEXT, accountId TEXT);
      INSERT INTO user VALUES ('1', 'Joined', '101'), ('2', 'Unlinked', '102'),
        ('3', 'OtherProvider', '103'), ('4', 'WrongIdentity', '104');
      INSERT INTO account VALUES ('1', 'twitter', '101'), ('3', 'github', '103'), ('4', 'twitter', '999');
    `);
    const member = (handle: string | null) => {
      const query = new SQLiteSyncDialect().sqlToQuery(sql`SELECT ${platformMembership(sql`${handle}`)} AS member`);
      return db.prepare(query.sql).get(...query.params as (string | null)[])?.member;
    };
    assert.equal(member("joined"), 1);
    for (const handle of ["Unlinked", "OtherProvider", "WrongIdentity", "Unknown", null, "' OR 1=1 --"]) {
      assert.equal(member(handle), 0, String(handle));
    }
    db.exec("UPDATE user SET xUsername = 'Renamed' WHERE id = '1'");
    assert.equal(member("joined"), 0);
    assert.equal(member("RENAMED"), 1);
    db.exec("DELETE FROM account WHERE userId = '1'");
    assert.equal(member("renamed"), 0);
  } finally { db.close(); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { scheduleScan } from "./auto-scan.ts";
import type { ScanResult } from "./scan-contract.ts";

const result: ScanResult = { status: "not_enough_data", reason: "A generic invitation." };

test("effect setup/cleanup replay sends only one request for the settled post", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls: string[] = [], results: ScanResult[] = [];
  const request = async (id: string) => { calls.push(id); return result; };
  scheduleScan("123", request, (r) => results.push(r))();
  const cleanup = scheduleScan("123", request, (r) => results.push(r));
  t.mock.timers.tick(250);
  await Promise.resolve();
  assert.deepEqual(calls, ["123"]);
  assert.deepEqual(results, [result]);
  cleanup();
});

test("rapidly moving on skips the post that never settled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls: string[] = [];
  const request = async (id: string) => { calls.push(id); return result; };
  const leaveFirst = scheduleScan("123", request, () => {});
  t.mock.timers.tick(100);
  leaveFirst();
  const leaveNext = scheduleScan("456", request, () => {});
  t.mock.timers.tick(250);
  await Promise.resolve();
  assert.deepEqual(calls, ["456"]);
  leaveNext();
});

test("leaving aborts the client request and suppresses a late result or service pause", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  let finish!: (result: ScanResult) => void;
  const pending = new Promise<ScanResult>((resolve) => { finish = resolve; });
  const results: ScanResult[] = [];
  const leave = scheduleScan("123", async (_, requestSignal) => {
    signal = requestSignal;
    return pending;
  }, (r) => results.push(r));
  t.mock.timers.tick(250);
  assert.equal(signal?.aborted, false);
  leave();
  assert.equal(signal?.aborted, true);
  finish({ status: "unavailable", reason: "Limit reached.", pauseAuto: true });
  await pending;
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(results, []);
});

test("returning to the same post makes a fresh request without caching", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const request = async () => { calls++; return result; };
  for (let visit = 0; visit < 2; visit++) {
    const leave = scheduleScan("123", request, () => {});
    t.mock.timers.tick(250);
    await Promise.resolve();
    leave();
  }
  assert.equal(calls, 2);
});

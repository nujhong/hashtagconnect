import { test, vi, afterEach } from "vite-plus/test";
import assert from "node:assert/strict";
import { scheduleScan } from "./schedule-scan.ts";
import type { ScanResult } from "~/shared/scan-contract.ts";

afterEach(() => vi.useRealTimers());

const result: ScanResult = { status: "not_enough_data", reason: "A generic invitation." };

test("effect setup/cleanup replay sends only one request for the settled post", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const calls: string[] = [],
    results: ScanResult[] = [];
  const request = async (id: string) => {
    calls.push(id);
    return result;
  };
  scheduleScan("123", request, (r) => results.push(r))();
  const cleanup = scheduleScan("123", request, (r) => results.push(r));
  vi.advanceTimersByTime(250);
  await Promise.resolve();
  assert.deepEqual(calls, ["123"]);
  assert.deepEqual(results, [result]);
  cleanup();
});

test("rapidly moving on skips the post that never settled", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const calls: string[] = [];
  const request = async (id: string) => {
    calls.push(id);
    return result;
  };
  const leaveFirst = scheduleScan("123", request, () => {});
  vi.advanceTimersByTime(100);
  leaveFirst();
  const leaveNext = scheduleScan("456", request, () => {});
  vi.advanceTimersByTime(250);
  await Promise.resolve();
  assert.deepEqual(calls, ["456"]);
  leaveNext();
});

test("leaving aborts the client request and suppresses a late result or service pause", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let signal: AbortSignal | undefined;
  let finish!: (result: ScanResult) => void;
  const pending = new Promise<ScanResult>((resolve) => {
    finish = resolve;
  });
  const results: ScanResult[] = [];
  const leave = scheduleScan(
    "123",
    async (_, requestSignal) => {
      signal = requestSignal;
      return pending;
    },
    (r) => results.push(r),
  );
  vi.advanceTimersByTime(250);
  assert.equal(signal?.aborted, false);
  leave();
  assert.equal(signal?.aborted, true);
  finish({ status: "unavailable", reason: "Limit reached.", pauseAuto: true });
  await pending;
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(results, []);
});

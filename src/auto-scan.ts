import type { ScanResult } from "./scan-contract.ts";

/**
 * Let a post settle after navigation before spending a scan. Effect cleanup cancels the timer
 * (including React's development replay) or aborts the client request and discards its late result.
 * Nothing is cached: returning to a post schedules a fresh request.
 */
export function scheduleScan(
  postId: string,
  request: (postId: string, signal: AbortSignal) => Promise<ScanResult>,
  onResult: (result: ScanResult) => void,
) {
  const controller = new AbortController();
  const timer = setTimeout(async () => {
    const result = await request(postId, controller.signal);
    if (!controller.signal.aborted) onResult(result);
  }, 250);
  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}

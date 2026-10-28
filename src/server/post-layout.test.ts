import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { capturePostLayout } from "./post-layout";

const { launch } = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock("@cloudflare/puppeteer", () => ({ default: { launch } }));
const close = vi.fn();
const evaluate = vi.fn();
const page = {
  setDefaultTimeout: vi.fn(),
  setViewport: vi.fn(),
  setContent: vi.fn(),
  waitForSelector: vi.fn(),
  $: vi.fn(),
};
const binding = { fetch: vi.fn() };

beforeEach(() => {
  launch.mockResolvedValue({ newPage: async () => page, close } as never);
  page.waitForSelector.mockResolvedValue({
    boundingBox: async () => ({ x: 0, y: 0, width: 550, height: 500 }),
  });
  page.$.mockResolvedValue({
    contentFrame: async () => ({ evaluate }),
    boundingBox: async () => ({ x: 0, y: 0, width: 550, height: 500 }),
  });
  evaluate.mockResolvedValue([
    { text: "AI Tools", top: 100, bottom: 125, left: 22, right: 110 },
    { text: "clipped", top: 600, bottom: 620, left: 22, right: 110 },
  ]);
});
afterEach(() => vi.resetAllMocks());

it("measures body lines in the official frame and releases the browser", async () => {
  const layout = await capturePostLayout(binding, "1234");
  expect(layout).toEqual({
    width: 550,
    height: 500,
    theme: "light",
    lines: [{ text: "AI Tools", box: { top: 0.2, bottom: 0.25, left: 0.04, right: 0.2 } }],
  });
  expect(launch).toHaveBeenCalledWith(binding);
  expect(page.setContent.mock.calls[0][0]).toContain('createTweet("1234"');
  expect(close).toHaveBeenCalledOnce();
});

it("rejects non-ID input before opening a browser", async () => {
  await expect(capturePostLayout(binding, '123";alert(1)')).rejects.toThrow();
  expect(launch).not.toHaveBeenCalled();
});

it("releases the browser when X cannot render usable body text", async () => {
  evaluate.mockRejectedValue(new Error("Post body unavailable."));
  await expect(capturePostLayout(binding, "1234")).rejects.toThrow("Post body unavailable.");
  expect(close).toHaveBeenCalledOnce();
});

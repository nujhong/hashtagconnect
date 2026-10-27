import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { capturePostImage } from "./post-image.ts";
function pngHeader(width = 550, height = 536) {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}

test("capture uses a fixed official widget and waits for it before taking a bounded screenshot", async () => {
  const image = await capturePostImage(
    {
      quickAction: async (action, options) => {
        assert.equal(action, "screenshot");
        assert.ok(options && "html" in options);
        assert.match(options.html, /createTweet\("1234"/);
        assert.match(options.html, /dnt:true,conversation:"none"/);
        assert.equal(options.waitForSelector?.selector, '#post[data-ready="true"]');
        assert.equal(options.cacheTTL, 0);
        assert.equal(options.viewport?.width, 550);
        return new Response(pngHeader());
      },
    },
    "1234",
  );
  assert.equal(image.width, 550);
  assert.equal(image.height, 536);
  await assert.rejects(
    capturePostImage(
      {
        quickAction: async () => {
          throw new Error("Must not capture");
        },
      },
      '1";alert(1)',
    ),
    /invalid_format/,
  );
  for (const response of [
    new Response(null, { status: 503 }),
    new Response("not a screenshot"),
    new Response(pngHeader(550, 1800)),
    new Response(new Uint8Array(4_000_001)),
  ]) {
    await assert.rejects(capturePostImage({ quickAction: async () => response }, "1234"));
  }
});

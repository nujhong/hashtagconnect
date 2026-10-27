import { Buffer } from "node:buffer";
import { z } from "zod";
import type { ScanEvidence } from "~/src/scan-contract.ts";

/**
 * Capture only the official post widget. No viewer cookies, profile data or oEmbed HTML is executed.
 * The widget's default 10px margins are removed, as in the app (pages/style.css), so boxes map onto the live embed.
 */
export async function capturePostImage(
  browser: Pick<BrowserRun, "quickAction">,
  postId: string,
): Promise<NonNullable<ScanEvidence["post"]["image"]>> {
  z.string()
    .regex(/^[1-9]\d{0,24}$/)
    .parse(postId);
  const response = await browser.quickAction("screenshot", {
    html: `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;background:white}#post{width:550px;min-height:280px;max-height:1568px;overflow:hidden;display:flow-root}#post .twitter-tweet{margin:0!important}
      </style></head><body><div id="post"></div><script src="https://platform.twitter.com/widgets.js"></script><script>
      twttr.ready(function(){twttr.widgets.createTweet("${postId}",document.getElementById("post"),
      {width:550,theme:"light",dnt:true,conversation:"none"}).then(function(widget){
        if(widget)document.getElementById("post").setAttribute("data-ready","true");
      });});</script></body></html>`,
    viewport: { width: 550, height: 1568, deviceScaleFactor: 1 },
    waitForSelector: { selector: '#post[data-ready="true"]', visible: true, timeout: 12_000 },
    gotoOptions: { waitUntil: "domcontentloaded", timeout: 15_000 },
    actionTimeout: 15_000,
    cacheTTL: 0,
    selector: "#post",
    screenshotOptions: { type: "png" },
  });
  if (!response.ok || !response.body) throw new Error("Post image unavailable.");
  // Bound the binary response before buffering it in the Worker.
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4_000_000) {
        await reader.cancel();
        throw new Error("Post image too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("Post image is not PNG.");
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (width !== 550 || height < 280 || height > 1568)
    throw new Error("Post image dimensions unsupported.");
  return { format: "png", dataBase64: bytes.toString("base64"), width, height, theme: "light" };
}

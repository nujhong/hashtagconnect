import puppeteer from "@cloudflare/puppeteer";
import { z } from "zod";
import type { ScanPhrase } from "~/shared/scan-contract";

export type PostLayout = {
  width: number;
  height: number;
  theme: "light";
  lines: { text: string; box: NonNullable<ScanPhrase["located"]>["box"] }[];
};

/** Read visible body lines using the browser's text ranges; runs inside the official widget frame. */
export function readPostLines() {
  const root = document.querySelector('[data-testid="tweetText"]');
  if (!root) throw new Error("Post body unavailable.");
  const lines: { text: string; top: number; bottom: number; left: number; right: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (const match of (node.textContent ?? "").matchAll(/\S+/g)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        const line = lines.find((item) => Math.abs(item.top - rect.top) < 2);
        if (line) {
          line.text += ` ${match[0]}`;
          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
          line.bottom = Math.max(line.bottom, rect.bottom);
        } else {
          lines.push({
            text: match[0],
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          });
        }
      }
    }
  }
  return lines.sort((a, b) => a.top - b.top);
}

/**
 * Measure only the official post widget. No viewer cookies, profile data or oEmbed HTML is executed.
 * The widget's default 10px margins are removed, as in the app, so boxes map onto the live embed.
 */
export async function capturePostLayout(
  browser: Pick<BrowserRun, "fetch">,
  postId: string,
): Promise<PostLayout> {
  z.string()
    .regex(/^[1-9]\d{0,24}$/)
    .parse(postId);
  const session = await puppeteer.launch(browser);
  try {
    const page = await session.newPage();
    page.setDefaultTimeout(12_000);
    await page.setViewport({ width: 550, height: 1568, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;background:white}#post{width:550px;min-height:280px;max-height:1568px;overflow:hidden;display:flow-root}#post .twitter-tweet{margin:0!important}
      </style></head><body><div id="post"></div><script src="https://platform.twitter.com/widgets.js"></script><script>
      twttr.ready(function(){twttr.widgets.createTweet("${postId}",document.getElementById("post"),
      {width:550,theme:"light",dnt:true,conversation:"none"}).then(function(widget){
        if(widget)document.getElementById("post").setAttribute("data-ready","true");
      });});</script></body></html>`,
      { waitUntil: "domcontentloaded", timeout: 15_000 },
    );
    const post = await page.waitForSelector('#post[data-ready="true"]');
    const widget = await page.$("#post iframe[data-tweet-id]");
    const frame = await widget?.contentFrame();
    const outer = await post?.boundingBox();
    const inner = await widget?.boundingBox();
    if (!frame || !outer || !inner) throw new Error("Post layout unavailable.");
    const measured = await frame.evaluate(readPostLines);
    const lines = measured
      .map(({ text, top, bottom, left, right }) => ({
        text,
        box: {
          top: (inner.y - outer.y + top) / outer.height,
          bottom: (inner.y - outer.y + bottom) / outer.height,
          left: (inner.x - outer.x + left) / outer.width,
          right: (inner.x - outer.x + right) / outer.width,
        },
      }))
      .filter(({ box }) => box.top >= 0 && box.bottom <= 1 && box.left >= 0 && box.right <= 1);
    if (!lines.length) throw new Error("Post body unavailable.");
    return { width: outer.width, height: outer.height, theme: "light", lines: lines.slice(0, 254) };
  } finally {
    await session.close();
  }
}

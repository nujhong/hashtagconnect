import { defineConfig } from "void/config";

export default defineConfig({
  target: "cloudflare",
  worker: {
    compatibility_date: "2026-10-25",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    name: "hashtagconnect",
    workers_dev: true,
    preview_urls: true,
    routes: [],
    account_id: "21f45a2a8793aab5564e155efbee03fb",
    browser: { binding: "BROWSER", remote: true },
    observability: { enabled: true, traces: { enabled: true } },
  },
  head: {
    title: "hashtagconnect · Find your first circle on X",
    htmlAttrs: { lang: "en" },
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "Find your first circle on X. Meet people interested in what you share, create or sell.",
      },
      // ponytail: one theme-color; Void's head renders only name/property/content (no media) and dedupes by name.
      { name: "theme-color", content: "#f4f3ef" },
      { name: "color-scheme", content: "light dark" },
      // Share cards require an absolute image URL.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "hashtagconnect" },
      { property: "og:title", content: "hashtagconnect · Find your first circle on X" },
      {
        property: "og:description",
        content: "Meet people interested in what you share, create or sell.",
      },
      { property: "og:image", content: "https://hashtagconnect.kinetics.workers.dev/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "hashtagconnect: Find your first circle on X." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    link: [
      { rel: "icon", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
      // Posts load automatically as official X embeds; warm the widget host.
      { rel: "preconnect", href: "https://platform.twitter.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Geist:wght@400..600&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
  },
  routing: {
    headers: {
      "/*": [
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy: strict-origin-when-cross-origin",
        "X-Frame-Options: DENY",
        "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
      ],
    },
  },
});

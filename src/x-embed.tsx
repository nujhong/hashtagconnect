import { useEffect, useRef, useState } from "react";

type Widgets = {
  createTweet: (id: string, target: HTMLElement, options: { dnt: boolean; conversation: string; width: number; theme: string }) => Promise<HTMLElement | undefined>;
  createTimeline: (source: { sourceType: "profile"; screenName: string }, target: HTMLElement, options: { dnt: boolean; width: number; height: number; theme: string }) => Promise<HTMLElement | undefined>;
};
declare global {
  interface Window { twttr?: { widgets: Widgets; ready: (callback: (api: { widgets: Widgets }) => void) => void } }
}

let widgetScript: Promise<Widgets> | undefined;
function loadWidgets(): Promise<Widgets> {
  if (!widgetScript) {
    widgetScript = new Promise<Widgets>((resolve, reject) => {
      // The SDK exposes its factories before initialization finishes. Wait for its native ready signal.
      const ready = () => {
        if (!window.twttr?.ready) { window.clearTimeout(timer); script.remove(); reject(new Error("X embeds are unavailable")); return; }
        window.twttr.ready((api) => { window.clearTimeout(timer); resolve(api.widgets); });
      };
      const script = document.createElement("script");
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      const timer = window.setTimeout(() => { script.remove(); reject(new Error("X did not load")); }, 15_000);
      if (window.twttr?.ready) { ready(); return; }
      script.onload = ready;
      script.onerror = () => { window.clearTimeout(timer); script.remove(); reject(new Error("X did not load")); };
      document.head.appendChild(script);
    }).catch((error: unknown) => { widgetScript = undefined; throw error; });
  }
  return widgetScript;
}

export type EmbedStatus = "off" | "loading" | "ready" | "unavailable";
export type EmbedSource = { id: string; profile?: never } | { profile: string; id?: never };

export function XEmbed({ id, profile, enabled, onEnable, onStatusChange }: EmbedSource & {
  enabled: boolean; onEnable: () => void; onStatusChange?: (status: EmbedStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { onStatusChange?.(enabled ? status : "off"); }, [enabled, status, onStatusChange]);
  useEffect(() => {
    if (!enabled || !host.current) return;
    const mount = document.createElement("div");
    host.current.appendChild(mount);
    let cancelled = false;
    setStatus("loading");
    const timeout = window.setTimeout(() => { if (!cancelled) setStatus("unavailable"); }, 20_000);
    const unavailable = () => {
      if (!cancelled) { window.clearTimeout(timeout); setStatus("unavailable"); }
    };
    loadWidgets().then((widgets) => {
      if (cancelled) return;
      const theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      return profile !== undefined
        ? widgets.createTimeline({ sourceType: "profile", screenName: profile }, mount, { dnt: true, width: 520, height: 640, theme })
        : widgets.createTweet(id, mount, { dnt: true, conversation: "none", width: 550, theme });
    }).then((element) => {
      if (!cancelled) { window.clearTimeout(timeout); setStatus(element ? "ready" : "unavailable"); }
    }).catch(unavailable);
    return () => { cancelled = true; window.clearTimeout(timeout); mount.remove(); };
  }, [id, profile, enabled, attempt]);

  return <div className="embed-shell">
    {!enabled ? <div className="embed-placeholder">
      <span className="embed-symbol" aria-hidden="true">𝕏</span>
      <h3>Read it in their words.</h3>
      <p>X loads this content and may set cookies.</p>
      <button className="btn primary sm" onClick={onEnable}>Show X embeds</button>
      <a href="https://x.com/en/privacy" target="_blank" rel="noreferrer">X privacy policy ↗</a>
    </div> : status !== "ready" && <div className={`embed-placeholder ${status}`} role="status">
      <span className="embed-symbol" aria-hidden="true">𝕏</span>
      <h3>{status === "loading" ? profile !== undefined ? "Loading profile posts…" : "Loading invitation…" : profile !== undefined ? "X couldn’t load this timeline." : "X couldn’t load this post."}</h3>
      {status === "unavailable" && <button className="link" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
    </div>}
    <div ref={host} className="x-embed" />
  </div>;
}

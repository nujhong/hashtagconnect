import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { XEmbed, type EmbedStatus } from "./x-embed";
import { aligns, type PostLayer } from "~/client/scan-layer";

/**
 * Presentation around X's official post widget, never cropped or scaled.
 * An app-owned rounded container with a stable minimum height centres the embed (or its loading and error
 * states) horizontally and vertically; taller posts simply grow the container. CSS owns the
 * layout. An optional app-owned header sits above the widget. `fallback` (e.g. a small Open on X link) appears only when the widget can't be shown.
 * `layer` adds the scan's read-only layer: a sweep while scanning, then Clef's outlines where it found your phrases.
 * Both ignore the pointer, so the widget stays fully usable; outlines show only when the render matches the scanned capture.
 * `onSpots` reports whether outlines are on screen, so evidence cords know when they have something to plug into.
 */
export function PostFrame({
  id,
  fallback,
  header,
  layer,
  onSpots,
}: {
  id: string;
  fallback?: ReactNode;
  header?: ReactNode;
  layer?: PostLayer | null;
  onSpots?: (shown: boolean) => void;
}) {
  const [status, setStatus] = useState<EmbedStatus>("loading");
  const [rendered, setRendered] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [showSpots, setShowSpots] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const iframe = el.querySelector("iframe");
      setRendered(
        iframe
          ? {
              left: iframe.offsetLeft,
              top: iframe.offsetTop,
              width: iframe.offsetWidth,
              height: iframe.offsetHeight,
            }
          : null,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const image = layer?.image;
  const spots =
    status === "ready" && image && rendered && aligns(image, rendered) ? layer.spots : [];
  const shown = showSpots && spots.length > 0;
  useEffect(() => {
    onSpots?.(shown);
  }, [shown, onSpots]);
  return (
    <div className="post-frame-wrap">
      <div className={`post-frame is-${status}`}>
        {(header || spots.length > 0) && (
          <div className="post-frame-head">
            {header}
            {spots.length > 0 && (
              <button
                className={`spot-toggle${showSpots ? " on" : ""}`}
                aria-pressed={showSpots}
                onClick={() => setShowSpots(!showSpots)}
                title="Outlines mark where the scan found your words. They never change the post."
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="2" y="4" width="12" height="8" rx="2" />
                </svg>
                Highlights
              </button>
            )}
          </div>
        )}
        <div className="embed-frame" ref={frame}>
          <XEmbed id={id} onStatusChange={setStatus} />
          {status === "ready" && layer?.scanning && (
            <div className="post-sweep" aria-hidden="true" />
          )}
          {shown && image && rendered && (
            <div
              className="post-layer"
              aria-hidden="true"
              style={{
                left: rendered.left,
                top: rendered.top,
                width: image.width,
                height: image.height,
              }}
            >
              {spots.map(({ phrases, box, approximate }, i) => (
                <motion.div
                  key={phrases.join()}
                  data-phrases={phrases.join(" ")}
                  className={`post-spot${approximate ? " is-approx" : ""}`}
                  style={{
                    top: `${box.top * 100}%`,
                    left: `${box.left * 100}%`,
                    width: `${(box.right - box.left) * 100}%`,
                    height: `${(box.bottom - box.top) * 100}%`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.12 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {fallback && status === "unavailable" && <div className="post-fallback">{fallback}</div>}
    </div>
  );
}

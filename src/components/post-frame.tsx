import { useState, type ReactNode } from "react";
import { XEmbed, type EmbedStatus } from "../x-embed";

/**
 * Presentation around X's official post widget, never cropped, scaled or covered.
 * An app-owned rounded container with a stable minimum height centres the embed (or its loading and error
 * states) horizontally and vertically; taller posts simply grow the container. CSS owns the
 * layout. An optional app-owned header sits above the widget. `fallback` (e.g. a small Open on X link) appears only when the widget can't be shown.
 */
export function PostFrame({ id, fallback, header }: {
  id: string;
  fallback?: ReactNode; header?: ReactNode;
}) {
  const [status, setStatus] = useState<EmbedStatus>("loading");
  return <div className="post-frame-wrap">
    <div className={`post-frame is-${status}`}>
      {header && <div className="post-frame-head">{header}</div>}
      <div className="embed-frame"><XEmbed id={id} onStatusChange={setStatus} /></div>
    </div>
    {fallback && status === "unavailable" && <div className="post-fallback">{fallback}</div>}
  </div>;
}

import { useState, type ReactNode } from "react";
import { XEmbed, type EmbedStatus } from "../x-embed";

/**
 * Presentation around X's official post widget, never cropped, scaled or covered.
 * An app-owned rounded container with a stable minimum height centres the embed (or its loading, error
 * and consent states) horizontally and vertically; taller posts simply grow the container. CSS owns the
 * layout. `fallback` (e.g. a small Open on X link) appears only when the widget can't be shown or embeds are off.
 */
export function PostFrame({ id, embeds, onEnable, fallback }: {
  id: string;
  embeds: boolean; onEnable: () => void; fallback?: ReactNode;
}) {
  const [status, setStatus] = useState<EmbedStatus>(embeds ? "loading" : "off");
  return <div className="post-frame-wrap">
    <div className={`post-frame is-${status}`}>
      <div className="embed-frame"><XEmbed id={id} enabled={embeds} onEnable={onEnable} onStatusChange={setStatus} /></div>
    </div>
    {fallback && (status === "off" || status === "unavailable") && <div className="post-fallback">{fallback}</div>}
  </div>;
}

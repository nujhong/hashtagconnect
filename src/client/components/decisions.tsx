import type { Choice, Post } from "~/shared/people";
import { Keycap } from "./primitives";

/**
 * App-owned controls, outside the embed: Pass and Keep are ordinary toggle buttons (keyboard,
 * shortcuts and reduced motion all work), laid out left/right like their arrow keys. The embed
 * already links to X, so our own Open on X only appears as a fallback when the post can't show.
 * `hit` briefly shows a button pressed when its shortcut fires.
 */
export function Decisions({
  post,
  shortcuts,
  hit,
  busy,
  onDecide,
}: {
  post: Post;
  shortcuts: boolean;
  hit: Choice | null;
  busy: boolean;
  onDecide: (post: Post, choice: Choice | null) => void;
}) {
  const kept = post.choice === "save";
  const passed = post.choice === "skip";
  return (
    <div className="decide" role="group" aria-label="Your private choice for this post">
      <button
        className={`big pass${passed || hit === "skip" ? " on" : ""}`}
        aria-pressed={passed}
        disabled={busy}
        aria-keyshortcuts={shortcuts ? "ArrowLeft" : undefined}
        onClick={() => onDecide(post, passed ? null : "skip")}
      >
        <span>{passed ? "Passed" : "Pass"}</span>
        {passed ? <i aria-hidden="true">✓</i> : shortcuts && <Keycap k="←" hint />}
      </button>
      <button
        className={`big keep${kept || hit === "save" ? " on" : ""}`}
        aria-pressed={kept}
        disabled={busy}
        aria-keyshortcuts={shortcuts ? "ArrowRight" : undefined}
        onClick={() => onDecide(post, kept ? null : "save")}
      >
        <span>{kept ? "Kept" : "Keep"}</span>
        {kept ? <i aria-hidden="true">✓</i> : shortcuts && <Keycap k="→" hint />}
      </button>
    </div>
  );
}

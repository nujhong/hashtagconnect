import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { Post } from "~/src/people";

/** Small shared pieces: primitives used across sections, plus the toast. Not a design system. */
export const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

/** A native modal dialog sheet: focus is trapped, Escape and a backdrop click close it. */
export function Modal({
  label,
  children,
  onClose,
  wide,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " wide" : ""}`}
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <button className="modal-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      {children}
    </dialog>
  );
}

/** Numbers roll instead of blinking when they change. */
export function Count({ value }: { value: number }) {
  return (
    <span className="count">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-90%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "90%", opacity: 0 }}
          transition={spring}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The hashtagconnect mark: a bold "#" sticker. Beside "connect" it doubles as the compact #connect brand. */
export function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      #
    </span>
  );
}

/** Stash's icon: a bookmark, because Stash is where saved people wait. Decorative; the label says "Stash". */
export function StashIcon() {
  return (
    <svg className="stash-icon" viewBox="0 0 16 18" aria-hidden="true">
      <path d="M3 1.5h10a1 1 0 0 1 1 1v14l-6-3.6-6 3.6v-14a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

const keyNames: Record<string, string> = { "←": "Left arrow", "→": "Right arrow", Esc: "Escape" };

/**
 * One keyboard key, drawn the same everywhere. A `hint` keycap decorates a control that already
 * carries aria-keyshortcuts: it's hidden from assistive tech and only shown with a fine pointer.
 * A plain keycap documents a shortcut in text, always shows, and reads its full name (e.g. "Left arrow").
 */
export function Keycap({ k, hint }: { k: string; hint?: boolean }) {
  if (hint)
    return (
      <kbd className="keycap is-hint" aria-hidden="true">
        {k}
      </kbd>
    );
  const name = keyNames[k];
  return (
    <kbd className="keycap">
      {name ? (
        <>
          <span aria-hidden="true">{k}</span>
          <span className="sr">{name}</span>
        </>
      ) : (
        k
      )}
    </kbd>
  );
}

/** Our own post link: recorded as opened, like Stash profile links and bulk-open tabs. Embed clicks stay inside X. */
export function OpenLink({
  post,
  onOpen,
  className = "btn",
}: {
  post: Post;
  onOpen: (post: Post) => void;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen(post)}
      onAuxClick={(event) => {
        if (event.button === 1) onOpen(post);
      }}
    >
      Open on X <span aria-hidden="true">↗</span>
    </a>
  );
}

export type Notice = { text: string; undo?: () => void };

/**
 * One toast at a time, with an optional Undo, dismissed after six seconds. Pass `host` when a modal
 * dialog is open: the toast then renders inside it, because a modal makes the rest of the page inert,
 * which would strand Undo.
 */
export function Toast({
  notice,
  onClose,
  host,
}: {
  notice: Notice | null;
  onClose: () => void;
  host: HTMLElement | null;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onClose, 6_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const dock = (
    <div className="toast-dock" role="status" aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.text}
            className="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
          >
            <span>{notice.text}</span>
            {notice.undo && (
              <button
                onClick={() => {
                  notice.undo?.();
                  onClose();
                }}
              >
                Undo
              </button>
            )}
            <button className="x" onClick={onClose} aria-label="Dismiss">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  return host ? createPortal(dock, host) : dock;
}

/** True below the phone breakpoint, where decisions pin to the screen beneath the inline scan and post. */
export function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 999px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

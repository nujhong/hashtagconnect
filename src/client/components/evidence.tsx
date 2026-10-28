import { useEffect, useState, type RefObject } from "react";
import { motion } from "motion/react";
import type { Evidence, Spot } from "~/client/scan-layer";

const sources = { bio: "Your bio", context: "Your context", project: "Your project" } as const;

/**
 * Why this invitation is relevant, in your own words: up to three phrases from your profile that Clef found the post
 * seeks or shares. We quote only you, never them; their side is pointed at in X's own widget by an outline and a cord.
 * Cards stay strongest first. `spots` are the highlights on screen (null when they're off): only a card whose phrase is
 * highlighted gets a plug for its cord, and only that card can look approximate.
 * The slot is never left blank once a scan is involved: placeholders while scanning, and an honest "nothing stood
 * out" card (with a way to give scans more to work with) when Clef found no phrase strong enough.
 */
export function EvidenceCards({
  evidence,
  spots,
  scanning,
  scored,
  onProfile,
}: {
  evidence: Evidence[];
  spots: Spot[] | null;
  scanning: boolean;
  scored: boolean;
  onProfile: () => void;
}) {
  if (scanning)
    return (
      <section className="evidence is-pending" aria-hidden="true">
        <p className="evidence-label">From your profile</p>
        <ul>
          {[0, 1].map((i) => (
            <li key={i} className="ev">
              <span className="ghost short" />
              <span className="ghost" />
            </li>
          ))}
        </ul>
      </section>
    );
  if (!evidence.length && scored)
    return (
      <section className="evidence" aria-label="From your profile">
        <p className="evidence-label">From your profile</p>
        <div className="ev ev-empty">
          <b>Nothing from your profile stood out here.</b>
          <small>
            The score reads the whole post. More about what you do gives scans more to find.
          </small>
          <button className="link" onClick={onProfile}>
            Edit your profile
          </button>
        </div>
      </section>
    );
  if (!evidence.length) return null;
  return (
    <section className="evidence" aria-label="From your profile">
      <p className="evidence-label">From your profile</p>
      <ul>
        {evidence.map(({ phrase, index }, i) => {
          const spot = spots?.find((s) => s.phrases.includes(index));
          return (
            <motion.li
              key={index}
              data-evidence={index}
              tabIndex={0}
              className={`ev${spot?.approximate ? " is-approx" : ""}`}
              initial={{ opacity: 0, scale: 1.12 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 22, delay: 0.3 + i * 0.12 }}
            >
              {spot && <i className="plug" data-plug={index} aria-hidden="true" />}
              <small>
                {sources[phrase.source]} · {Math.round(phrase.strength * 100)}%
              </small>
              <q>{phrase.text}</q>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Patch cords (the sign-in sheet's motif): one continuous cable from each highlight to its card's plug. It leaves the
 * highlight's bottom-right corner, runs along the gap between lines to the embed's edge (under the words, never through
 * them or across other lines), then curves through the gutter between blocks.
 * Pointer-transparent and decorative: the cards already say everything. Positions are measured from the DOM every frame
 * and only re-rendered when an end moved, so cords stay plugged in through animations, font loads, X's widget resizing
 * and anything else that shifts a card or highlight without resizing the workspace.
 * ponytail: a few rect reads per frame for at most three cords; switch to observers if cords ever multiply.
 */
export function Cords({
  root,
  evidence,
}: {
  root: RefObject<HTMLElement | null>;
  evidence: Evidence[];
}) {
  const [cords, setCords] = useState<
    { index: number; d: string; x: number; y: number; approximate: boolean }[]
  >([]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let last = "";
    const draw = () => {
      const origin = el.getBoundingClientRect();
      const next = evidence.flatMap(({ index }) => {
        const plug = el.querySelector(`[data-plug="${index}"]`)?.getBoundingClientRect();
        const spotEl = el.querySelector(`.post-spot[data-phrases~="${index}"]`);
        const spot = spotEl?.getBoundingClientRect();
        if (!plug || !spot) return [];
        const embed = spotEl!.closest(".embed-frame")!.getBoundingClientRect();
        const x0 = spot.right - origin.left,
          x1 = embed.right + 12 - origin.left,
          y1 = spot.bottom - origin.top;
        const x2 = plug.left + plug.width / 2 - origin.left,
          y2 = plug.top + plug.height / 2 - origin.top,
          dx = (x2 - x1) / 2;
        return [
          {
            index,
            d: `M${x0} ${y1} H${x1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`,
            x: x0,
            y: y1,
            approximate: spotEl!.classList.contains("is-approx"),
          },
        ];
      });
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setCords(next);
      }
    };
    let frame = 0;
    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [root, evidence]);
  return (
    <svg className="cords" aria-hidden="true">
      {cords.map(({ index, d, x, y, approximate }) => (
        <g key={index} data-cord={index}>
          {/* An ink jacket under a lime core. Dashed cords skip the draw-in: Motion's pathLength would replace the dashes. */}
          {(["casing", "core"] as const).map((part) =>
            approximate ? (
              <path key={part} d={d} className={`${part} is-approx`} />
            ) : (
              <motion.path
                key={part}
                d={d}
                className={part}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              />
            ),
          )}
          <circle cx={x} cy={y} r={4} />
        </g>
      ))}
    </svg>
  );
}

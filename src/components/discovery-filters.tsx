import { useId } from "react";
import { useNarrow } from "./ui";

/** Desktop discovery controls become a native, light-dismiss popover on phones. */
export function DiscoveryFilters({
  tags,
  selected,
  onChange,
}: {
  tags: { name: string; count: number }[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const narrow = useNarrow();
  const id = useId();
  return (
    <div className="discovery-filters">
      <p className="discovery-label">Discover</p>
      <button className="filter-toggle" popoverTarget={id} aria-label="Filter by hashtag">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="3" />
          <circle cx="15" cy="17" r="3" />
        </svg>
      </button>
      <div id={id} className="filter-options" popover={narrow ? "auto" : undefined}>
        <nav className="tagbar" aria-label="Filter by hashtag">
          {tags.map(({ name, count }) => {
            const on = selected.includes(name);
            return (
              <button
                key={name}
                className={`sticker${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((tag) => tag !== name) : [...selected, name])
                }
              >
                #{name}
                <small>{count}</small>
              </button>
            );
          })}
        </nav>
        <p className="tagbar-note">
          {tags.length ? "Hashtags in these posts" : "No hashtags available."}
        </p>
      </div>
    </div>
  );
}

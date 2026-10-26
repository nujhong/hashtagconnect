import { postUrl, type Person, type Post } from "./people.ts";

export type OpenTarget = { person: Person; post?: never } | { post: Post; person?: never };

/** Kept profiles open once per person; unlinked posts keep their own X link. */
export function unopenedTargets(entries: { person: Person | null; source: Post | null; openedAt: number | null }[]): OpenTarget[] {
  const seen = new Set<string>();
  return entries.flatMap<OpenTarget>((entry) => {
    const key = entry.person ? `person:${entry.person.id}` : entry.source ? `post:${entry.source.id}` : null;
    if (entry.openedAt !== null || !key || seen.has(key)) return [];
    seen.add(key);
    return entry.person ? [{ person: entry.person }] : [{ post: entry.source! }];
  });
}

/** Runs synchronously inside a click. Only successfully opened tabs may be recorded as opened. */
export function openXTabs(targets: OpenTarget[], open = window.open.bind(window)) {
  const opened: OpenTarget[] = [];
  for (const target of targets) {
    let tab: Window | null = null;
    try {
      // noopener in windowFeatures returns null even on success. Detach the blank tab before navigating.
      tab = open("about:blank", "_blank");
      if (!tab) continue;
      tab.opener = null;
      tab.location.replace(target.person ? target.person.profileUrl : postUrl(target.post.id));
      opened.push(target);
    } catch { tab?.close(); }
  }
  return { opened, blocked: targets.length - opened.length };
}

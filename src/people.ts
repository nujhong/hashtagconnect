export type Choice = "save" | "skip";

export type Person = { id: string; handle: string; profileUrl: string; onPlatform?: boolean };

export type Post = {
  id: string;
  url: string;
  addedAt: number;
  pooledAt: number | null;
  choice: Choice | null;
  openedAt: number | null;
  person: Person | null;
  tags?: string[];
};

export type PersonEntry = {
  person: Person;
  choice: Choice | null;
  openedAt: number | null;
  updatedAt: number;
  sourcePost: Post | null;
};

export type Discovery = { posts: Post[]; people: PersonEntry[] };

/** Profile links are supplied and confirmed by the curator, never inferred from a post URL. */
export function profileFromInput(value: string): Omit<Person, "id"> | null {
  let handle = value.trim().replace(/^@/, "");
  if (handle.includes(":")) {
    try {
      const url = new URL(handle);
      if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)) return null;
      handle = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] ?? "";
    } catch { return null; }
  }
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) ||
    /^(?:i|home|explore|search|notifications|messages|settings|compose|intent|hashtag|login|signup|share|tos|privacy)$/i.test(handle)) return null;
  return { handle, profileUrl: `https://x.com/${handle.toLowerCase()}` };
}

export function personKey(post: Post): string {
  return post.person ? `person:${post.person.id}` : `post:${post.id}`;
}

/** Keep the newest visible introduction for each person; unlinked posts remain distinct. */
export function dedupePeople(posts: Post[]): Post[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = personKey(post);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function postIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname))
      return null;
    return url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/([1-9]\d{0,24})(?:\/(?:photo|video)\/\d+)?\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function postUrl(id: string): string {
  // The submitted handle may be wrong or later change. The post ID is stable.
  return `https://x.com/i/web/status/${id}`;
}

export function postFromUrl(value: string, now = Date.now()): Post | null {
  const id = postIdFromUrl(value);
  return id ? { id, url: postUrl(id), addedAt: now, pooledAt: null, choice: null, openedAt: null, person: null } : null;
}

/**
 * Real public #connect posts picked by hand from X search on 2026-10-26, used only in the browser sandbox.
 * Tags are what was visible in each post, never read from X by the app.
 */
export const SANDBOX_SEEDS: { url: string; profileUrl: string; tags: string[] }[] = [
  { url: "https://x.com/kunalsahu20_/status/2114239978318565724", profileUrl: "https://x.com/kunalsahu20_", tags: ["connect", "building"] },
  { url: "https://x.com/satya5n21/status/2114283055573790869", profileUrl: "https://x.com/satya5n21", tags: ["connect"] },
  { url: "https://x.com/luckyzz_here/status/2114326414522753246", profileUrl: "https://x.com/luckyzz_here", tags: ["connect"] },
  { url: "https://x.com/Sladjana____/status/2112910969621893185", profileUrl: "https://x.com/Sladjana____", tags: ["connect"] },
  { url: "https://x.com/neo_subhamoy/status/2113206007837212871", profileUrl: "https://x.com/neo_subhamoy", tags: ["connect", "tech"] },
];
export const LEGACY_DEMO_ID = "1346889436626259968";

/**
 * Adds sandbox seeds the browser hasn't seen yet. Existing posts, choices and tags win;
 * a seed is merged once, so removing it from the sandbox pool sticks.
 * The old API demo post is dropped unless the visitor made a choice on it.
 */
export function mergeSeeds(
  state: { posts: Post[]; tags: Record<string, string[]>; seeded: string[] },
  now = Date.now(),
): { posts: Post[]; tags: Record<string, string[]>; seeded: string[] } {
  const posts = state.posts.filter((p) => p.id !== LEGACY_DEMO_ID || p.choice !== null || p.openedAt !== null);
  const tags = { ...state.tags };
  const seeded = [...state.seeded];
  for (const seed of SANDBOX_SEEDS) {
    const post = postFromUrl(seed.url, now);
    const profile = profileFromInput(seed.profileUrl);
    if (!post || !profile) continue;
    const person = { ...profile, id: `sandbox:${profile.profileUrl}` };
    const existing = posts.findIndex((p) => p.id === post.id);
    if (existing !== -1 && !posts[existing]!.person) posts[existing] = { ...posts[existing]!, person };
    if (seeded.includes(post.id)) continue;
    seeded.push(post.id);
    tags[post.id] ??= seed.tags;
    if (existing === -1) posts.push({ ...post, pooledAt: now, person });
  }
  return { posts, tags, seeded };
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

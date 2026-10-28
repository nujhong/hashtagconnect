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

/** Profile links are normalized separately from post URLs; a URL path does not establish its author. */
export function profileFromInput(value: string): Omit<Person, "id"> | null {
  let handle = value.trim().replace(/^@/, "");
  if (handle.includes(":")) {
    try {
      const url = new URL(handle);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)
      )
        return null;
      handle = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] ?? "";
    } catch {
      return null;
    }
  }
  if (
    !/^[A-Za-z0-9_]{1,15}$/.test(handle) ||
    /^(?:i|home|explore|search|notifications|messages|settings|compose|intent|hashtag|login|signup|share|tos|privacy)$/i.test(
      handle,
    )
  )
    return null;
  return { handle, profileUrl: `https://x.com/${handle.toLowerCase()}` };
}

export function personKey(post: Post): string {
  return post.person ? `person:${post.person.id}` : `post:${post.id}`;
}

/** Keep the newest visible introduction for each person, preferring the pinned post when present; unlinked posts remain distinct. */
export function dedupePeople(posts: Post[], pinnedPostId?: string): Post[] {
  const seen = new Set<string>();
  const ordered = pinnedPostId
    ? [...posts].sort((a, b) => Number(b.id === pinnedPostId) - Number(a.id === pinnedPostId))
    : posts;
  return ordered.filter((post) => {
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
    return (
      url.pathname.match(
        /^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/([1-9]\d{0,24})(?:\/(?:photo|video)\/\d+)?\/?$/,
      )?.[1] ?? null
    );
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
  return id
    ? {
        id,
        url: postUrl(id),
        addedAt: now,
        pooledAt: null,
        choice: null,
        openedAt: null,
        person: null,
      }
    : null;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export type GuestDecision = { postId: string; choice: Post["choice"]; openedAt: number | null };

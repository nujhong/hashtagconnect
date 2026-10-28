import {
  profileFromInput,
  postFromUrl,
  type Person,
  type Post,
  type GuestDecision,
} from "~/shared/people";

/** Guest choices stay in this browser; a fresh checkout starts empty until its landing post is supplied in Git. */
export const guestKey = "hashtagconnect-guest";
export const shortcutsKey = "hashtagconnect-letter-shortcuts";

export type Tags = Record<string, string[]>;

const isPerson = (v: unknown): v is Person =>
  typeof v === "object" &&
  v !== null &&
  ["id", "handle", "profileUrl"].every(
    (k) => typeof (v as Record<string, unknown>)[k] === "string",
  ) &&
  Boolean(profileFromInput((v as Person).profileUrl));

/** Restore existing guest posts, choices and tags without injecting samples or maintaining seed history. */
export function restoreGuest(
  storage: Pick<Storage, "getItem"> = localStorage,
  pool: Post[] = [],
): {
  posts: Post[];
  tags: Tags;
} {
  let stored: { posts?: unknown; tags?: unknown } | null = null;
  try {
    // Read the old key only until the next save writes the current key.
    stored = JSON.parse(
      storage.getItem(guestKey) ?? storage.getItem("xconnect-preview-v3") ?? "null",
    );
  } catch {
    /* start fresh */
  }
  const posts: Post[] = Array.isArray(stored?.posts)
    ? stored.posts.flatMap((row: Partial<Post>) => {
        const post = typeof row?.url === "string" ? postFromUrl(row.url) : null;
        if (!post) return [];
        return [
          {
            ...post,
            addedAt: typeof row.addedAt === "number" ? row.addedAt : post.addedAt,
            pooledAt: typeof row.pooledAt === "number" ? row.pooledAt : null,
            choice: row.choice === "save" || row.choice === "skip" ? row.choice : null,
            openedAt: typeof row.openedAt === "number" ? row.openedAt : null,
            person: isPerson(row.person) ? row.person : null,
          },
        ];
      })
    : [];
  const tags = typeof stored?.tags === "object" && stored.tags ? (stored.tags as Tags) : {};
  const saved = new Map(posts.map((post) => [post.id, post]));
  const pooledIds = new Set(pool.map((post) => post.id));
  return {
    posts: [
      ...pool.map((post) => {
        const previous = saved.get(post.id);
        return {
          ...post,
          person: post.person ?? previous?.person ?? null,
          choice: previous?.choice ?? null,
          openedAt: previous?.openedAt ?? null,
        };
      }),
      ...posts
        .filter((post) => !pooledIds.has(post.id) && (post.choice || post.openedAt))
        .map((post) => ({ ...post, pooledAt: null })),
    ],
    tags: { ...tags, ...Object.fromEntries(pool.map((post) => [post.id, post.tags ?? []])) },
  };
}

/** Keep the browser copy until every batch succeeds, so an interrupted sign-in can retry. */
export async function importGuestState(
  storage: Pick<Storage, "getItem" | "setItem">,
  submit: (entries: GuestDecision[]) => Promise<unknown>,
): Promise<boolean> {
  const entries = restoreGuest(storage).posts.map((post) => ({
    postId: post.id,
    choice: post.choice,
    openedAt: Number.isSafeInteger(post.openedAt) && post.openedAt! >= 0 ? post.openedAt : null,
  }));
  if (!entries.length) return false;
  for (let i = 0; i < entries.length; i += 50) await submit(entries.slice(i, i + 50));
  // An empty current key also prevents the legacy key from being restored again.
  storage.setItem(guestKey, JSON.stringify({ posts: [], tags: {} }));
  return true;
}

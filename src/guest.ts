import { profileFromInput, postFromUrl, type Person, type Post } from "./people";

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
export function restoreGuest(storage: Pick<Storage, "getItem"> = localStorage): {
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
  return { posts, tags };
}

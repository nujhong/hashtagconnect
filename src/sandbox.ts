import { mergeSeeds, postFromUrl, type Person, type Post } from "./people";

/** Browser-only sandbox storage for signed-out visitors and the auth preview. Keys keep their original names. */
export const previewKey = "xconnect-preview-v3";
export const embedConsentKey = "xconnect-x-embeds";
export const lettersKey = "hashtagconnect-letter-shortcuts";

export type Tags = Record<string, string[]>;

export const isPerson = (v: unknown): v is Person => typeof v === "object" && v !== null &&
  ["id", "handle", "profileUrl"].every((k) => typeof (v as Record<string, unknown>)[k] === "string");

export function restorePreview(): { posts: Post[]; tags: Tags; seeded: string[] } {
  let stored: { posts?: unknown; tags?: unknown; seeded?: unknown } | null = null;
  try { stored = JSON.parse(localStorage.getItem(previewKey) ?? "null"); } catch { /* start fresh */ }
  const posts: Post[] = Array.isArray(stored?.posts) ? stored.posts.flatMap((row: Partial<Post>) => {
    const post = typeof row?.url === "string" ? postFromUrl(row.url) : null;
    if (!post) return [];
    return [{ ...post,
      addedAt: typeof row.addedAt === "number" ? row.addedAt : post.addedAt,
      pooledAt: typeof row.pooledAt === "number" ? row.pooledAt : null,
      choice: row.choice === "save" || row.choice === "skip" ? row.choice : null,
      openedAt: typeof row.openedAt === "number" ? row.openedAt : null,
      person: isPerson(row.person) ? row.person : null,
    }];
  }) : [];
  const tags = typeof stored?.tags === "object" && stored.tags ? stored.tags as Tags : {};
  const seeded = Array.isArray(stored?.seeded) ? stored.seeded.filter((s): s is string => typeof s === "string") : [];
  return mergeSeeds({ posts, tags, seeded });
}

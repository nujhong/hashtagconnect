import type { Discovery, Post } from "./people";
import { PINNED_POST_ID } from "./pinned-post";

/** Seven days spans fourteen planned 12-hour ingestion cycles; adjust here without changing ingestion. */
export const DISCOVERY_RETENTION_DAYS = 7;

/** Snowflake creation time is stable when the same URL is ingested again. */
export function postCreatedAt(id: string): number {
  return Number(BigInt(id) >> 22n) + 1288834974657;
}

/** Expiry changes discovery visibility, never stored posts, decisions or Stash relationships. */
export function applyDiscoveryRetention(discovery: Discovery, now = Date.now()): Discovery {
  const cutoff = now - DISCOVERY_RETENTION_DAYS * 86_400_000;
  const expire = (post: Post): Post =>
    post.id !== PINNED_POST_ID && postCreatedAt(post.id) <= cutoff
      ? { ...post, pooledAt: null }
      : post;
  return {
    posts: discovery.posts
      .map(expire)
      .filter((post) => post.pooledAt !== null || post.choice !== null || post.openedAt !== null),
    people: discovery.people.map((entry) => ({
      ...entry,
      sourcePost: entry.sourcePost ? expire(entry.sourcePost) : null,
    })),
  };
}

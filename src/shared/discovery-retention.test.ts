import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import {
  applyDiscoveryRetention,
  DISCOVERY_RETENTION_DAYS,
  postCreatedAt,
} from "./discovery-retention";
import { postFromUrl } from "./people";
import { PINNED_POST_ID } from "./pinned-post";

const now = Date.UTC(2026, 9, 28);
const cutoff = now - DISCOVERY_RETENTION_DAYS * 86_400_000;
const postAt = (createdAt: number) => ({
  ...postFromUrl(`https://x.com/i/web/status/${BigInt(createdAt - 1288834974657) << 22n}`, now)!,
  pooledAt: now,
});

test("discovery expires at seven days from creation, not ingestion, without mutating inputs", () => {
  const expired = postAt(cutoff);
  const fresh = postAt(cutoff + 1);
  const older = postAt(cutoff - 1);
  const withdrawn = { ...postAt(now), pooledAt: null };
  const posts = [expired, fresh, older, withdrawn];
  assert.deepEqual(applyDiscoveryRetention({ posts, people: [] }, now).posts, [fresh]);
  assert.equal(expired.pooledAt, now);
  assert.equal(postCreatedAt(fresh.id), cutoff + 1);
  assert.equal(applyDiscoveryRetention({ posts: [fresh], people: [] }, now + 1).posts.length, 0);
});

test("the pinned introduction stays eligible but an explicitly withdrawn pin stays withdrawn", () => {
  const pinned = { ...postAt(cutoff - 1), id: PINNED_POST_ID };
  const later = postCreatedAt(PINNED_POST_ID) + 365 * 86_400_000;
  assert.deepEqual(applyDiscoveryRetention({ posts: [pinned], people: [] }, later).posts, [pinned]);
  assert.deepEqual(
    applyDiscoveryRetention({ posts: [{ ...pinned, pooledAt: null }], people: [] }, later).posts,
    [],
  );
});

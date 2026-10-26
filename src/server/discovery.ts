import { people, personStates, posts, postStates } from "@schema";
import { and, db, desc, eq, isNotNull, or, sql } from "void/db";
import { env } from "void/env";
import type { AuthUser } from "void/auth";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { postFromUrl, profileFromInput, type Discovery } from "../people";
import { xAccountId } from "./x-identity";
import { platformMembership } from "./membership";

const personFields = { id: people.id, handle: people.handle, profileUrl: people.profileUrl };
export const stateTarget = z.union([
  z.object({ postId: z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  z.object({ personId: z.string().uuid() }).strict(),
]);
export type StateTarget = { postId: string } | { personId: string };

export async function isCurator(user: AuthUser): Promise<boolean> {
  return Boolean(env.CURATOR_X_ID && await xAccountId(user.id) === env.CURATOR_X_ID);
}

export async function requireCurator(user: AuthUser) {
  if (!await isCurator(user)) throw new HTTPException(403, { message: "Only the curator can change the shared pool." });
}

export async function listPosts(userId: string): Promise<Discovery> {
  const rows = await db.select({
    post: posts, person: personFields, onPlatform: platformMembership(sql`${people.handle}`),
    postChoice: postStates.choice, postOpenedAt: postStates.openedAt,
    personUser: personStates.userId, personChoice: personStates.choice, personOpenedAt: personStates.openedAt,
  }).from(posts)
    .leftJoin(people, eq(posts.personId, people.id))
    .leftJoin(postStates, and(eq(postStates.userId, userId), eq(postStates.postId, posts.id)))
    .leftJoin(personStates, and(eq(personStates.userId, userId), eq(personStates.personId, posts.personId)))
    .where(or(isNotNull(posts.pooledAt), isNotNull(postStates.userId)))
    .orderBy(desc(posts.pooledAt), desc(posts.addedAt));
  const saved = await db.select({ person: personFields, state: personStates, post: posts, onPlatform: platformMembership(sql`${people.handle}`) })
    .from(personStates).innerJoin(people, eq(personStates.personId, people.id))
    .leftJoin(posts, eq(personStates.sourcePostId, posts.id))
    .where(eq(personStates.userId, userId)).orderBy(desc(personStates.updatedAt));
  // shortcut: the curated MVP loads the whole pool; paginate when it reaches a few hundred posts.
  return {
    posts: rows.map(({ post, person, onPlatform, postChoice, postOpenedAt, personUser, personChoice, personOpenedAt }) => ({
      ...post, person: person ? { ...person, onPlatform } : null,
      // An explicit clear at person level must override older post-level saves too.
      choice: personUser ? personChoice : postChoice,
      openedAt: personUser ? personOpenedAt : postOpenedAt,
    })),
    people: saved.map(({ person, state, post, onPlatform }) => {
      const member = { ...person, onPlatform };
      return {
        person: member, choice: state.choice, openedAt: state.openedAt, updatedAt: state.updatedAt,
        sourcePost: post ? { ...post, person: member, choice: state.choice, openedAt: state.openedAt } : null,
      };
    }),
  };
}

export async function requirePostAccess(userId: string, postId: string) {
  const [post] = await db.select({ id: posts.id, personId: posts.personId }).from(posts)
    .leftJoin(postStates, and(eq(postStates.userId, userId), eq(postStates.postId, posts.id)))
    .where(and(eq(posts.id, postId), or(isNotNull(posts.pooledAt), isNotNull(postStates.userId))))
    .limit(1);
  if (!post) throw new HTTPException(404, { message: "This post is no longer in your pool or queue." });
  return post;
}

export async function resolveTarget(userId: string, target: StateTarget) {
  if ("postId" in target) {
    const post = await requirePostAccess(userId, target.postId);
    return { postId: post.id, personId: post.personId };
  }
  const [person] = await db.select({ personId: people.id, postId: posts.id }).from(people)
    .leftJoin(personStates, and(eq(personStates.userId, userId), eq(personStates.personId, people.id)))
    .leftJoin(posts, eq(posts.personId, people.id))
    .where(and(eq(people.id, target.personId), or(isNotNull(personStates.userId), isNotNull(posts.pooledAt))))
    .orderBy(desc(posts.pooledAt)).limit(1);
  if (!person) throw new HTTPException(404, { message: "This person is no longer in your pool or Stash." });
  return person;
}

export async function importPost(userId: string, url: string, shared: boolean, author?: { profileUrl: string; confirmed: boolean }) {
  const post = postFromUrl(url);
  if (!post) throw new HTTPException(400, { message: "Paste an HTTPS post URL from x.com or twitter.com." });
  const { id, addedAt } = post;
  if (shared) {
    const [existing] = await db.select({ personId: posts.personId }).from(posts).where(eq(posts.id, id));
    let personId = existing?.personId ?? null;
    if (author) {
      const profile = profileFromInput(author.profileUrl);
      if (!author.confirmed || !profile) throw new HTTPException(400, { message: "Confirm the author's X profile link before publishing." });
      if (personId) {
        const [current] = await db.select(personFields).from(people).where(eq(people.id, personId));
        if (current?.profileUrl !== profile.profileUrl) throw new HTTPException(409, { message: "This post already has a confirmed author. Use the confirmed profile for this post." });
      } else {
        const [person] = await db.insert(people).values({
          id: crypto.randomUUID(), ...profile, confirmedBy: userId, updatedAt: addedAt,
        }).onConflictDoUpdate({ target: people.profileUrl, set: { handle: profile.handle, confirmedBy: userId, updatedAt: addedAt } })
          .returning(personFields);
        personId = person!.id;
      }
    }
    if (!personId) throw new HTTPException(400, { message: "Add and confirm the author's X profile link before publishing." });
    await db.batch([
      db.insert(posts).values({ id, url: post.url, addedAt, pooledAt: addedAt, personId })
        .onConflictDoUpdate({ target: posts.id, set: {
          // Re-adding a URL must not make an existing pool entry look new.
          pooledAt: sql`coalesce(${posts.pooledAt}, ${addedAt})`, personId,
        } }),
      // Linking a legacy post promotes its choices, preserving the most recent decision.
      db.insert(personStates).select(db.select({
        userId: postStates.userId, personId: sql<string>`${personId}`.as("person_id"), sourcePostId: postStates.postId,
        choice: postStates.choice, openedAt: postStates.openedAt, updatedAt: postStates.updatedAt,
      }).from(postStates).where(eq(postStates.postId, id)))
        .onConflictDoUpdate({ target: [personStates.userId, personStates.personId], set: {
          choice: sql`case when excluded.updated_at > ${personStates.updatedAt} then excluded.choice else ${personStates.choice} end`,
          openedAt: sql`nullif(max(coalesce(${personStates.openedAt}, 0), coalesce(excluded.opened_at, 0)), 0)`,
          sourcePostId: sql`case when excluded.updated_at > ${personStates.updatedAt} then excluded.source_post_id
            else coalesce(${personStates.sourcePostId}, excluded.source_post_id) end`,
          updatedAt: sql`max(${personStates.updatedAt}, excluded.updated_at)`,
        } }),
      db.delete(postStates).where(eq(postStates.postId, id)),
    ]);
  } else {
    const [linked] = await db.select({ personId: posts.personId }).from(posts).where(eq(posts.id, id));
    if (linked?.personId) {
      await db.insert(personStates).values({ userId, personId: linked.personId, sourcePostId: id, choice: "save", updatedAt: addedAt })
        .onConflictDoUpdate({ target: [personStates.userId, personStates.personId], set: { choice: "save", sourcePostId: id, updatedAt: addedAt } });
    } else {
      await db.batch([
        db.insert(posts).values({ id, url: post.url, addedAt }).onConflictDoNothing(),
        db.insert(postStates).values({ userId, postId: id, choice: "save", updatedAt: addedAt })
          .onConflictDoUpdate({ target: [postStates.userId, postStates.postId], set: { choice: "save", updatedAt: addedAt } }),
      ]);
    }
  }
  return listPosts(userId);
}

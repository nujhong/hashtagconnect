import { people, personStates, posts, postStates } from "@schema";
import { and, db, desc, eq, isNotNull, or, sql } from "void/db";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Discovery } from "~/src/people";
import { platformMembership } from "./membership";

const personFields = { id: people.id, handle: people.handle, profileUrl: people.profileUrl };
export const stateTarget = z.union([
  z.object({ postId: z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  z.object({ personId: z.string().uuid() }).strict(),
]);
export type StateTarget = { postId: string } | { personId: string };

export async function listPosts(userId: string): Promise<Discovery> {
  const rows = await db
    .select({
      post: posts,
      person: personFields,
      onPlatform: platformMembership(sql`${people.handle}`),
      postChoice: postStates.choice,
      postOpenedAt: postStates.openedAt,
      personUser: personStates.userId,
      personChoice: personStates.choice,
      personOpenedAt: personStates.openedAt,
    })
    .from(posts)
    .leftJoin(people, eq(posts.personId, people.id))
    .leftJoin(postStates, and(eq(postStates.userId, userId), eq(postStates.postId, posts.id)))
    .leftJoin(
      personStates,
      and(eq(personStates.userId, userId), eq(personStates.personId, posts.personId)),
    )
    .where(or(isNotNull(posts.pooledAt), isNotNull(postStates.userId)))
    .orderBy(desc(posts.pooledAt), desc(posts.addedAt));
  const saved = await db
    .select({
      person: personFields,
      state: personStates,
      post: posts,
      onPlatform: platformMembership(sql`${people.handle}`),
    })
    .from(personStates)
    .innerJoin(people, eq(personStates.personId, people.id))
    .leftJoin(posts, eq(personStates.sourcePostId, posts.id))
    .where(eq(personStates.userId, userId))
    .orderBy(desc(personStates.updatedAt));
  // shortcut: discovery loads the whole pool; paginate when it reaches a few hundred posts.
  return {
    posts: rows.map(
      ({
        post,
        person,
        onPlatform,
        postChoice,
        postOpenedAt,
        personUser,
        personChoice,
        personOpenedAt,
      }) => ({
        ...post,
        person: person ? { ...person, onPlatform } : null,
        // An explicit clear at person level must override older post-level saves too.
        choice: personUser ? personChoice : postChoice,
        openedAt: personUser ? personOpenedAt : postOpenedAt,
      }),
    ),
    people: saved.map(({ person, state, post, onPlatform }) => {
      const member = { ...person, onPlatform };
      return {
        person: member,
        choice: state.choice,
        openedAt: state.openedAt,
        updatedAt: state.updatedAt,
        sourcePost: post
          ? { ...post, person: member, choice: state.choice, openedAt: state.openedAt }
          : null,
      };
    }),
  };
}

export async function requirePostAccess(userId: string, postId: string) {
  const [post] = await db
    .select({ id: posts.id, personId: posts.personId })
    .from(posts)
    .leftJoin(postStates, and(eq(postStates.userId, userId), eq(postStates.postId, posts.id)))
    .where(and(eq(posts.id, postId), or(isNotNull(posts.pooledAt), isNotNull(postStates.userId))))
    .limit(1);
  if (!post)
    throw new HTTPException(404, { message: "This post is no longer in your pool or queue." });
  return post;
}

export async function resolveTarget(userId: string, target: StateTarget) {
  if ("postId" in target) {
    const post = await requirePostAccess(userId, target.postId);
    return { postId: post.id, personId: post.personId };
  }
  const [person] = await db
    .select({ personId: people.id, postId: posts.id })
    .from(people)
    .leftJoin(
      personStates,
      and(eq(personStates.userId, userId), eq(personStates.personId, people.id)),
    )
    .leftJoin(posts, eq(posts.personId, people.id))
    .where(
      and(
        eq(people.id, target.personId),
        or(isNotNull(personStates.userId), isNotNull(posts.pooledAt)),
      ),
    )
    .orderBy(desc(posts.pooledAt))
    .limit(1);
  if (!person)
    throw new HTTPException(404, { message: "This person is no longer in your pool or Stash." });
  return person;
}

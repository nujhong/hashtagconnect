import { createPlaceholderEmail } from "@better-auth/core/utils/email";
import { z } from "zod";

const profileSchema = z.object({
  data: z.object({
    id: z.string().regex(/^\d+$/),
    name: z.string(),
    username: z.string(),
    description: z.string().optional(),
    profile_image_url: z.string().optional(),
    entities: z
      .object({
        description: z
          .object({
            urls: z
              .array(z.object({ url: z.string(), display_url: z.string().optional() }))
              .optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

/** Better Auth's supported user-info hook adds the bio to the existing OAuth profile lookup. */
export async function getXUserInfo(token: { accessToken?: string }, request = fetch) {
  if (!token.accessToken) return null;
  const response = await request(
    "https://api.x.com/2/users/me?user.fields=profile_image_url,description,entities",
    {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) return null;
  const parsed = profileSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  // X returns bio links as t.co shortlinks; store the bio as people see it on X, with each link's display text.
  // The entities are only needed for that, so they stay out of the profile handed to Better Auth.
  const { entities, ...data } = parsed.data.data;
  const profile = { data };
  const bio = (entities?.description?.urls ?? []).reduce(
    (text, { url, display_url }) => (display_url ? text.replaceAll(url, display_url) : text),
    data.description ?? "",
  );
  return {
    user: {
      name: profile.data.name,
      email: createPlaceholderEmail({ identifier: profile.data.id, namespace: "twitter" }),
      emailVerified: false,
      image: profile.data.profile_image_url,
      xUsername: profile.data.username,
      xAccountId: profile.data.id,
      xBio: bio,
    },
    data: profile,
  };
}

import { createPlaceholderEmail } from "@better-auth/core/utils/email";
import { z } from "zod";

const profileSchema = z.object({ data: z.object({
  id: z.string().regex(/^\d+$/), name: z.string(), username: z.string(),
  description: z.string().optional(), profile_image_url: z.string().optional(),
}) });

/** Better Auth's supported user-info hook adds the bio to the existing OAuth profile lookup. */
export async function getXUserInfo(token: { accessToken?: string }, request = fetch) {
  if (!token.accessToken) return null;
  const response = await request("https://api.x.com/2/users/me?user.fields=profile_image_url,description", {
    headers: { Authorization: `Bearer ${token.accessToken}` }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const parsed = profileSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  const profile = parsed.data;
  return {
    user: {
      name: profile.data.name,
      email: createPlaceholderEmail({ identifier: profile.data.id, namespace: "twitter" }),
      emailVerified: false,
      image: profile.data.profile_image_url,
      xUsername: profile.data.username, xAccountId: profile.data.id,
      xBio: profile.data.description ?? "",
    },
    data: profile,
  };
}

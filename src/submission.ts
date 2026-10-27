import { z } from "zod";
import { postFromUrl, profileFromInput } from "./people.ts";

export const curatorTags = z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,40}$/)).max(8).transform((tags) => [...new Set(tags)]);
export const submissionInput = z.object({
  profileUrl: z.string().max(200).refine((value) => Boolean(profileFromInput(value)), "Use an X profile URL or @handle."),
  postUrl: z.string().max(500).refine((value) => Boolean(postFromUrl(value)), "Use a public X post URL."),
  description: z.string().trim().max(280).default(""),
}).transform((value) => ({ ...value, profileUrl: profileFromInput(value.profileUrl)!.profileUrl, postUrl: postFromUrl(value.postUrl)!.url }));

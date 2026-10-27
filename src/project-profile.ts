import { z } from "zod";

/** Project links are public web pages, never local addresses, credentials or X timelines. */
export const projectUrl = z.string().trim().max(2048).transform((input, ctx) => {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|x\.com|twitter\.com)$/.test(host)) throw new Error();
    url.hash = "";
    return url.href;
  } catch {
    ctx.addIssue({ code: "custom", message: "Use a public HTTPS project link." });
    return z.NEVER;
  }
});

export const projectProfileSchema = z.object({
  url: projectUrl,
  summary: z.string().trim().min(20).max(600),
});
export type ProjectProfile = z.infer<typeof projectProfileSchema>;
export type ProjectDraft = ProjectProfile & { excerpt: string };

/** Suggestions never trigger a visit; the member chooses a link before Browser Run reads it. */
export function bioProjectLinks(bio: string | null): string[] {
  const links = (bio ?? "").match(/https:\/\/[^\s<>]+/gi) ?? [];
  return [...new Set(links.flatMap((link) => {
    const parsed = projectUrl.safeParse(link.replace(/[.,;!?)]+$/, ""));
    return parsed.success ? [parsed.data] : [];
  }))].slice(0, 3);
}

export type ViewerProfile = { bio: string | null; sentence: string; project: ProjectProfile | null };

/** Name only the inputs actually supplied; a project is labelled by its own URL, never a sample brand. */
export function profileInputLabel(profile: ViewerProfile): string {
  const parts: string[] = [];
  if (profile.bio?.trim()) parts.push("your bio");
  if (profile.sentence.trim()) parts.push("your context");
  if (profile.project) {
    const url = new URL(profile.project.url);
    parts.push(url.hostname.replace(/^www\./, "") + (url.hostname === "github.com" ? url.pathname.replace(/\/$/, "") : ""));
  }
  return parts.length ? `Using ${parts.join(" + ")}` : "Add context for your scan";
}

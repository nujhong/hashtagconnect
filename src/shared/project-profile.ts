import { z } from "zod";

/** Project links are public web pages, never local addresses, credentials or X timelines. */
export const projectUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((input, ctx) => {
    try {
      const url = new URL(input);
      const host = url.hostname.toLowerCase().replace(/\.$/, "");
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !host.includes(".") ||
        /^[\d.]+$/.test(host) ||
        host.includes(":") ||
        /(?:^|\.)(?:localhost|local|internal|test|invalid|x\.com|twitter\.com)$/.test(host)
      )
        throw new Error();
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
  /** Short topic phrases from the project page; scans check these instead of splitting the summary. Optional for older saves. */
  topics: z.array(z.string().trim().min(2).max(60)).max(5).optional(),
});
export type ProjectProfile = z.infer<typeof projectProfileSchema>;
export type ProjectDraft = ProjectProfile & { excerpt: string };

/**
 * Valid public links in bio order; initial profile setup reads the first, Settings can use the rest. Bios are stored as
 * X shows them, so links usually have no scheme (kepler.so). X shortens long ones with "…", which can't be followed.
 * ponytail: a lowercase host keeps names like Node.js out; a lowercase "node.js" would still be suggested and fail to read.
 */
export function bioProjectLinks(bio: string | null): string[] {
  const links = (bio ?? "").split(/\s+/).flatMap((token) => {
    const link = token.replace(/[.,;!?)]+$/, "");
    const host = link.replace(/^https?:\/\//i, "").split("/")[0]!;
    if (
      link.endsWith("…") ||
      host !== host.toLowerCase() ||
      !/^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?$/i.test(link)
    )
      return [];
    const parsed = projectUrl.safeParse(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    return parsed.success ? [parsed.data] : [];
  });
  return [...new Set(links)].slice(0, 3);
}

export type ViewerProfile = {
  bio: string | null;
  sentence: string;
  project: ProjectProfile | null;
};

/** Name only the inputs actually supplied; a project is labelled by its own URL, never a sample brand. */
export function profileInputLabel(profile: ViewerProfile): string {
  const parts: string[] = [];
  if (profile.bio?.trim()) parts.push("your bio");
  if (profile.sentence.trim()) parts.push("your context");
  if (profile.project) {
    const url = new URL(profile.project.url);
    // Projects saved before short links were expanded still say t.co, which names X's redirector, not the project.
    parts.push(
      url.hostname === "t.co"
        ? "your project"
        : url.hostname.replace(/^www\./, "") +
            (url.hostname === "github.com" ? url.pathname.replace(/\/$/, "") : ""),
    );
  }
  return parts.length ? `Using ${parts.join(" + ")}` : "Add context for your scan";
}

/** Durable progress for the one automatic bio import; null means there is no outstanding import. */
export type ProjectImport = {
  state: "queued" | "reading" | "failed";
  startedAt: number;
  error?: string;
};

/** Stop waiting after an interrupted job; a member can always read a link manually in Settings. */
export function projectImportProgress(
  progress: ProjectImport | null,
  now = Date.now(),
): { status: "pending" | "done" | "failed"; error?: string } {
  if (!progress) return { status: "done" };
  if (progress.state === "failed" || now - progress.startedAt > 120_000)
    return {
      status: "failed",
      error:
        progress.error ?? "Your project import didn’t finish. You can read the link in Settings.",
    };
  return { status: "pending" };
}

import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db } from "void/db";
import { BrowserRunBudgetError, reserveBrowserRun } from "~/server/browser-run-budget";
import { env } from "void/env";
import { z } from "zod";
import { projectUrl } from "~/shared/project-profile";
import { buildProjectProfile, ProjectReadError } from "~/server/project-profile";
import { scanSetup } from "~/server/scan-setup";

/** Preview only: a page visit never silently replaces a member's confirmed profile. */
export const POST = defineHandler.withValidator({ body: z.object({ url: projectUrl }) })(async (
  c,
  { body },
) => {
  requireAuth(c);
  const setup = scanSetup(env);
  if (setup.status !== "ready")
    return c.json({ error: "The profile builder isn’t connected yet." }, 503);
  try {
    await reserveBrowserRun(db);
    const draft = await buildProjectProfile(c.env.BROWSER, setup.inference, body.url);
    return { draft };
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof ProjectReadError || error instanceof BrowserRunBudgetError
            ? error.message
            : "Couldn’t read that project. Try again shortly.",
      },
      error instanceof BrowserRunBudgetError ? 429 : 502,
    );
  }
});

import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { env } from "void/env";
import { z } from "zod";
import { projectUrl } from "~/src/project-profile";
import { buildProjectProfile, ProjectReadError } from "~/src/server/project-profile";
import { scanSetup } from "~/src/server/scan-setup";

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
    const draft = await buildProjectProfile(c.env.BROWSER, setup.jev, body.url);
    return { draft };
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof ProjectReadError
            ? error.message
            : "Couldn’t read that project. Try again shortly.",
      },
      502,
    );
  }
});

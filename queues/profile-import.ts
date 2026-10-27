import { defineQueue } from "void";
import { db } from "void/db";
import { env } from "void/env";
import { importBioProject, type ProjectImportMessage } from "~/src/server/project-from-bio";
import { buildProjectProfile, ProjectReadError } from "~/src/server/project-profile";
import { scanSetup } from "~/src/server/scan-setup";

export const maxBatchSize = 1;
export const maxBatchTimeout = 0;
// A failed paid read is retried explicitly in Settings, never automatically.
export const maxRetries = 0;

export default defineQueue<ProjectImportMessage>(async (batch, bindings) => {
  for (const message of batch.messages) {
    await importBioProject(db, message.body, async (url) => {
      const setup = scanSetup(env);
      if (setup.status !== "ready")
        throw new ProjectReadError(
          "Couldn’t read your project yet. You can try again in Settings.",
        );
      return buildProjectProfile(bindings.BROWSER, setup.jev, url);
    });
    message.ack();
  }
});

import { defineQueue } from "void";
import { db } from "void/db";
import { reserveBrowserRun } from "~/server/browser-run-budget";
import { env } from "void/env";
import { importBioProject, type ProjectImportMessage } from "~/server/project-from-bio";
import { buildProjectProfile, ProjectReadError } from "~/server/project-profile";
import { scanSetup } from "~/server/scan-setup";

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
      await reserveBrowserRun(db);
      return buildProjectProfile(bindings.BROWSER, setup.inference, url);
    });
    message.ack();
  }
});

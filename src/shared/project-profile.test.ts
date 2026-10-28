import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { projectUrl, bioProjectLinks, projectImportProgress } from "./project-profile.ts";
test("project URLs reject local addresses, credentials, non-web protocols and X pages", () => {
  for (const url of [
    "http://example.com",
    "file:///tmp/test",
    "https://user:pass@example.com",
    "https://localhost",
    "https://example.local",
    "https://127.0.0.1",
    "https://0x7f000001",
    "https://[::1]",
    "https://example.com:8080",
    "https://x.com/user",
    "https://www.twitter.com/user",
  ])
    assert.equal(projectUrl.safeParse(url).success, false, url);
  assert.equal(
    projectUrl.parse(" https://github.com/team/project#readme "),
    "https://github.com/team/project",
  );
  assert.deepEqual(
    bioProjectLinks("Making https://project.dev. Updates https://x.com/me — https://project.dev."),
    ["https://project.dev/"],
  );
  assert.deepEqual(bioProjectLinks(null), []);
  assert.deepEqual(
    bioProjectLinks("THE dev at kepler.so, see github.com/me/really-long-repo… Node.js fan"),
    ["https://kepler.so/"],
  );
});

test("an interrupted queue job stops the waiting UI instead of polling forever", () => {
  assert.deepEqual(projectImportProgress(null), { status: "done" });
  assert.equal(
    projectImportProgress({ state: "reading", startedAt: 1000 }, 2000).status,
    "pending",
  );
  assert.equal(
    projectImportProgress({ state: "reading", startedAt: 1000 }, 122000).status,
    "failed",
  );
});

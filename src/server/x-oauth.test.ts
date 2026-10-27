import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { getXUserInfo } from "./x-oauth.ts";
test("empty OAuth bio is distinct from a sign-in that never collected it", async () => {
  const result = await getXUserInfo({ accessToken: "test" }, async () =>
    Response.json({ data: { id: "10", name: "Viewer", username: "viewer" } }),
  );
  assert.equal(result?.user.xBio, "");
  assert.equal(
    await getXUserInfo({}, async () => {
      throw new Error("must not fetch");
    }),
    null,
  );
  assert.equal(
    await getXUserInfo({ accessToken: "test" }, async () => new Response(null, { status: 401 })),
    null,
  );
  assert.equal(
    await getXUserInfo({ accessToken: "test" }, async () =>
      Response.json({ data: { name: "No identity" } }),
    ),
    null,
  );
});
test("bios are stored as X shows them: link display text, not t.co shortlinks", async () => {
  const result = await getXUserInfo({ accessToken: "test" }, async () =>
    Response.json({
      data: {
        id: "10",
        name: "Viewer",
        username: "viewer",
        description: "THE dev at https://t.co/abc",
        entities: {
          description: { urls: [{ url: "https://t.co/abc", display_url: "kepler.so" }] },
        },
      },
    }),
  );
  assert.equal(result?.user.xBio, "THE dev at kepler.so");
});

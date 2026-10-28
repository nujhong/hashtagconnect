import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import configureAuth from "~/auth.ts";
import { bioProjectAfterOAuth } from "~/server/oauth-profile.ts";

test("OAuth persists and refreshes provider fields while direct profile edits stay disabled", async () => {
  assert.equal(typeof configureAuth, "function");
  if (typeof configureAuth !== "function") throw new Error("Expected auth configuration function");
  const options = configureAuth({
    defaults: {},
    dialect: "sqlite",
    request: new Request("http://localhost:3000"),
    env: {
      X_CLIENT_ID: "test-client",
      X_CLIENT_SECRET: "test-secret",
    },
  });
  const enqueued: { userId: string; bio: string | null }[] = [];
  options.hooks.after = bioProjectAfterOAuth(async (userId, bio) => {
    enqueued.push({ userId, bio });
  });
  const app = betterAuth({
    ...options,
    baseURL: "http://localhost:3000",
    secret: "test-only-secret-at-least-thirty-two-characters",
    logger: { disabled: true },
  });
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let bio = "Building desktop tools.";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    assert.equal(url.origin, "https://api.x.com");
    if (url.pathname === "/2/oauth2/token")
      return Response.json({
        access_token: "test-access",
        token_type: "bearer",
        expires_in: 7200,
        scope: "tweet.read users.read",
      });
    assert.equal(url.pathname, "/2/users/me");
    assert.equal(url.searchParams.get("user.fields"), "profile_image_url,description,entities");
    return Response.json({
      data: { id: "10", name: "Viewer", username: "viewer", description: bio },
    });
  };
  const cookieHeader = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  async function signIn() {
    const start = await app.handler(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ provider: "twitter", callbackURL: "/" }),
      }),
    );
    assert.equal(start.status, 200);
    const started = (await start.json()) as { url: string };
    const authorization = new URL(started.url);
    const callback = await app.handler(
      new Request(
        `http://localhost:3000/api/auth/callback/twitter?code=test-code&state=${authorization.searchParams.get("state")}`,
        {
          headers: { Cookie: cookieHeader(start) },
        },
      ),
    );
    assert.equal(callback.status, 302);
    assert.equal(
      new URL(callback.headers.get("location")!, "http://localhost:3000").searchParams.has("error"),
      false,
    );
    const headers = new Headers({ Cookie: cookieHeader(callback) });
    const session = await app.api.getSession({ headers });
    assert.ok(session?.user);
    return {
      user: session.user as typeof session.user & {
        xBio: string;
        xUsername: string;
        xAccountId: string;
      },
      headers,
    };
  }
  try {
    const first = await signIn();
    assert.equal(first.user.xBio, bio);
    assert.deepEqual(
      enqueued,
      [{ userId: first.user.id, bio }],
      "The server callback runs the import hook before any client page visit",
    );
    assert.equal(first.user.xUsername, "viewer");
    assert.equal(first.user.xAccountId, "10");
    bio = "Now building design tools.";
    const refreshed = await signIn();
    assert.equal(refreshed.user.id, first.user.id);
    assert.equal(refreshed.user.xBio, bio);
    assert.deepEqual(enqueued.at(-1), { userId: first.user.id, bio });
    assert.equal(
      enqueued.length,
      2,
      "Session reads do not enqueue; the D1 reservation deduplicates sign-ins",
    );
    await app.handler(
      new Request(
        "http://localhost:3000/api/auth/callback/twitter?error=access_denied&state=invalid",
      ),
    );
    assert.equal(enqueued.length, 2, "Failed OAuth callbacks never enqueue an import");
    const edited = await app.handler(
      new Request("http://localhost:3000/api/auth/update-user", {
        method: "POST",
        headers: {
          ...Object.fromEntries(refreshed.headers),
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ xBio: "Client-supplied bio", xAccountId: "999" }),
      }),
    );
    assert.equal(edited.status, 404);
    assert.deepEqual(calls, ["/2/oauth2/token", "/2/users/me", "/2/oauth2/token", "/2/users/me"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

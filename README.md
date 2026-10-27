<div align="center">
  <img src="public/favicon.svg" width="56" height="56" alt="">
  <h1>hashtagconnect</h1>
  <p><strong>Find your first circle on X.</strong></p>
  <p>Meet people who care about what you post—and whose posts you care about too.</p>
  <p>
    <a href="#how-it-works">How it works</a> ·
    <a href="#run-locally">Run locally</a> ·
    <a href="DESIGN.md">Design</a>
  </p>
</div>

## 🛠️ Stack

- **[Void](https://void.cloud)** — The full-stack foundation: routes, auth, D1 and background jobs on Cloudflare.
- **[Jev by TypeSafe](https://typesafe.ai)** — Compares each post with your bio and project, rates how relevant it is, and finds where your common ground appears in the post.
- **[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)** — Model requests, logging and unified billing.
- **[Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/)** — Reads project pages and captures each post so its common ground can be highlighted.
- **[React](https://react.dev)** — The interface and its reusable components.
- **[Motion](https://motion.dev)** — Transitions, gestures and feedback as you browse and keep people.

## 🌱 Why this exists

X’s [published algorithm](https://github.com/xai-org/x-algorithm) includes a [mutual-follow boost](https://github.com/xai-org/x-algorithm/blob/main/docs/BIDIRECTIONAL_BOOST_CHANGE.md): extra weight for predicted replies to original posts from people you mutually follow.

Our bet is simple: find people with shared interests, and give each other a reason to keep reading and replying. hashtagconnect helps make that first connection.

## How it works

| 🔎 Browse                                          | ✨ Find common ground                                                                                         | 🤝 Connect                                                |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------- |
| Explore #connect posts in their original X embeds. | Sign in to see how each post relates to your bio and project, with the common ground highlighted in the post. | Keep people in your Stash, then open their profiles on X. |

A project link in your bio fills out your context automatically. You can also add a link yourself, and review or edit your context in Settings.

**Status:** a side project, built because I wanted to use it myself.

**Built by AI agents, steered by a human.** Developed with Codex and Claude Code; product direction and final decisions stay human.

## Run locally

Requires Node.js 24.21.0 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp env.example .env
pnpm exec void db migrate
pnpm run dev
```

Open **http://127.0.0.1:5173**. Before committing, run `pnpm test` and `pnpm check`.

For sign-in, configure an X OAuth Web App with this callback:

```text
http://127.0.0.1:5173/api/auth/callback/twitter
```

Add its client ID and secret to `.env`. For scans, fill in the Cloudflare AI Gateway credentials in [env.example](env.example). Project reading and embed captures use Browser Run: set your Cloudflare account in `void.config.ts` and authenticate Wrangler.

## More

- [DESIGN.md](DESIGN.md): how it should look, move and read
- [docs/relevance.md](docs/relevance.md): how relevance is worked out, from your bio to the highlights
- [AGENTS.md](AGENTS.md): project conventions, commands and API style, for agents and people alike

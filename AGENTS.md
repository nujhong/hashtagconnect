<!--injected-by-void-v1.2.1-->

## Void

- This project uses [Void](https://void.cloud), a full-stack Vite framework for Cloudflare Workers with file-based API routing, server-rendered pages, and typed backend services.
- Use Void's CLI and typed APIs. Before working with Void, read the relevant Markdown docs in `node_modules/void/docs/`; start with `guide/quickstart.md` for setup and `reference/cli.md` for commands.

<!--/injected-by-void-->

## Project conventions

- Follow `DESIGN.md` for UI and copy, and `docs/relevance.md` for how scans and evidence work.
- Before finishing, run `pnpm run check` (Void types, format, lint, types) and `pnpm test` (`vp test`, unit and integration).
- Use pnpm and native Void/Vite+ interfaces before adding tools or adapters.
- Use `~/` for cross-directory imports; keep sibling and Node-loaded auth imports relative.
- API routes are resource nouns: `/api/me/*` for the viewer's private state, singletons singular, collections plural, project operations nested under `/api/me/project`. GET reads, POST submits work or a change, DELETE clears; request fields are camelCase; Better Auth owns `/api/auth/*`. Routes import the schema through Void's `@schema`.
- Prefer flat modules; add folders only for real boundaries (`components`, `server`). Colocate unit tests; put integration/e2e tests under root `tests/`.
- Test meaningful behavior and regressions. Probes, prompt wording and implementation mirrors do not belong in the suite. Provider adapters are tested against mocked responses, never the network or paid models; live provider experiments are manual verification.
- Keep one baseline migration until deployment is evidenced; preserve applied migrations afterward.
- Preserve doc comments unless explicitly asked to remove them.

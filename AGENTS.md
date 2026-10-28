<!--injected-by-void-v1.2.1-->

## Void

- This project uses [Void](https://void.cloud), React, TypeScript, Vite+, and pnpm on Cloudflare Workers.
- Before changing framework integration, read the relevant installed docs in `node_modules/void/docs/`; start with `guide/quickstart.md` and `reference/cli.md`. Use native Void/Vite+ interfaces before adding adapters.

<!--/injected-by-void-->

## Before changing code

- Read [architecture](docs/architecture.md) before changing module ownership or dependencies; [DESIGN.md](DESIGN.md) for UI/copy; [relevance](docs/relevance.md) for discovery, scans and evidence; [contribution conventions](CONTRIBUTING.md) for Git workflow and checks.
- Find and fix root causes across affected callers. Preserve doc comments unless explicitly asked to remove them.
- Before adding complexity for a speculative or very unlikely race or security case, explain its concrete failure, likelihood and complexity cost and obtain the owner's agreement.

## General principles

- Treat leading questions as open questions and verify their premise independently.
- Challenge assumptions when evidence warrants it. Explain evidence and uncertainty without inventing objections.

## Structure

- Application code lives under `src`. Void pages, routes and queues are thin entries; browser behavior belongs in `client`, evaluation/services in `server`, browser-safe contracts in `shared`, persistence in `db`, and binding declarations in `types`.
- Use kebab-case files/directories, PascalCase components/types, and camelCase functions/values. Preserve framework-reserved exports and conventional root document names. Vite+ enforces filename and import boundaries.
- `~/` means the source root; use it across directories and `./` between siblings. The native Node-loaded auth graph is the narrow exception: retain explicit relative `.ts` imports there. Browser code may import inferred page-loader types only through `import type`.
- Add folders for real responsibilities. Avoid generic utility buckets and redundant barrels.
- API routes are resource nouns: `/api/me/*` for private viewer state, singular singletons, plural collections, project operations under `/api/me/project`. GET reads, POST submits work/change, DELETE clears; request fields are camelCase. Better Auth owns `/api/auth/*`; routes use Void's `@schema`.
- Cloud resources use `hashtagconnect` or `hashtagconnect-<purpose>` with no environment suffix. Queue filenames determine physical names. Deployment targets the pinned personal account; existing Momentium resources are outside this project's deployment scope.

## Verification

- Before finishing code changes, run `pnpm run check`, `pnpm test`, and `pnpm run build`.
- Colocate meaningful unit tests; integration tests live under root `tests/integration`. Mock provider boundaries: automated tests never call paid/network providers. Live provider experiments are manual verification.
- Preserve applied migrations and their history. Resource relocation changes deployment metadata, not migration contents.
- Keep credentials, private profiles and provider payloads out of commits and application logs. Preserve shared dependency caches; remove generated artifacts only after confirming they are unused.

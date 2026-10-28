# Contributing

Use pnpm and the checked-in lockfile. Read the [architecture](docs/architecture.md) before changing responsibilities, and [DESIGN.md](DESIGN.md) before changing the interface.

## Place a change

Keep native framework entries thin. Browser state and presentation belong in the client, business operations and integrations in the server, and reusable browser-safe contracts in shared modules. Database schema and applied migration history stay together. Add a folder when it represents an actual responsibility.

Use kebab-case filenames, PascalCase components/types and camelCase functions/values. Use `~/` across directories and `./` for siblings. The auth configuration and its native Node-loaded dependencies require explicit relative `.ts` imports; keep that exception limited to the existing graph. Client imports of loader contracts must be type-only.

Preserve doc comments. Test behavior and real boundary failures, keeping unit tests next to their owners and cross-module tests in the integration directory. Automated tests use mocked providers and isolated D1 instances. Run `pnpm run check`, `pnpm test`, and `pnpm run build` before handing over changes.

## Submit a change

- Branches use `<type>/<kebab-case-topic>`.
- PRs use `type(scope): imperative summary`, target `develop`, and start as drafts.
- Append `(KEPL-###)` only for a real ticket. Commits require a coauthor and do not carry ticket-number stamps.
- Describe the resulting behavior, validation, and material deployment implications.

Before adding machinery for an unlikely race or security edge case, discuss the concrete failure, likelihood and complexity cost. Trust documented library contracts and use native interfaces.

For any future Rust app, locate and reuse its existing `CARGO_TARGET_DIR`, keeping one target per app across worktrees. Preserve shared dependency caches.

# Verification

Recorded 28 October 2026. Automated provider tests use mocked responses; live checks are a focused sample, not a quality benchmark.

- `pnpm run check`: formatting, lint and types pass with no warnings.
- `pnpm test`: 64 tests pass across 25 files.
- `pnpm run build`: native SSR and client builds pass.
- Temporary probes confirmed that camel-case filenames, browser-to-server imports and parent-relative bypasses fail lint. The probes were removed.
- All five existing migration/history files are byte-for-byte unchanged after relocation. The personal database applied the existing migrations.
- Configured credential values were absent from source files and generated browser assets.

## Live integrations

Clef-flash successfully compared a synthetic AI-tool-builder bio against a public connect post. Browser Run measured twelve body lines in the official X embed; Clef selected the “AI Tools” line with presence 0.8607 and choice confidence 0.7841. Highlight coordinates came from the browser's text ranges. These probabilities describe that response, not calibrated accuracy.

Cloudflare-hosted Gemma produced a valid project summary, four topics and a verified exact excerpt from a supplied synthetic project page. This exercised the real model and native response schema; the page-read boundary was separately mocked for that check.

The personal deployment passed Void's readiness checks, with its D1 migrations current and `hashtagconnect-project-import` queue configured. Required inference and X credentials are stored as Worker secrets. Void 1.2.1's bulk-sync request was incompatible with the installed Cloudflare CLI, so the secrets were written with the native Cloudflare bulk command and checked by name.

The public discovery page from the old deployment supplied 107 visible post records, including the pinned maker introduction. They were copied to the personal database with their existing timestamps and tags. The Momentium deployment was read publicly and never modified. Accounts, sessions, private context, Stash and prior scan results were not transferred.

## Remaining account verification

The new callback is registered, and X now accepts it and presents HashtagConnect’s authorization screen. The owner deferred personal-account sign-in testing. The full signed-in scan and queued project-import flow therefore remain unverified. Browser layout measurement, Clef scoring/line selection, and project-summary inference have been checked separately; the complete authenticated path is not yet verified.

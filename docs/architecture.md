# Architecture

HashtagConnect serves discovery and private viewer state through Void on Cloudflare Workers. The browser displays official X embeds; server integrations evaluate relevance and measure evidence. D1 owns persisted posts, choices, profiles and usage reservations.

## Ownership and dependencies

| Area     | Owns                                                                                   | Application dependencies                                    |
| -------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Client   | Discovery screen, components, browser state, scan scheduling and overlays              | Client, shared; type-only inferred loader props             |
| Shared   | Post/profile contracts, validation and discovery retention rules                       | Shared                                                      |
| Server   | Discovery, membership, relevance, embed measurement, project reading and OAuth helpers | Server, shared, database                                    |
| Pages    | Native screen entry and server loader                                                  | Client for rendering; server/shared/database for the loader |
| Routes   | HTTP validation and viewer authorization                                               | Server, shared, database                                    |
| Queues   | Native project-import consumer                                                         | Server, shared, database                                    |
| Database | Schema and applied migration history                                                   | Shared contracts                                            |
| Types    | Native binding augmentation and generated Cloudflare declarations                      | Framework types                                             |

Void's `sourceDir` selects one application source tree. The root contains tooling, project documents and public assets. Vite+ enforces kebab-case filenames and layer imports; `~/` resolves to that source tree. Unit tests stay with their modules and integration tests exercise isolated D1 databases.

The native auth loader runs in Node before Vite resolves aliases. Its existing dependency graph therefore uses explicit relative `.ts` imports. The discovery screen consumes the page loader's inferred type without importing its runtime code. These are specific framework boundaries, not reasons to duplicate contracts.

## Data and request flow

The server loader supplies discovery and viewer context. Browser interactions call typed resource routes; routes enforce access and invoke server operations. Signing in can queue a project import from the user's bio. The queue reserves the existing Browser Run budget before reading a page, and respects edits that supersede an in-flight import.

[Relevance](relevance.md) documents text scoring, line localization and the seven-day discovery window. Expiry changes visibility at read time while preserving D1 rows, Stash, guest choices and stored results. Applied migrations remain unchanged during the source reorganization.

## Cloud resources

The account in the native Void configuration is the personal deployment destination. The Worker is `hashtagconnect`; named resources use `hashtagconnect-<purpose>` with no environment suffix. The project import queue is `hashtagconnect-project-import`, matching its native queue entry. The managed D1 database uses `hashtagconnect-db`. Browser Run is an account service exposed through the `BROWSER` binding, not a separately named browser deployment.

Void provisions resources and records their personal-account IDs in its deployment lock. Company resource IDs must not be reused. The existing Momentium deployment remains independently deployed; this move does not modify it. Only visible public post records were copied; private accounts, sessions and viewer state were not transferred. Credentials stay in local ignored configuration and encrypted Worker secrets. After deployment, register the new X callback origin before expecting sign-in to succeed.

Model decisions use Clef-flash with Jev-style typed questions. The separate project reader uses Cloudflare-hosted Gemma for prose; both consume the shared Workers AI allowance. Browser Run measures the official embed’s body lines, and Clef selects among those lines without guessing coordinates. Required environment declarations preserve remote secrets across deployments.

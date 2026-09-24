# Security review — 2026-09-24

Scope: supplied Memorate source, service worker, dependency lockfile, build configuration, and files prepared for the first Git commit. This is a code/dependency review, not a penetration test of the hosted Sites deployment.

## Fixed

- **Service-worker cache contamination / future privacy exposure:** every successful navigation previously overwrote the `/` cache entry. Authentication and unrelated pages could replace the offline shell. Only the anonymous, non-redirected root shell is now precached; runtime navigations never overwrite it. Auth paths, other routes, and query-bearing navigations bypass the offline fallback. Private, no-store, no-cache, session-varying, and redirected responses are excluded. Existing v3 caches are removed on activation.
- **Overbroad precaching:** messages previously accepted arbitrary same-origin `.js`/`.css` endpoints and all `/_next/` paths. Precaching now accepts only known static directories and file extensions, rejects malformed/foreign/query-bearing URLs, checks the sending client, omits credentials, rejects redirects, and caps each batch at 128 entries.
- **Vulnerable dependencies:** the initial full `pnpm audit` reported 36 advisories (20 high, 12 moderate, 4 low). Updated React/React DOM/RSC to 19.2.8, Vite to 8.0.16, and affected transitive packages using scoped overrides. This includes the RSC server-function DoS advisory [GHSA-wx67-qw84-cm4g](https://github.com/facebook/react/security/advisories/GHSA-wx67-qw84-cm4g). The final full audit reports zero known advisories. The configured dependency age and lifecycle-script policies remain enabled.
- **Repository hygiene:** added `.gitignore` for environment files, local databases/runtime state, dependencies, generated bundles and logs. A pattern scan found no common private-key or API-token formats in the source prepared for commit.
- **HTTP hardening:** disabled the framework identification header and configured MIME sniffing protection, referrer policy, and a baseline CSP restricting objects, base URLs and form destinations. This CSP deliberately preserves Sites embedding and framework inline scripts; it is not a complete XSS prevention policy.

## Build restoration

The supplied export omitted `.openai/hosting.json` although Vite imports it. Added an empty logical configuration (no cloud resources or deployment identity) and typed optional bindings. No deployed Site was changed. Before publishing through Sites, restore the original Site identity using the Sites workflow.

## Validation

- Six service-worker regression tests cover offline root access, navigation/cache isolation, unsafe URLs, sender and batch checks, sensitive response exclusion, anonymous installation, and old-cache cleanup.
- `pnpm exec tsc --noEmit` and `pnpm build` pass.
- The freshly started production Worker returns HTTP 200 for `/` with all three configured security headers. Headers are applied at the Worker boundary because Vinext omitted next.config headers on streamed root responses.
- `pnpm audit --json` reports zero known advisories across production and development dependencies after the update.

## Boundaries

- Notes, photos and backups remain device-local and unencrypted. Anyone with access to the browser profile or exported JSON can read them; this app does not offer separate user accounts or encrypted storage.
- No active server API or user-controlled HTML insertion was found in the current note flow. React renders note text as text; uploaded photos are re-encoded through canvas before storage.
- `examples/d1/` is inactive example code, not a deployed route. It is not an authenticated multi-user API and must not be copied into `app/api/` without authentication, ownership checks, input limits and safe errors.
- `app/chatgpt-auth.ts` is unused by the current app. Its identity headers are trusted only behind the Sites dispatch layer that strips/injects them, not on an independently exposed server.
- Dependency audit results are time-specific and do not establish absence of unknown vulnerabilities. Hosted access policies, TLS and platform configuration were outside this local review.

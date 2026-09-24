# Memorate

A local-first personal catalog for things you try, buy and experience. The GitHub repository is the source of truth; the existing Sites source remote is a deployment mirror of the same commits, not a separately generated app.

## Development

Use Node.js 24 and pnpm 11.25.0 (minimum Node 22.13).

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm start
```

`test:e2e` starts the built Worker on loopback port 4175 and exercises mobile forms, offline usage, ZIP backups, touch gestures, API authorization, and synchronization between browser contexts. Install the test browser once with `pnpm exec playwright install chromium`. Browser tests use only the local D1/R2 state and disposable test identities.

Apply local database migrations in order before the browser suite. Build first to generate Wrangler's configuration:

```sh
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_whole_the_stranger.sql
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_powerful_beast.sql
```

Do not replay migrations on a database that already has them. Local state, dependency caches, environment files, and build outputs are ignored by Git.

## Data and synchronization

The UI uses the application repository in `lib/repository.ts`. IndexedDB v2 preserves existing v1 notes, photos, categories and preferences. Local operations work without signing in or being online. Cloud operations are adapters behind `AuthProvider`, `CloudRepository`, and `SyncService`; ZIP backups use application models rather than provider-specific rows or object URLs.

Signing in automatically enables synchronization on each device; no separate per-device activation is required. Existing local collections merge into the same authenticated account without being cleared. Sites Sign in with ChatGPT establishes identity through dispatch-owned headers. Every database query and object lookup is scoped to the server-authenticated owner; the browser's account header is only a consistency check against that identity. It never grants access. Do not expose the Worker outside the Sites gateway without replacing this authentication adapter. Development auth simulation is loopback-only.

The existing hosted Site's private access policy is preserved. Its gateway requires sign-in to open the Site, even though the app's local mode itself needs no account. Public anonymous access would require an explicit Site sharing change.

Sync v1 uses owner-scoped, transactionally versioned snapshots and a persistent three-way merge baseline. An unchanged record follows the other device, including deletion. Concurrent note edits preserve the cloud version and a recovered local copy. Saving a stale open editor also preserves a newer remote edit or deletion and stores the draft as a recovered copy, checked atomically in IndexedDB. Category conflicts receive new IDs and local relationships are remapped. A concurrent edit wins over deletion. Preferences keep local changes. IDs survive ordinary sync, and immutable photos are uploaded separately to object storage. Failed uploads or stale revisions do not erase the local collection; retry merges again. Local edits made during a transfer are retained. A browser collection is bound to the first cloud owner to prevent accidental uploads to a different account; use separate browser profiles for separate accounts.

Sync runs after login/app initialization, local edits, reconnection, foregrounding, and manual refresh. A visible app also pulls remote edits every 15 seconds. One coordinator serializes these triggers, retries transient failures with backoff, and exposes pending/offline/error states in Settings. Revision conflicts re-read and merge again; unchanged snapshots do not produce cloud writes. Development diagnostics contain trigger/outcome metadata, never note contents, identity or tokens. The database stores notes, categories, preferences, photo metadata, upload checksums, and the current revision. Photo bytes remain in R2 and are cached locally. Unreferenced cloud photo objects are retained for now to avoid deleting files still needed by an in-flight or offline device; automatic garbage collection is not implemented.

## Portable backups

Settings exports a ZIP containing `data.json` and `photos/<photo-id>.jpg`. JSON includes `backup_format_version`, `schema_version`, timestamps, complete notes and ordered photo IDs/metadata, categories, and preferences. No credentials or cloud storage URLs are exported.

Import validates the ZIP directory, CRCs, decompression sizes, file paths, schema, versions, IDs and relationships before an atomic local transaction. Exact records are deduplicated; conflicting IDs are remapped instead of overwriting originals. Preferences restore automatically into an empty collection. Legacy `memorate-export` version-1 JSON backups remain importable. Backups and local data are not encrypted.

Current safety limits: 256 MB ZIP, 8 MB per backup/cloud photo, 20 MB original photo selection, 12 photos per note, 2,000 notes, 500 categories, 20,000 characters per comment, and 1 MB cloud snapshot metadata. Oversized or unsupported data fails with a recoverable error, without deleting local data.

## PWA and deployment

Each build fingerprints the service worker from the compiled assets. Navigation stays network-first; only the explicitly marked identity-free root shell can be cached for offline launch. API/account responses are never cached by the worker. The root must remain free of server-rendered personal data; remove its marker if that changes. Update checks run on launch, foregrounding and reconnect. A waiting worker activates through the update prompt, which is disabled while the editor is open. The first worker installation does not interrupt the page.

The hosting manifest identifies the existing Memorate Site and declares logical `DB` and `BUCKET` bindings. Drizzle migrations are versioned in `drizzle/` and applied by Sites when publishing. Keep applied migrations immutable.

`pnpm package:sites` packages the existing build with its Worker/asset paths and versioned SQL migrations. It contains no source credentials or local database state.

The release sequence is: edit this repository → local checks and workflow verification → commit → push GitHub → push the same source commit to Sites with a short-lived credential → save the matching build archive → deploy and confirm success. Sites credentials stay in process memory/stdin and are never written into Git configuration, files, or URLs. Production uses the existing Site URL and access policy.

Real iOS Home Screen behavior still requires device testing; desktop mobile emulation cannot fully verify iOS file-picker, keyboard, standalone, or OS storage-eviction behavior.

## Interaction regression checks

Mobile inputs use at least 16px text without restricting user zoom. The same filter content uses a bottom sheet on small screens and a right drawer on desktop. Dragging its header tracks the finger and dismisses on distance/velocity; content scroll remains independent. A 22px left-edge zone returns from note details through the existing navigation state and restores feed scroll. Dates display a full numeric year. Card photos tilt without scaling; the rating star turns once over 560ms. Reduced-motion settings disable nonessential animations.

# Memorate

Memorate is a personal catalog for things you try, buy, visit, or experience.

Save a quick note, rating, price, category, and photos so you can answer one simple question later:

> Have I tried this before, and did I like it?

Memorate is built as a mobile-first PWA and also works on desktop.

## Features

- Create personal notes and reviews
- 1–5 star ratings
- Categories
- Multiple photos per note
- Price and currency
- Custom note dates
- Comments and impressions
- Search
- Filtering and sorting
- Light and dark themes
- Offline-first local storage
- Optional cloud backup and cross-device sync
- Swipe actions and mobile-focused interactions
- Installable as a PWA on supported devices
- Full data backup and restore

## Portable backups

Memorate is designed around data ownership.

A complete backup can be exported as a ZIP archive containing structured application data and original photos.

Backups can later be imported back into Memorate, making it easier to move data between installations or migrate to another backend in the future.

## Offline first

Core functionality works locally without requiring a connection.

Notes, categories, preferences, and locally available photos remain accessible offline. When cloud sync is enabled, changes can be synchronized when a connection becomes available again.

## Tech stack

- TypeScript
- React
- Progressive Web App
- IndexedDB for local persistence
- Cloud database and object storage for optional sync
- Playwright for end-to-end testing

## Development

Requirements:

- Node.js 22+
- pnpm

Install dependencies:

```bash
pnpm install
````

Start the development server:

```bash
pnpm dev
```

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Roadmap

* Smarter search with typo tolerance and transliteration
* Custom themes
* Home Screen quick actions / widgets
* Sharing individual notes
* Spending statistics
* “Try again” reminders
* Similar-note detection
* Barcode / QR scanning
* Receipt import and OCR
* Voice notes and transcription
* AI-assisted tags and summaries

## Privacy

Memorate is designed to work locally first.

Cloud storage and synchronization are optional. Personal notes are not intended to be used for advertising or tracking.

## License

See [LICENSE](LICENSE) for licensing terms.

---

Built by [Yana Bychilova](https://github.com/whiony).

# AGENTS.md: aria

For AI agents (and people) working in this repo. The [README](README.md) has what ARIA does.

ARIA / SITUATION: the NetComposer Studio's Situation module (no sound; the Studio's bridge entry has `sound: false`).
Vite and TypeScript, no framework. MIT; created by Peter Semmelhack.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

CI runs install, typecheck, lint, test, build.

## Rules

- **Vendored libraries, never edited here:** `vendor/nc-ui`, `vendor/nc-situation`, each with a `VENDORED_FROM`
  line. Change the library in its own repo, merge, then re-vendor.
- **The contract lives in nc-situation**: every message ARIA sends is built there and parsed by receivers there.
- **One connection**: only src/worker.ts opens a SeedLink socket; respect EarthScope's limit (at most five per
  user) and the backoff. Never point tests at the live server: use scripts/mock-seedlink.mjs.
- **Tokens only** (ui-guard). ARIA's Magma (`instrument-aria`) shows only in ARIA's own page, its tab dot and chip.
  Any other accent: stop and ask Peter.
- **Old saves always load** (state.ts sanitizes forward). Copy: short plain sentences; hover help ≤ 200 characters.
- **Credit**: keep the network DOI and EarthScope acknowledgement wherever the data shows.
- Commits and PRs need no attribution lines.

## Questions

Open an issue on netcomposer-art/aria. Peter Semmelhack decides product, sound and design questions.

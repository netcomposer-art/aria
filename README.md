# ARIA

ARIA / SITUATION: NetComposer Studio's Situation module. ARIA was created by [Peter Semmelhack](https://psem.me/).

It makes no sound of its own. It listens to a live seismometer (EarthScope SeedLink) and turns the ground's motion
into signals the Studio's instruments answer (nc-situation's contract v1):

- **The Ground wavetable**: a window of ground motion (256 samples, 12.8 s at 20 samples/s), detrended and mirrored
  so it loops, sent five times a second. ASTRID plays it as its "Ground" table, live, at its own Speed (Live 1×, 10×,
  100× through the stored 30 minutes), or Freeze.
- **Energy**: how much the ground moves against that station's own last 30 minutes, 0–1 (its normal reads 0.5).
  ASTRID offers it as a modulation source ("ARIA Energy").

It works while the Studio is stopped. Served at https://netcomposer.art/aria/ and loaded by the Studio in a
same-origin iframe (tab "Situation", spine "ARIA / SITUATION / 01"). Identity colour Magma #FF2A3D, light and dark
(nc-ui `instrument-aria`; Peter, 2026-11-06).

## The station

Six presets: Albuquerque (IU.ANMO, the default), Harvard (IU.HRV), between Mauna Loa and Mauna Kea (IU.POHA,
volcanic), Axial Seamount on the sea floor (OO.AXCC1), the South Pole (IU.QSPA) and Taipei (IU.TATO). The last four
have a fallback (IU.RAO, IU.PTCN, IU.CASY, IU.MAJO) that ARIA switches to when the station sends nothing three times;
docs/live-checklist.md is how Peter confirms them. Any other station: "Other station…" (NET STA LOC CHA). Offline,
or until live data arrives, ARIA plays ten minutes recorded at Albuquerque on 27 February 2010.

- **One connection**: the SeedLink client runs in a worker (src/worker.ts), one socket per ARIA, one ARIA per
  Studio. Open tabs count each other; with four others connected a fifth waits (EarthScope asks for at most five).
- **Status**: live (data in the last two minutes), quiet (connected, nothing for two minutes: Energy decays), offline
  (reconnecting: 3, 6, 12, 24, 48, then 60 s, ±20 %). "Newest … ago" and "playing … behind now".
- **Hold** freezes what ARIA sends (table and Energy).
- **Credit**: the footer cites the network's DOI and EarthScope; the full acknowledgement is its tooltip.

Nothing leaves the browser but the WebSocket to EarthScope (which sees the player's IP, as any page visit does).

## Develop

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint          # biome, then nc-ui's ui-guard (tokens only)
pnpm test          # vitest: miniSEED against ObsPy, SeedLink, the stream, the engine, settings
pnpm build
pnpm build:site    # dist/ + BUILD.txt for netcomposer.art (tools/pull-app.mjs aria there)
pnpm mock-sl       # a local SeedLink server replaying the 2010 recording (scripts/mock-seedlink.mjs)
```

Point ARIA at another server with `?sl=ws://127.0.0.1:18000` or localStorage `netcomposer.aria.sl`. Must be served
over http(s): EarthScope's server never answers a page opened as a file. The Studio's end-to-end tests (nc-studio
`tests/aria.e2e.mjs`) cover ARIA with ASTRID.

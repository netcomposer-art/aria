# nc-situation

nc-situation was created by [Peter Semmelhack](https://psem.me/).

**NetComposer's Situation contract**: how ARIA, the Studio's Situation module, hands what it hears from the world to
the Studio's instruments, the same way for every module. Plus the pure maths that turn ground motion into those
signals, so a recording replays exactly. Pure TypeScript, no DOM, Web Audio, timers or randomness. MIT.

ARIA makes no sound of its own. v1 listens to a live seismometer (EarthScope SeedLink) and sends:

- **`table`**: the Ground wavetable, one 1024-sample cycle made from the ground's motion, a few times a second, per
  Speed lane (real time, 10×, 100×). ASTRID plays it as its "Ground" table.
- **`energy`**: how much the ground is moving, 0–1, against that station's own normal. ASTRID offers it as a
  modulation source ("ARIA Energy").
- **`status`**: live, quiet, offline or off; the station; how far behind real time; the data credit.
- **`off`**: the source went away or is held.

```ts
import { parseSituationMessage } from "@netcomposer/nc-situation";

host.situationIn((raw) => {
  const m = parseSituationMessage(raw); // a checked copy, or null
  if (m?.kind === "energy") for (const f of m.frames) energy.push(f.value, f.at);
  if (m?.kind === "table") ground.install(m.samples, m.seq);
}, { energy: true, table: { speed: 1 } });
```

Times (`at`) are AudioContext seconds on the Studio's one context, which runs whether the transport plays or not:
the signals work while the Studio is stopped.

## The maths

- `GroundEnergy`: the 0.05 Hz high-passed signal's RMS over 10 s, once a second, against the median of the last 30
  minutes of those RMS values. Level = 0.5 + 0.25·log2(rms / baseline), clamped to 0–1: a station's normal reads
  0.5, four times louder 1, four times quieter 0. A quiet station still moves.
- `prepareTable(window)`: the window (256 samples, 12.8 s at 20 samples/s) detrended, mirrored so it loops without a
  click (the folds rounded), resampled to 1024, the mean removed, normalised to peak 1. The same as Ground Wave's.
- `Smoother`: one-pole smoothing (ARIA's Smoothing).

## Develop

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Apps vendor a copy at a pinned commit (`vendor/nc-situation` with a `VENDORED_FROM` line); change it here, then
re-vendor. Never edit a copy.

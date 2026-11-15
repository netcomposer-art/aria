# nc-situation

nc-situation was created by [Peter Semmelhack](https://psem.me/).

**NetComposer's Situation contract**: how ARIA, the Studio's Situation module, hands what it hears from the world to
the Studio's instruments, the same way for every module. Plus the pure maths that turn ground motion into those
signals, so a recording replays exactly. Pure TypeScript, no DOM, Web Audio, timers or randomness. MIT.

ARIA makes no sound of its own. v1 listens to a live seismometer (EarthScope SeedLink) and sends:

- **`table`**: the Ground wavetable, one 1024-sample cycle made from the ground's motion, a few times a second, per
  Speed lane (real time, 10×, 100×). ASTRID plays it as its "Ground" table.
- **`energy`**: how much the ground is moving, 0–1, against that station's own normal. ASTRID offers it as a
  modulation source ("Ground Energy"; it was "ARIA Energy", and its saved id `aria:energy` is unchanged).
- **`status`**: live, quiet, offline or off; the station; how far behind real time; the data credit.
- **`off`**: the source went away or is held.

Since 0.2.0, **My phone** (ARIA reading the phone the Studio runs on):

- **`motion`**: Tilt X and Tilt Y (−1..1, 0 at the centre the player set), Heading (0..1, slow) and Shake (0..1, jumps
  with a shake and falls away), as frames. ASTRID offers them as modulation sources ("Phone Tilt X" …).
- **`shake`**: a Shake event, a trigger (CALLIOPE can start a new phrase on the next bar).
- **`status.motion`**: off, blocked, live, paused or none (no sensor). The Studio's chip shows it.

`SITUATION_SIGNALS` lists every signal by the id a save keeps and the name players see.

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
- `MotionShaper`: a phone's readings (orientation, acceleration, compass) to Tilt X, Tilt Y, Heading and Shake, with
  Smooth, Invert and a centre; `ShakeDetector` (level and events), `StillCentre` (Hold still to centre).

## Develop

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Apps vendor a copy at a pinned commit (`vendor/nc-situation` with a `VENDORED_FROM` line); change it here, then
re-vendor. Never edit a copy.

# ARIA live checklist (for Peter, in your browser)

Everything below runs only against EarthScope's real server, which the build machine can't reach. The tests cover
the same paths against a mock server (`scripts/mock-seedlink.mjs`). About ten minutes in all.

Open https://netcomposer.art/studio/ (after the site PR merges), or the PR's preview. Go to the **Situation** tab.

## 1. The connection (you confirmed this through Ground Wave on 2026-11-07)

- [ ] Albuquerque is chosen. Within about 20 s the status reads **LIVE · 20 samples/s · newest … ago · playing …
      behind now**, the waveform strip fills with ten minutes, and the chip under Rec / Keep reads
      `ARIA 1 · IU.ANMO · … behind`.
- [ ] "Behind now" sits between about 25 and 90 s. Note the number: ____ s.

## 2. The presets (one minute each)

Choose each in the Station menu and wait up to a minute. Write what the status says.

| Preset | Code | Live? | If not: did ARIA switch to the fallback? | Fallback live? |
|---|---|---|---|---|
| Albuquerque | IU.ANMO.00.BHZ | | (none) | |
| Harvard | IU.HRV.00.BHZ | | (none) | |
| Between Mauna Loa and Mauna Kea | IU.POHA.00.BHZ | | → Raoul Island, IU.RAO.00.BHZ | |
| Axial Seamount, sea floor | OO.AXCC1..HHZ | | → Pitcairn Island, IU.PTCN.00.BHZ | |
| South Pole | IU.QSPA.00.BHZ | | → Casey, IU.CASY.00.BHZ | |
| Taipei | IU.TATO.00.BHZ | | → Matsushiro, IU.MAJO.00.BHZ | |

A station that sends nothing is tried three times (about 45 s with the backoff), then the note says
"… sent no data; listening to … instead." Meanwhile the 2010 recording keeps the Ground table moving.

**Hawaii**: IU.KIP (Kipapa) is not used anywhere (it doesn't answer, your test of 2026-11-07). If POHA is silent too,
try **HV.UWE** (Uwēkahuna, Kīlauea's summit, Hawaiian Volcano Observatory) with "Other station…": type
`HV UWE -- HHZ`. If it is live, tell me and it becomes POHA's fallback (or the preset) in place of Raoul Island.
Also worth a try for the sea floor if AXCC1 is silent: `OO AXAS1 -- HHZ` (Axial Seamount, another OOI station).

## 3. ASTRID plays the ground

- [ ] Synth tab → OSC 1 → Wavetable → Table **Ground**. The line under it reads "Live from ARIA 1 · IU.ANMO · …
      behind now". Hold a key: the tone changes slowly as the ground moves, with no clicks.
- [ ] Speed 10× and 100×: the tone moves faster. Freeze: it holds still.
- [ ] Modulation: Source **ARIA Energy** → Cutoff, Amount +60 %. The filter opens and closes with Energy (watch the
      Energy meter in the Situation tab). Stopped and playing alike.

## 4. Failure, as material

- [ ] Turn Wi-Fi off for a minute: status goes **OFFLINE · retry …**, Energy sinks toward 0, ASTRID keeps its last
      table. Turn it back on: LIVE again within about a minute, without reloading.
- [ ] Open the Studio in five tabs: the fifth says "Four other tabs are listening to the ground."

## 5. Credit

- [ ] The footer reads "Data: Global Seismograph Network (IU), Albuquerque Seismological Laboratory / USGS,
      doi:10.7914/SN/IU · real time via EarthScope Consortium (NSF SAGE)". Its tooltip has EarthScope's full
      acknowledgement. Check the award number (EAR-1724509) on earthscope.org/how-to-cite: it may have been renewed.

## What only runs live

- The real server's handshake replies and how often a real station's records arrive (the mock imitates ringserver).
- Whether each preset and fallback streams on rtserve.earthscope.org.
- The real lag ("behind now") and EarthScope's connection limit.

Everything else (decoding, tables, Energy, reconnects, the fallback switch, the census, ASTRID's Ground table and
Energy, Speed, Freeze, the crossfade, stopped behaviour, offline recording, phone layout) is tested against the mock.

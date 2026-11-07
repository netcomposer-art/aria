/**
 * The station presets (Peter, 2026-11-06: "Albuquerque and Harvard, plus a volcanic one, the sea floor, Antarctica and
 * a busy city"). ANMO and HRV run in Ground Wave; the other four are checked from a browser (docs/live-checklist.md):
 * each has a fallback a station's row switches to when EarthScope sends nothing for it.
 */
import type { ChannelSpec } from "./seedlink";

export interface Preset extends ChannelSpec {
  id: string;
  /** What the player sees. */
  name: string;
  /** A few words on why it is here. */
  note?: string;
  /** Another channel to try when this one sends nothing (rtserve may not carry it). */
  fallback?: ChannelSpec & { name: string };
}

export const PRESETS: readonly Preset[] = [
  { id: "anmo", net: "IU", sta: "ANMO", loc: "00", cha: "BHZ", name: "Albuquerque, New Mexico" },
  { id: "hrv", net: "IU", sta: "HRV", loc: "00", cha: "BHZ", name: "Harvard, Massachusetts" },
  {
    id: "poha",
    net: "IU",
    sta: "POHA",
    loc: "00",
    cha: "BHZ",
    name: "Between Mauna Loa and Mauna Kea",
    note: "volcanic",
    // Not IU.KIP (Kipapa): it does not answer on the live feed (Peter, 2026-11-07).
    fallback: {
      net: "IU",
      sta: "RAO",
      loc: "00",
      cha: "BHZ",
      name: "Raoul Island, an active volcano",
    },
  },
  {
    id: "axial",
    net: "OO",
    sta: "AXCC1",
    loc: "",
    cha: "HHZ",
    name: "Axial Seamount, sea floor",
    note: "1.5 km down",
    fallback: { net: "IU", sta: "PTCN", loc: "00", cha: "BHZ", name: "Pitcairn Island, Pacific" },
  },
  {
    id: "qspa",
    net: "IU",
    sta: "QSPA",
    loc: "00",
    cha: "BHZ",
    name: "South Pole",
    note: "the quietest site",
    fallback: { net: "IU", sta: "CASY", loc: "00", cha: "BHZ", name: "Casey, Antarctica" },
  },
  {
    id: "tato",
    net: "IU",
    sta: "TATO",
    loc: "00",
    cha: "BHZ",
    name: "Taipei, Taiwan",
    note: "a busy city",
    fallback: { net: "IU", sta: "MAJO", loc: "00", cha: "BHZ", name: "Matsushiro, Japan" },
  },
];

export const DEFAULT_PRESET = "anmo";

/** The recording bundled for offline play: ten minutes at Albuquerque on 27 Feb 2010 (the day of the M8.8 Chile quake). */
export const RECORDING = {
  file: "anmo-2010-02-27.mseed",
  name: "Recorded: Albuquerque, 27 Feb 2010",
  station: { net: "IU", sta: "ANMO", loc: "00", cha: "BHZ" },
} as const;

/** Citable network DOIs (FDSN). */
const NETWORKS: Record<string, { name: string; operator: string; doi: string }> = {
  IU: {
    name: "Global Seismograph Network (IU)",
    operator: "Albuquerque Seismological Laboratory / USGS",
    doi: "10.7914/SN/IU",
  },
  OO: { name: "Ocean Observatories Initiative (OO)", operator: "OOI", doi: "10.7914/SN/OO" },
};

/** The short credit for a network, for the footer and the status message. */
export function credit(net: string): string {
  const n = NETWORKS[net];
  const via = "real time via EarthScope Consortium (NSF SAGE)";
  return n
    ? `Data: ${n.name}, ${n.operator}, doi:${n.doi} · ${via}`
    : `Data: network ${net} (see fdsn.org/networks/detail/${net}) · ${via}`;
}

/** EarthScope's acknowledgement (earthscope.org/how-to-cite), shown in ARIA's About. */
export const EARTHSCOPE_ACK =
  "The facilities of EarthScope Consortium were used for access to waveforms, related metadata, and/or derived products. These services are funded through the National Science Foundation's Seismological Facility for the Advancement of Geoscience (SAGE) Award under Cooperative Agreement EAR-1724509.";

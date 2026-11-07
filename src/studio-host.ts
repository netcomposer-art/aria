/**
 * ARIA's side of the Studio bridge (nc-studio src/bridge.ts is the other side). ARIA makes no sound: it is a source on
 * the Studio's situation bus (nc-situation's contract v1), and the bus tells it what receivers want (Energy; Ground
 * tables at which Speeds). Standalone (no Studio, or one without the bus) it gets null and only shows the ground.
 */
import type { SituationMessage, TableSpeed } from "@netcomposer/nc-situation";

/** What receivers want from this source, all together. */
export interface SituationDemand {
  energy: boolean;
  speeds: TableSpeed[];
  /** How many receivers listen (any want). */
  receivers: number;
  /** Their names ("Synth 01"), for "to …". */
  names: string[];
}

/** ARIA's handle on the situation bus (nc-studio SituationSource). */
export interface StudioSituationSource {
  readonly id: string;
  readonly name: string;
  send(message: SituationMessage): void;
  demand(): SituationDemand;
  onDemand(listener: () => void): () => void;
  remove(): void;
}

export interface StudioPresetProvider {
  readonly format: string;
  readonly version: number;
  get(): unknown;
  set(data: unknown): void | Promise<void>;
}

export interface StudioHost {
  readonly instance?: string;
  readonly ctx?: BaseAudioContext;
  storageKey?(base: string): string;
  providePreset?(provider: StudioPresetProvider): void;
  situationSource?(name: string): StudioSituationSource;
}

interface StudioApi {
  readonly version: number;
  attach(app: string, options?: { instance?: number }): StudioHost | null;
}

/** This copy's instance number (`?instance=<n>` on its URL), 1 by default. */
export function studioInstance(): number {
  try {
    const n = Number(new URLSearchParams(window.location.search).get("instance"));
    return Number.isInteger(n) && n >= 1 && n <= 99 ? n : 1;
  } catch {
    return 1;
  }
}

let cached: StudioHost | null | undefined;

/** Attach to the Studio as `app` (null: standalone). */
export function studioHost(app: string, instance: number = studioInstance()): StudioHost | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    if (typeof window === "undefined" || window.parent === window) return cached;
    const api = (window.parent as Window & { ncStudio?: StudioApi }).ncStudio;
    if (api && api.version === 1) cached = api.attach(app, { instance });
  } catch {
    // A cross-origin parent throws on property access: not the Studio.
  }
  return cached;
}

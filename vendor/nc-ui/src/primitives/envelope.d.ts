export const ENV_TAU: number;
export function envUnits(seconds: number): number;
export function envelopeXs(segments: readonly (number | null)[], max: readonly number[], width: number, hold?: number): number[];
export function envelopeLabelXs(xs: readonly number[], gap: number, width: number): number[];

// Types for src/color.js. nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
export type Random = () => number;
export declare const INK_DARK: string;
export declare const INK_LIGHT: string;
export declare const MIN_LABEL_CONTRAST: number;
export declare function isHexColor(v: unknown): v is string;
export declare function hslToHex(h: number, s: number, l: number): string;
export declare function hexToHsl(hex: string): { h: number; s: number; l: number };
export declare function relativeLuminance(hex: string): number;
export declare function contrastRatio(a: string, b: string): number;
export declare function labelColorFor(fill: string): string;
export declare function readable(h: number, s: number, l: number, min?: number): string;
export interface SlotColors { fill: string; ink: string; on: string; onInk: string }
export declare function slotColors(fill: string): SlotColors;
export declare function surpriseColor(previous: string | null | undefined, random?: Random): string;
export declare function surpriseFillStyle(fill: string | null | undefined): Record<string, string> | null;
export declare function hexToOklab(hex: string): [number, number, number];
export declare function oklabToHex(lab: readonly [number, number, number]): string;
export interface VelocityRamp { min: string; max: string; ink?: string }
export interface VelocityShade { velocity: number; t: number; fill: string; ink: string }
export declare const VELOCITY_RANGE: readonly [number, number];
export declare const VELOCITY_RAMP: VelocityRamp;
export declare const VELOCITY_RAMPS: Record<"light" | "dark", Required<VelocityRamp>>;
export declare function velocityFill(velocity: number, ramp?: VelocityRamp): VelocityShade;
export declare function velocityFillStyle(velocity: number, ramp?: VelocityRamp): Record<string, string>;

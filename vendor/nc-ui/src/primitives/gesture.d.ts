export interface GestureConfig {
  /** Movement before the axis locks, px. */
  slop: number;
  /** Long-press time, ms. */
  longPressMs: number;
  /** Vertical px per value unit. */
  pitchPx: number;
}
export type GestureIntent =
  | { kind: "tap"; pad: number }
  | { kind: "long"; pad: number }
  | { kind: "pitch"; pad: number; degrees: number; phase: "move" | "commit" | "cancel" }
  | { kind: "paint"; pad: number; phase: "start" | "enter" }
  | { kind: "paint-end" };
export declare const DEFAULT_GESTURE: GestureConfig;
export declare class PadGesture {
  constructor(
    hit: (x: number, y: number) => number,
    emit: (intent: GestureIntent) => void,
    config?: GestureConfig,
  );
  readonly config: GestureConfig;
  readonly state: "idle" | "pending" | "pitch" | "paint" | "long";
  down(id: number, x: number, y: number, t: number): boolean;
  tick(t: number): void;
  move(id: number, x: number, y: number, t: number): void;
  up(id: number, x: number, y: number, t: number): void;
  cancel(id: number): void;
}
export declare function bindPadGesture(
  root: HTMLElement,
  selector: string,
  emit: (intent: GestureIntent) => void,
  config?: GestureConfig,
): PadGesture;

export * from "../dist/tokens.js";
export * from "./color.js";
export * from "./theme.js";
export {
  applyAlias,
  entry,
  filterPaint,
  prop,
  readCanvasFont,
  readLive,
  renamedCssVar,
  tokenAlias,
  v,
} from "./alias.js";
export type { AliasEntry, TokenKind } from "./alias.js";
export { installedCss, installTheme } from "./primitives/install.js";
/** The modulated control and every element inside it. The kit turns their motion off. */
export const MODULATED_SELECTOR: "[data-modulated], [data-modulated] *";
export {
  DEFAULT_GESTURE,
  type GestureConfig,
  type GestureIntent,
  PadGesture,
  bindPadGesture,
} from "./primitives/gesture.js";
export {
  type StepEditorHandle,
  type StepEditorProps,
  openStepEditor,
  percent,
} from "./primitives/step-editor.js";
export { type ConfirmOptions, type AskOptions, confirm, confirmCss } from "./primitives/confirm.js";
export { ask } from "./primitives/ask.js";
export { type SwitchHandle, type SwitchOptions, createSwitch } from "./primitives/switch.js";
export {
  TAPERS,
  TAPER_POWER,
  TAPER_STEPS,
  type Taper,
  dialTaper,
  isTapered,
  snapToStep,
  taperCurve,
  taperFromUnit,
  taperKeyPosition,
  taperKeyValue,
  taperPosition,
  taperToUnit,
  taperValue,
} from "./primitives/taper.js";
import type { Taper } from "./primitives/taper.js";
export { ENV_TAU, envUnits, envelopeLabelXs, envelopeXs } from "./primitives/envelope.js";
export {
  LOG_STEPS,
  type SliderHandle,
  type SliderSpec,
  createSlider,
  fromPosition,
  sliderFactory,
  toPosition,
} from "./primitives/slider.js";
export {
  TOAST_DURATION,
  type ToastCloseReason,
  type ToastHandle,
  type ToastProps,
  anchorToastPosition,
  createToast,
  pickToastPlacement,
  toastAnnouncement,
} from "./primitives/toast.js";
export { HELP_ATTR, HELP_DELAY, type HelpTips, installHelpTips, placeHelp } from "./primitives/help.js";
export { PAGE_MENU_ICON, PAGE_MENU_PHONE, type PageMenu, pageMenu } from "./primitives/page-menu.js";
/** "(orientation: landscape) and (max-height: 500px) and (max-width: 1023px)": a phone held sideways. A host mirrors it onto a frame's <html> as data-nc-landscape (a frame as tall as its page never reads as landscape). */
export declare const LANDSCAPE_PHONE: string;

export const HIDDEN_STORAGE_KEY: "netcomposer.hidden.v1";
export const RHYTHM_HIDDEN_KEY: "netcomposer.rhythm.hidden.v1";

export type SlotOp = "recall" | "store" | "clear";
export type FilterPaint = "lp" | "hp" | "bp";

export interface SliderControl {
  type: "slider";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  /** Set only while an LFO or another external source is driving this value. */
  modulated?: boolean;
  onChange: (value: number) => void;
  /** Fires when the pointer or key is released, after the last `onChange`. */
  onCommit?: (value: number) => void;
  /**
   * Adds a Tap button on the label line (tap tempo). Fires on pointerdown, or Enter/Space, with the event
   * timestamp in ms (performance.now() timebase) so the host times taps without click latency.
   */
  onTap?: (timeMs: number) => void;
  /** Readout text with its unit (e.g. "62%", "55 Hz"); also the slider's aria-valuetext. Default: the number. */
  valueText?: string;
  /**
   * How the travel maps to the value (taper.js): "time", "freq", "q" and "rate" spread the travel by ear; the
   * others (the default) are linear. Values, onChange and onCommit stay in the control's own units.
   */
  taper?: Taper;
}
export interface SelectControl {
  type: "select";
  id: string;
  label: string;
  value: string;
  /**
   * `group`: consecutive options with the same group sit under an <optgroup> of that label (the Studio's Add >
   * Plugins). `disabled`: shown, not pickable.
   */
  options: { value: string; label: string; group?: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}
export interface ToggleControl {
  type: "toggle";
  id: string;
  label: string;
  pressed: boolean;
  role?: "mute" | "solo";
  onPress: () => void;
}
export interface ButtonControl {
  type: "button";
  id: string;
  label: string;
  on: boolean;
  onPress: () => void;
  /** Accessible name when it differs from the visible label (e.g. "Tap to join the playing beat"). */
  ariaLabel?: string;
  /** Surprise: a target-min sparkle button beside this one (it also recolours the module's slot row). */
  onSparkle?: () => void;
  /** Tooltip for that sparkle button. */
  sparkleTitle?: string;
}
export interface ReadoutControl {
  type: "readout";
  id: string;
  label: string;
  value: string;
}
export interface LabelControl {
  type: "label";
  id: string;
  text: string;
}
export interface NoteControl {
  type: "note";
  id: string;
  text: string;
  /** "danger": a note that reports something stopped or missing, in the danger token. */
  tone?: "danger";
}
export interface KnobControl {
  type: "knob";
  id: string;
  label: string;
  min: number;
  max: number;
  /** Defaults to one hundredth of the range. Shift uses a tenth of this. */
  step?: number;
  /** Spoken with the value: "120 Hz", "-6 dB", or "45%" when the unit is "%". */
  unit?: string;
  value: number;
  /** Set only while an LFO or another external source is driving this value. */
  modulated?: boolean;
  /** The value as read out (title and aria-valuetext), instead of the number and unit. */
  valueText?: string;
  /** Accessible name when it differs from the label ("Rhythm send A" for a knob labelled "A"). */
  ariaLabel?: string;
  /** Double-click returns the knob here. */
  defaultValue?: number;
  /** The knob over its label, the value in its title only (a strip's sends). */
  compact?: boolean;
  /**
   * A centre-out control (a pan): the compact ring fills from its top (the middle of the travel) to the value, and
   * the value text shows in place of the label while the knob is hovered, focused or dragged.
   */
  bipolar?: boolean;
  /** Bipolar only: the value the ring fills from (a trim's 0 dB); default the middle of the travel. */
  origin?: number;
  /** Hover words (data-nc-help) on the knob's field (label and knob). */
  help?: string;
  /** How the turn maps to the value (taper.js); linear by default. */
  taper?: Taper;
  onChange: (value: number) => void;
}
export interface ChoiceControl {
  type: "choice";
  id: string;
  label: string;
  /** A visible label before the tabs (otherwise `label` is only their accessible name). */
  caption?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}
export interface SlotModel {
  label: string;
  filled: boolean;
  active: boolean;
  /** Changed by edits since it was stored or recalled: a small dot on the slot. */
  edited?: boolean;
  /** Recall waits for the end of the bar; a second tap switches now (Bass). Shown as an accent outline. */
  queued?: boolean;
  /** On the beat while queued (audio-driven): the queued outline goes full accent. */
  pulse?: boolean;
}
export interface SlotRowControl {
  type: "slotRow";
  id: string;
  slots: SlotModel[];
  morph: number;
  morphText: string;
  onSlot: (index: number, op: SlotOp) => void;
  onMorph: (value: number) => void;
  /** Surprise me: new grooves, then the existing slot-fill colours. Omit it when a button control carries the sparkle. */
  onSparkle?: () => void;
}
export interface StepCell {
  on: boolean;
  accent: boolean;
  dim?: boolean;
  velocity?: number;
}
export interface StepRow {
  id: string;
  label: string;
  length: number;
  steps: StepCell[];
  /** 1–4, painted with rhythm.lane-n. */
  lane?: number;
  /** Painted on the lane's M/S buttons (shown when the grid has onMute/onSolo). */
  mute?: boolean;
  solo?: boolean;
}
export interface StepGridControl {
  type: "stepGrid";
  id: string;
  rows: StepRow[];
  playhead: number;
  /** Row id painted as the selected track. */
  selectedRow?: string;
  /**
   * Multi-select: every selected row id (selectedRow among them). Set it to let people pick several lanes:
   * Shift-, Cmd- or Ctrl-click a name, or long-press it on touch, calls onSelectRow(row, true).
   */
  selectedRows?: string[];
  onToggle: (row: number, step: number, accent: boolean) => void;
  /** `extend`: add the row to the selection or take it out (multi-select), instead of selecting it alone. */
  onSelectRow?: (row: number, extend?: boolean) => void;
  /** Swipe-to-paint sets one field explicitly (on/off follows the first step touched). Falls back to onToggle. */
  onSet?: (row: number, step: number, field: "on" | "accent", value: boolean) => void;
  /** Long press on a step (row grid or phone pad); `anchor` is the pressed element. */
  onLongPress?: (row: number, step: number, anchor: HTMLElement) => void;
  /** Adds an M button at each lane start. */
  onMute?: (row: number) => void;
  /** Adds an S button at each lane start. */
  onSolo?: (row: number) => void;
  /** Adds a mini Play to the phone pad header (sticky while the pads are on screen). */
  transport?: {
    playing: boolean;
    onToggle: () => void;
    /** Visible label; default "Stop" while playing, else "Play" (e.g. "Tap to join"). */
    label?: string;
    /** Accessible name when it differs from the label. */
    ariaLabel?: string;
  };
  /** Per-row dice (and the phone pad header's): new steps for that row. Pair it with an Undo. */
  onDice?: (row: number) => void;
  /** Hold-for-Fill: true while held, false on release. The host plays a fill without storing it. */
  onFill?: (held: boolean) => void;
  /** Adds a Clear button to the tools row: every step off. Pair it with an Undo. */
  onClear?: () => void;
  /** The Clear button's words. Default "Clear". */
  clearLabel?: string;
  /**
   * Per-lane length, 1..steps.length. Adds an end handle after the selected row's last step (drag it, or arrow
   * keys), and makes the phone pad header's lane name a toggle: in length mode a tap or drag across the pads
   * sets where the lane ends.
   */
  onLength?: (row: number, length: number) => void;
}
export interface PadCell {
  /** The pad's name (shown when filled). */
  label: string;
  /** No sample: the pad says Load. */
  empty: boolean;
  /** Mini waveform: min/max pairs per column (−1..1), left to right. */
  peaks?: number[];
  /** 1–4: the bar and waveform in rhythm.lane-n. */
  lane?: number;
  /** Sounding now (a brighter waveform). */
  playing?: boolean;
  /** A short tag in the pad's corner (NYX: its choke group, "A"); `badgeLabel` is what a screen reader says. */
  badge?: string;
  badgeLabel?: string;
  /** A filled pad's short line under its name (NYX: "tuned · CALLIOPE"); a screen reader says it after the name. */
  hint?: string;
}
export interface PadGridControl {
  type: "padGrid";
  id: string;
  /** Accessible group name. Default "Pads". */
  label?: string;
  pads: PadCell[];
  /** The outlined pad's index. */
  selected?: number;
  /** 2 (default) or 4. */
  columns?: 2 | 4;
  /** An empty pad's words. Defaults "Load" and "tap or drop". */
  emptyLabel?: string;
  emptyHint?: string;
  /** Tap, Enter or Space on a pad. */
  onPress: (index: number) => void;
  /**
   * The pointer going down on a pad, before the tap ends: play it here so a pad sounds on the hit and a hold plays
   * it out. With onDown, a held mouse button doesn't open the menu (right-click does); touch still long-presses.
   */
  onDown?: (index: number) => void;
  /** A file dropped on a pad. */
  onFile?: (index: number, file: File) => void;
  /** A filled pad dragged onto another: move (the two swap), or copy with Option / Alt. Pads are draggable when set. */
  onMove?: (from: number, to: number, copy: boolean) => void;
  /** Long-press or right-click: the pad's menu items (none: no menu). */
  menu?: (index: number) => { id: string; label: string }[];
  onMenu?: (index: number, item: string) => void;
  /**
   * The pad's name edited in place (double-click a filled pad, or a menu item with id "rename"). Set it to let
   * people name pads; the grid handles "rename" itself instead of calling onMenu.
   */
  onRename?: (index: number, name: string) => void;
  /** Longest name the field takes. Default 24. */
  nameMax?: number;
}
export interface CanvasControl {
  type: "canvas";
  id: string;
  label: string;
  paint: "filter" | "envelope" | "meter" | "playhead" | "swatch" | "waveform";
  mode?: FilterPaint;
  cutoff?: number;
  resonance?: number;
  /**
   * filter: the real response instead of the sketch. The filter's frequency (Hz), its Q (default 0.7071) and the
   * sample rate (default 48 kHz): the RBJ biquad nc-fx runs, 20 Hz .. 20 kHz (log) by +24 .. −60 dB.
   */
  hz?: number;
  q?: number;
  sampleRate?: number;
  /** filter (with hz): a low-pass all the way open, drawn flat. */
  open?: boolean;
  /** envelope: the attack (s); decay is the decay (s); max the longest [attack, decay] (s), which fixes the scale. */
  attack?: number;
  max?: [number, number];
  decay?: number;
  level?: number;
  step?: number;
  steps?: number;
  /** waveform: min/max pairs per column (-1..1), left to right. */
  peaks?: number[];
  /** waveform: the played part, 0..1 of the sample (tinted, start and end marked). */
  region?: [number, number];
  /** waveform: more marks, 0..1 (slice points). */
  markers?: number[];
  /** waveform: where the voice is now, 0..1; absent or negative while silent. */
  position?: number;
  /** waveform: the words shown when there is no sample. */
  empty?: string;
}
export interface FxControl {
  type: "fx";
  id: string;
  title: string;
  depth: 1 | 2 | 3 | 4;
  controls: Control[];
  /** Give the card a header switch (role="switch", named by the title). Off dims the card by colour. */
  on?: boolean;
  onToggle?: (on: boolean) => void;
  /** Rarely used rows, behind a "More" disclosure (fx-blocks' modulation rows). */
  more?: Control[];
  moreLabel?: string;
  /**
   * Give the card a horizontal-fold triangle after its switch (◀ open, ▶ folded; foldToggle). Folded, a card in a console row is a
   * narrow column (fx-fold-width): one button with its name read bottom to top and its on/off word; a click, Enter or
   * Space unfolds it. Elsewhere, and on phones, a folded card keeps only its header row. Folding never touches `on`.
   * The host keeps the state (a UI preference) and passes it back as `folded`.
   */
  onFold?: (folded: boolean) => void;
  /** Folded now (only with `onFold`). */
  folded?: boolean;
  /** Hover words (data-nc-help) for the fold triangle and the folded column. */
  foldHelp?: string;
  /**
   * Folded in a console row, a slim column (fx-fold-width-slim, half of fx-fold-width) with the same triangle, on/off
   * word (a step smaller), name and meter (Peter, 2026-11-01: the Studio's send returns, "50% thinner").
   */
  foldSlim?: boolean;
  /**
   * A maximize button in the header (on by default for a card holding an `eqGraph`; false turns it off). In a console
   * row the card takes three columns; elsewhere it opens as a panel three module widths wide over the modules beside
   * it; on phones it only grows taller. The button again, Escape or the panel's × restores it. The kit remembers it per
   * card id for the page's life (never stored). See docs/eq-graph.md.
   */
  maximize?: boolean;
  /** Hover words (data-nc-help) for the maximize button. */
  maxHelp?: string;
  /**
   * A quiet × at the end of the header (after maximize) that calls this with the button; the host removes the card
   * (and, in the Studio, offers Undo). Hidden while the card is folded. Named `removeLabel`, else "Remove <title>".
   */
  onRemove?: (opener: HTMLElement) => void;
  /** The ×'s aria-label and tooltip, e.g. "Remove EQ" (default "Remove <title>"). */
  removeLabel?: string;
  /**
   * A small level meter beside the switch (and at the foot of the folded column): the signal going into the effect
   * (left bar) and coming out (right bar), −48 to 0 dBFS with the strips' ballistics. Opened only while it is on
   * screen; every meter on the page shares one loop. nc-fx's fxMeter(fx, id) is one. See docs/fx-level.md.
   */
  meter?: FxLevelSource;
  /** Hover words (data-nc-help) for the meter; say what it shows (it is aria-hidden). */
  meterHelp?: string;
}
/** What an FX card's meter reads: the latest sample peaks (1 = full scale), { in, out? }, or a bare number (input only). */
export type FxLevelReading = { in: number; out?: number } | number | null | undefined;
export interface FxLevelSource {
  /** Called when the meter comes on screen; false: nothing to meter. */
  open?(): unknown;
  /** Called when it leaves the screen (or the page is hidden, or the card goes). */
  close?(): void;
  read(): FxLevelReading;
}
/** One band of an EQ graph, in engine units. */
export interface EqGraphBand {
  id: string;
  label: string;
  kind: "lowshelf" | "peak" | "highshelf";
  hz: number;
  db: number;
  q: number;
  /** Dragging across (and Left/Right) moves its frequency. */
  moveHz?: boolean;
  /** The wheel over it (and Page Up/Down) moves its Q. */
  moveQ?: boolean;
  minHz?: number;
  maxHz?: number;
  minQ?: number;
  maxQ?: number;
  /** Screen readers: "−18 dB at 938 Hz, Q 0.3". */
  valueText?: string;
  /** Hover words (data-nc-help) on its node. */
  help?: string;
}
/**
 * An EQ's frequency graph (docs/eq-graph.md): 20 Hz-20 kHz, the combined response with a soft fill to 0 dB, each
 * band's own curve faintly, a draggable node per band, and an optional live spectrum behind. nc-fx's eqGraph() builds
 * one from a chain.
 */
/** One step of a level-steps strip: its level (0..1) and its shape (a `shapes` value). */
export interface LevelStep { level: number; shape: number }
/**
 * Level steps (Gate's strip): a step per column, its level a soft bar, its shape's curve over it; tap or drag to draw
 * levels, long-press (right-click, Enter) a step for its own shape; the shapes as tabs under it set every step. The
 * kit draws; the host owns the state.
 */
export interface LevelStepsControl {
  type: "levelSteps";
  id: string;
  label?: string;
  steps: LevelStep[];
  /** Steps that play each pass; the rest show dashed and empty (Gate's 1/8T with 16 steps: 12). Default: all. */
  played?: number;
  /** The first step of each pair's share of the pair (0.5..0.75: swing). Default 0.5. */
  swing?: number;
  /** false while the effect is off: the strip goes quiet. */
  on?: boolean;
  /** The shapes (value, name, and a 20 x 10 SVG path for its icon). */
  shapes?: { value: number; label: string; icon?: string }[];
  /** The tabs' accessible name. Default "Shape of every step". */
  shapesLabel?: string;
  /** n + 1 gains (0..1) across step i, for its curve. Omitted: a flat line at its level. */
  curve?(i: number, n: number): ArrayLike<number>;
  /** Every move of a drawing finger or mouse (all levels, 0..1, whole percents); done on release. */
  onLevels(levels: number[], done: boolean): void;
  /** A long press (right-click, Enter) on step i, then a shape picked. */
  onShape?(i: number, shape: number): void;
  /** A shape tab: every step. */
  onShapeAll?(shape: number): void;
  /** Read about 30 times a second while on the page: the playing step (and whether it is locked to Play), or null. */
  playhead?(): { step: number; locked: boolean } | null;
  /** Hover words (data-nc-help) for the strip. */
  help?: string;
}
export interface EqGraphControl {
  type: "eqGraph";
  id: string;
  label?: string;
  /** The gain range, each way (dB). Default 18. */
  range?: number;
  sampleRate?: number;
  /** false while the EQ is bypassed: the curve and nodes go quiet. */
  on?: boolean;
  bands: EqGraphBand[];
  /** The response in dB at each frequency: the combined curve and each band's own, in `bands` order. */
  response(freqs: Float64Array): { total: ArrayLike<number>; bands: ArrayLike<number>[] };
  /** An analyser of what the effect puts out; opened only while the graph is on screen. */
  spectrum?: { open(): AnalyserNode | null; close(): void };
  /** A drag, key or wheel on a node (engine units). Route it through the same setters as the sliders. */
  onBand(id: string, patch: { hz?: number; db?: number; q?: number }): void;
  /** A double-click (or Delete) on a node: put that band back. */
  onReset?(id: string): void;
  /** Hover words (data-nc-help) for the graph. */
  help?: string;
}
/**
 * A collapsible run of controls (NYX's "Tune & shape"): a header button that opens and closes them, with the look
 * and touch target of the FX card's More. Closed by default. Once toggled, this browser remembers it by `id`
 * (GROUP_OPEN_KEY, a UI preference, never part of a document).
 */
export interface GroupControl {
  type: "group";
  id: string;
  title: string;
  /** Beside the title while closed: e.g. what differs from the defaults ("+3 st · decay 450 ms"). Empty: nothing. */
  summary?: string;
  /** Open before this browser has toggled it. Default false. */
  open?: boolean;
  /**
   * "phone": fold only on phones (max-width 768px, a landscape phone, or a frame under html[data-nc-landscape]),
   * closed until toggled; on tablets and desktops the controls show flat, with no header, as if ungrouped.
   * Default: a group everywhere.
   */
  collapse?: "phone";
  /** After each toggle (the kit has already opened or closed it and remembered it). */
  onToggle?: (open: boolean) => void;
  controls: Control[];
}
/** A strip's send: a compact knob (0..1) under the strip's M and S. */
export interface StripSend {
  id: string;
  label: string;
  ariaLabel?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  valueText?: string;
  defaultValue?: number;
  onChange: (value: number) => void;
}
/**
 * A mixer channel strip: name, M and S, sends, the console fader (a flat cap, 0..1 position) with its meter beside it
 * on one scale, and the readout. The host owns the law: `ticks` and every meter level are positions on it, so the
 * labels line up with both. Update the meter every frame with `stripMeter(moduleEl, id).update(levels, dt)`.
 */
export interface StripControl {
  type: "strip";
  id: string;
  label: string;
  /** Fader position 0..1 (bottom to top). */
  value: number;
  /** The readout and aria-valuetext ("−6.0"). */
  valueText?: string;
  /** Arrow-key step in positions (default 0.005); Page Up/Down are ten, Shift a quarter. */
  step?: number;
  /** Where a double-click (fader or readout) returns, when there is no onReset. */
  defaultValue?: number;
  /** Shown in the readout's title: "Double-click: back to −6.0 dB". */
  resetText?: string;
  /** Tick labels on the scale between fader and meter: `value` is a position. */
  ticks?: { value: number; label: string }[];
  /** 2: a stereo (two-sided) meter. */
  channels?: 1 | 2;
  /** The master strip: wider. */
  master?: boolean;
  mute?: boolean;
  solo?: boolean;
  /** Muted, or silenced by another strip's solo: the name and readout dim by colour. */
  silent?: boolean;
  sends?: StripSend[];
  /**
   * The sends row is hidden (view only: the knobs stay, unseen). Give it to every strip in a console, the master
   * too, so their rows still line up: the strips get shorter by the row.
   */
  sendsHidden?: boolean;
  onChange: (value: number) => void;
  onReset?: () => void;
  /** Adds the Hacks button above M and S: the host shows this strip's effects stack (the console's fx area). */
  onHacks?: () => void;
  /** The Hacks button is pressed (this strip's stack is the one shown). */
  hacks?: boolean;
  /** The Hacks button's text (default "Hacks"; the Studio says "Inserts"). */
  hacksLabel?: string;
  /**
   * The strip's stack has no effects: the Hacks button shows as its plain word, no outline (still a button, with its
   * focus ring; pressed looks as before). Default false: the outlined button.
   */
  hacksEmpty?: boolean;
  /**
   * Adds a text button under the Hacks button, in the M/S row (meant for the master, which has no M or S): it shows or
   * hides the console's send cards (the host decides what shows). It looks like the Hacks button: a box, or the plain
   * word with sendsViewEmpty, and pressed with sendsView.
   */
  onSendsView?: () => void;
  /** The send cards are showing: the button is pressed. */
  sendsView?: boolean;
  /** Nothing is sent (every send at its minimum): the plain word, no box (still a button with its focus ring). */
  sendsViewEmpty?: boolean;
  /** The button's text (default "Sends"). */
  sendsViewLabel?: string;
  /** Hover words for it. */
  sendsViewHelp?: string;
  /**
   * Move (not on the master): adds a small grip in the strip's top-right corner, across from the fold triangle, that
   * says the strip can be dragged (the host does the drag). As a button, ← and → (Alt too) call onMove(-1 | 1).
   */
  onMove?: (delta: -1 | 1) => void;
  /** The grip's tooltip (default "Drag to move this channel"). */
  moveHelp?: string;
  /**
   * The strip's shade, 1-8 (strip-shade-1..8: eight neutral greys), in place of the light / dark alternation; missing,
   * 0 or anything else: the alternation ("Auto"). Not on the master. On 5-8 the Inserts word at rest is text-sub.
   */
  shade?: number;
  /**
   * Adds the strip menu: a click on the grip, or a right-click on the name (not a touch long press), opens "Shade"
   * (Auto and 1-8; picks call onShade(null | 1..8)) and, with onMove, Move left / Move right.
   */
  onShade?: (shade: number | null) => void;
  /** Adds the M button. */
  onMute?: () => void;
  /** Adds the S button. */
  onSolo?: () => void;
  /** The clip light was clicked (it clears itself). */
  onClipClear?: () => void;
  /** Adds a remove × after the name (an instrument instance). `opener` is the button, for the confirm's focus. */
  onRemove?: (opener: HTMLElement) => void;
  /**
   * Minimize (not on the master): the horizontal-fold triangle in the strip's top-left corner, above the name (the name
   * row and its × are unchanged). Folded, the strip
   * is a narrow column (strip-fold-width): the ▶, M and S stacked (still working), the fader cap's colour as a small
   * mark and the name read bottom to top (one button: a click, Enter or Space unfolds it), and a thin meter that
   * lines up with the open strips'. Folding never touches the level or the sound. The host keeps the state.
   */
  onFold?: (folded: boolean) => void;
  /**
   * A pan knob (not on the master): a compact bipolar knob, −1 (L) .. +1 (R), between the sends and the fader, labelled
   * "L R" and read out as "C", "L 30", "R 45" (panText) on hover, focus or drag. Double-click centres it; arrows move
   * it. Every strip keeps the row (empty without pan), so faders line up. Folded strips hide it and show a tiny pan
   * mark (--nc-strip-pan).
   */
  pan?: {
    id: string;
    value: number;
    onChange: (value: number) => void;
    /** "L R" by default. */
    label?: string;
    /** "<strip label> pan" by default. */
    ariaLabel?: string;
    /** panText(value) by default. */
    valueText?: string;
    /** Arrow step (default 0.05); Shift is a tenth. */
    step?: number;
    /** Hover words for the pan knob. */
    help?: string;
  };
  /**
   * A trim (not on the master): the channel's input gain as a console has it, a compact knob in its own row at the top
   * of the strip (under the name, before Inserts), labelled "Trim" and read out as "0 dB", "+12 dB", "−3.5 dB"
   * (trimText) on hover, focus or drag. Its ring fills from 0 dB either way; double-click returns to `defaultValue`
   * (0 dB); arrows move a `step` (0.5 dB). dB in, dB out: −12 .. +24 by default.
   */
  trim?: {
    id: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    /** "Trim" by default. */
    label?: string;
    /** "<strip label> trim" by default. */
    ariaLabel?: string;
    /** trimText(value) by default. */
    valueText?: string;
    help?: string;
  };
  /** An empty trim row (the master beside trimmed channels), so the faders line up. */
  trimRow?: boolean;
  /**
   * The trim row is hidden (view only: the knob stays, unseen). Give it to every strip in a console, the master too, so
   * their rows still line up. A host's phones: Trim on demand.
   */
  trimHidden?: boolean;
  /** Minimized now (only with `onFold`). */
  folded?: boolean;
  /** Hover words for the triangle (and the folded column, unless `foldedHelp`). */
  foldHelp?: string;
  /** Hover words for the folded column. */
  foldedHelp?: string;
  /**
   * A single click (or Enter) on the readout opens it for typing (ASTRID's type-in values): Enter calls this with
   * the text, Escape or leaving cancels. The host parses and clamps. A double-click still resets.
   */
  onTypeIn?: (text: string) => void;
}
/** The console's add slot: a ghost strip after the strips, "+ Add" over a select of what can be added. */
export interface StripAddControl {
  type: "stripAdd";
  id: string;
  /** On the slot ("Add"). */
  label: string;
  /** The select's accessible name and first line ("Add instrument"). */
  ariaLabel?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onAdd: (value: string) => void;
}
/** One Move: an icon button (16-unit paths), its words for screen readers and its hint. */
export interface MoveItem {
  id: string;
  text: string;
  title?: string;
  icon?: { stroke?: string; fill?: string };
  disabled?: boolean;
}
/** Moves (Bass's pattern moves as a kit control): labelled rows of icon buttons. */
export interface MovesControl {
  type: "moves";
  id: string;
  /** Accessible group name. Default "Moves". */
  label?: string;
  groups: { id: string; label: string; title?: string; moves: MoveItem[] }[];
  onMove: (id: string) => void;
}
export type Control =
  | MovesControl
  | SliderControl
  | SelectControl
  | ToggleControl
  | ButtonControl
  | ReadoutControl
  | LabelControl
  | NoteControl
  | KnobControl
  | ChoiceControl
  | SlotRowControl
  | StepGridControl
  | PadGridControl
  | CanvasControl
  | FxControl
  | EqGraphControl
  | LevelStepsControl
  | GroupControl
  | StripControl
  | StripAddControl;

export interface ModuleSection {
  id: string;
  title?: string;
  /** Shaded inset panel, one shade darker than the module, full bleed (ASTRID's Hacks panel). */
  inset?: boolean;
  /** A panel under the section before it: page-coloured, full bleed, a title (`title`) plus what it edits
   * (`subject`, tinted by `lane`), and its controls in columns from 1024 px. Rhythm's Parameters panel. */
  panel?: boolean;
  subject?: string;
  lane?: 1 | 2 | 3 | 4;
  /** In a console module: where this section sits ("strips" scroll on phones, "fx" cards, optional "meters" just left of the master, the "master" strip). */
  area?: "strips" | "fx" | "meters" | "master";
  /** Accessible group name for the section. */
  label?: string;
  /**
   * Pages (a console's fx area): from 769 px show the section's FX cards this many at a time, on one row, with a slim
   * bar above them: ‹ ("Previous effects page"), "1 / 3", › ("Next effects page"), quiet at the ends. Pages count
   * cards, folded or not. The row is as tall as the tallest card of any page, so turning a page never changes the
   * module's height. A maximized card takes its page; turning away restores it. Phones stack every card (no bar).
   */
  pageSize?: number;
  /** The page to show, from 0, clamped to the pages there are. Omitted: the kit keeps the page it shows. */
  page?: number;
  /** A press on ‹ or ›: the new page, from 0 (the kit has already shown it). Pass `page` back on the next render. */
  onPage?(page: number): void;
  controls: Control[];
}
/** The pages of `count` cards shown `size` at a time, and `page` clamped into them (from 0). */
export function fxPages(count: number, size: number, page: number): { pages: number; page: number };
export interface ModuleDef {
  id: string;
  title: string;
  summary?: string;
  /** Quiet header line. Empty until a slot store, clear, or empty recall. */
  status?: string;
  /** Desktop lead column, as ASTRID: 30fr against 23.333fr; from 1280 px 48fr against 21.333fr; at 1024-1279 px 53fr against 23.333fr (with three other open modules the last two stack in one column). */
  lead?: boolean;
  controls?: Control[];
  sections?: ModuleSection[];
  /** A compact header: the title at the slim size and the index on one slim line, a small gap under it. */
  compact?: boolean;
  /** "console": the sections sit on one row by `area` (strips, fx, meters, master), full bleed (the Studio's Mix). */
  layout?: "console";
  /** Show a header switch (role="switch", named by the title). Off dims the body by colour. */
  on?: boolean;
  onToggle?: (on: boolean) => void;
}
export interface ModuleHandle {
  el: HTMLElement;
  update(def: ModuleDef): void;
  redraw(): void;
}

/** The FX level meter's scale floor and where its clip colour starts (dBFS). */
export const FX_LEVEL_FLOOR_DB: number;
export const FX_LEVEL_CLIP_DB: number;
/** A sample peak as a 0..1 position on the meter's −48..0 dBFS scale. */
export function fxLevelPosition(peak: number): number;
/** The meter element (two bars), for hosts that draw their own cards. */
export function createFxLevel(doc?: Document): HTMLElement;
/** Drive meter elements from a source; the shared loop opens it while any element is on screen. */
export function bindFxLevel(els: HTMLElement | HTMLElement[], source: FxLevelSource | null | undefined): { set(source: FxLevelSource | null | undefined): void; destroy(): void };
/** For tests. */
export function fxLevelState(el: Element): { open: boolean; running: boolean; idle: boolean; meters: number; shown: number[] };
export function readHidden(
  storage: Pick<Storage, "getItem"> | null | undefined,
  key?: string,
): Set<string>;
export function writeHidden(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  id: string,
  hidden: boolean,
  key?: string,
): void;
export function seedHidden(ids: readonly string[], key?: string): void;
/** Where groups' open state is kept: `{ [group id]: open }`. */
export const GROUP_OPEN_KEY: "netcomposer.groups.v1";
/** The groups toggled in this browser: id → open. */
export function readGroups(storage?: Pick<Storage, "getItem"> | null, key?: string): Map<string, boolean>;
export function writeGroup(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  id: string,
  open: boolean,
  key?: string,
): void;
export function defineModule(def: ModuleDef, storageKey?: string): ModuleHandle;
export function placeModules(
  host: HTMLElement,
  modules: ModuleHandle[],
  layout?: "adjacent" | "stack",
): void;
export function syncAdjacentColumns(host: HTMLElement | null): void;
export function renderGallery(host: HTMLElement): ModuleHandle[];

export interface FaderHandle {
  readonly el: HTMLElement;
  readonly value: number;
  readonly dragging: boolean;
  /** Move the cap without onChange; ignored while a hand holds it. */
  set(value: number): void;
  setText(text: string | undefined): void;
  setLabel(text: string): void;
  configure(next: { step?: number; onChange?: (value: number) => void; onReset?: () => void }): void;
}
export function createFader(options: {
  label: string;
  value?: number;
  step?: number;
  valueText?: string;
  onChange?: (value: number) => void;
  onReset?: () => void;
  doc?: Document;
}): FaderHandle;
export function faderHandle(el: Element): FaderHandle | undefined;

/** One meter channel for one frame: 0..1 positions on the host's scale; `over` lights the clip light. */
export interface MeterLevel {
  peak: number;
  rms: number;
  over?: boolean;
}
export interface MeterHandle {
  readonly el: HTMLElement;
  readonly clipped: boolean;
  update(levels: readonly MeterLevel[], dt: number): void;
  clip(): void;
  clear(): void;
  reset(): void;
  setLabel(text: string): void;
  configure(next: { onClear?: () => void }): void;
}
export function createMeter(options: {
  channels?: 1 | 2;
  label: string;
  onClear?: () => void;
  doc?: Document;
}): MeterHandle;
export function meterHandle(el: Element | null | undefined): MeterHandle | undefined;
export function cssSeconds(text: string | null | undefined, fallback: number): number;
/** The meter of the strip control `id` inside `root` (a module element). */
export function stripMeter(root: ParentNode | null | undefined, id: string): MeterHandle | undefined;
/** How many shades a strip can take (8). */
export const STRIP_SHADES: number;
/** A strip control's picked shade, 1-8, or 0 (auto). */
export function stripShade(control: Partial<StripControl> | null | undefined): number;
/** Open a strip's menu (the kit does this from the grip and a right-click on the name). */
export function openStripMenu(
  strip: HTMLElement,
  anchor: HTMLElement,
  lookup: (el: HTMLElement) => unknown,
  at?: { x: number; y: number },
): { el: HTMLElement; close(): void } | null;
/**
 * The horizontal-fold toggle (FX cards, console strips): a small solid triangle, ◀ while open, flipped to ▶ while
 * folded. −/+ (.nc-hide) stays the vertical hide. `setFoldToggle` sets aria-expanded and "Minimize/Expand <label>".
 */
/** A pan as a mixer reads it: "C", "L 30", "R 45" (percent of the way to the side). */
export function panText(value: number): string;
/** "0 dB", "+12 dB", "−3.5 dB": a strip trim's readout. */
export function trimText(db: number): string;
export function foldToggle(): HTMLButtonElement;
export function setFoldToggle(button: HTMLElement, folded: boolean, label: string): void;

/** The EQ graph's frequency span (Hz). */
export const EQ_MIN_HZ: 20;
export const EQ_MAX_HZ: 20000;
/** x (0..w) for a frequency on the graph's log axis, and back. */
export function eqX(hz: number, w: number): number;
export function eqHz(x: number, w: number): number;
/** y for a gain in a plot of height h (pad above +range and below -range), and back. */
export function eqY(db: number, h: number, range: number, pad: number): number;
export function eqDb(y: number, h: number, range: number, pad: number): number;
/** "938 Hz", "1.5 kHz". */
export function hzText(hz: number): string;
/** What a key does on a band's node: a patch, "reset", or null. */
export function eqKeyPatch(band: EqGraphBand, key: string, shift: boolean, range: number): { hz?: number; db?: number; q?: number } | "reset" | null;
/** A relative drag from a band's start, as a patch (fine: a quarter of the movement). */
export function eqDragPatch(band: EqGraphBand, start: { hz: number; db: number }, dx: number, dy: number, w: number, h: number, range: number, pad: number, fine: boolean): { hz?: number; db: number };
/** The spectrum's column map (bin span and tilt per column). */
export function spectrumColumns(cols: number, w: number, binCount: number, sampleRate: number): { lo: Float32Array; hi: Float32Array; tilt: Float32Array };
export function columnLevel(buf: ArrayLike<number>, lo: number, hi: number): number;
/** For tests: is a graph's spectrum loop running, and does it hold the analyser open? */
export function eqSpectrumState(graph: Element): { running: boolean; open: boolean; idle: boolean };
/** Where a maximized card opens over the modules: three module widths from its own column, inside the row (px in the module). */
export function overPanelBox(at: DOMRectReadOnly, module: DOMRectReadOnly, row: DOMRectReadOnly, gap: number, viewW: number): { left: number; top: number; width: number };
/** The graph on its own (outside a kit module): render with a lookup that returns the current control, patch, repaint. */
export function renderEqGraph(control: EqGraphControl, lookup: (node: Element) => unknown): HTMLElement;
/** Level steps (Gate's strip). */
export function renderLevelSteps(control: LevelStepsControl, lookup: (node: Element) => unknown): HTMLElement;
export function patchLevelSteps(wrap: Element, control: LevelStepsControl): void;
/** How long a press holds before it opens the shape picker (ms), and how far it may wander (px) and still count. */
export const LONG_PRESS_MS: number;
export const PRESS_SLOP: number;
/** A level (0..1, whole percents) from y in a plot of height h. */
export function levelAt(y: number, h: number): number;
/** The step an x falls in, given the steps' right edges. */
export function stepAt(x: number, rights: number[]): number;
/** Levels with steps a..b drawn on a line from la to lb. */
export function drawLine(levels: number[], a: number, la: number, b: number, lb: number): number[];
export function levelStepsState(wrap: Element): { focus: number; dragging: boolean; picking: boolean } | null;
export function patchEqGraph(graph: Element, control: EqGraphControl): void;
export function paintEqGraph(graph: Element): void;

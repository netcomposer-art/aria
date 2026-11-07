// The kit's slider as a factory, matching fx-blocks' SliderFactory contract
// ((spec) => { el, set(value) }), so a block (or any app) gets the same row as renderControl's slider:
// label and value on one line, the range full width below with a target-min (44 px) touch band on every pointer,
// and colour dimming when disabled. A tapered slider (spec.taper, see taper.js; `log: true` is the "freq" taper)
// runs its range in 0..TAPER_STEPS positions.
import { TAPER_STEPS, isTapered, taperKeyValue, taperPosition, taperValue } from "./taper.js";

export const LOG_STEPS = TAPER_STEPS;

const taperName = (log) => (log === true ? "log" : typeof log === "string" ? log : "linear");

/** A value to the range input's position. `log`: true (logarithmic) or a taper name (taper.js). */
export function toPosition(min, max, value, log) {
  const taper = taperName(log);
  if (!isTapered(taper, min, max)) return value;
  return taperPosition(taper, min, max, value);
}

/** A range input's position to its value (unrounded; createSlider snaps to the spec's step). */
export function fromPosition(min, max, position, log) {
  const taper = taperName(log);
  if (!isTapered(taper, min, max)) return position;
  return taperValue(taper, min, max, position);
}

/**
 * @param {{ id: string, label: string, min: number, max: number, value: number, log?: boolean, step?: number,
 *   format: (v: number) => string, onInput: (v: number) => void, disabled?: boolean }} spec
 * @param {{ doc?: Document }} [options]
 */
export function createSlider(spec, options = {}) {
  const doc = options.doc ?? globalThis.document;
  if (spec.log === true && !(spec.min > 0 && spec.max > spec.min)) throw new RangeError(`log slider ${spec.id} needs 0 < min < max`);
  const taper = spec.taper ?? taperName(spec.log);
  const log = isTapered(taper, spec.min, spec.max);
  const el = doc.createElement("div");
  el.className = "nc-field";
  el.dataset.ncRow = "";
  el.dataset.ncSlider = "";
  el.dataset.ncId = spec.id;
  const label = doc.createElement("label");
  label.className = "nc-label";
  label.setAttribute("for", spec.id);
  label.textContent = spec.label;
  const input = doc.createElement("input");
  input.type = "range";
  input.className = "nc-range";
  input.id = spec.id;
  input.dataset.ncId = spec.id;
  input.min = String(log ? 0 : spec.min);
  input.max = String(log ? LOG_STEPS : spec.max);
  input.step = log ? "1" : String(spec.step ?? "any");
  const readout = doc.createElement("span");
  readout.className = "nc-readout";
  readout.dataset.ncReadout = "";
  const probe = doc.createElement("i");
  probe.className = "nc-token-probe";
  probe.dataset.ncProbe = "";
  el.append(label, input, readout, probe);

  let value = spec.value;
  const show = () => {
    const text = spec.format(value);
    readout.textContent = text;
    input.setAttribute("aria-valuetext", text);
  };
  const set = (next) => {
    value = next;
    if (doc.activeElement !== input) input.value = String(log ? taperPosition(taper, spec.min, spec.max, value) : value);
    show();
  };
  input.addEventListener("input", () => {
    value = log ? taperValue(taper, spec.min, spec.max, input.value, spec.step) : Number(input.value);
    show();
    spec.onInput(value);
  });
  if (log)
    input.addEventListener("keydown", (event) => {
      const next = taperKeyValue(taper, spec.min, spec.max, value, event.key, event.shiftKey, spec.step);
      if (next === null || input.disabled) return;
      event.preventDefault();
      input.value = String(taperPosition(taper, spec.min, spec.max, next));
      value = next;
      show();
      spec.onInput(value);
    });
  input.disabled = spec.disabled === true;
  set(spec.value);
  return {
    el,
    set,
    /** Dim by colour and stop input (a bypassed block). */
    setDisabled(disabled) {
      input.disabled = disabled === true;
    },
  };
}

/** fx-blocks' `SliderFactory`: pass this as `slider` to createDriveBlock / createDelayBlock. */
export const sliderFactory = (spec) => createSlider(spec);

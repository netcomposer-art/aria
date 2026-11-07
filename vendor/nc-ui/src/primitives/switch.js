// A real on/off switch (fx-blocks' header switch, moved into the kit): a <button role="switch"> with aria-checked,
// named by the title it sits next to. ASTRID's text on/off: the word alone (On / Off), no track. Both words share one
// grid cell, so the switch never changes width when it flips. Styles are in kit.js (.nc-ui-switch); every length is a token.

/**
 * @param {{
 *   checked?: boolean,
 *   onChange?: (checked: boolean) => void,
 *   label?: string,
 *   labelledBy?: string,
 *   onText?: string,
 *   offText?: string,
 *   id?: string,
 *   doc?: Document,
 * }} [options]
 */
export function createSwitch(options = {}) {
  const doc = options.doc ?? globalThis.document;
  const el = doc.createElement("button");
  el.type = "button";
  el.className = "nc-ui-switch";
  el.setAttribute("role", "switch");
  if (options.id) el.id = options.id;
  if (options.labelledBy) el.setAttribute("aria-labelledby", options.labelledBy);
  else if (options.label) el.setAttribute("aria-label", options.label);
  const text = doc.createElement("span");
  text.className = "nc-ui-switch-text";
  text.setAttribute("aria-hidden", "true");
  const on = doc.createElement("span");
  on.dataset.ncOn = "";
  on.textContent = options.onText ?? "On";
  const off = doc.createElement("span");
  off.dataset.ncOff = "";
  off.textContent = options.offText ?? "Off";
  text.append(on, off);
  el.append(text);

  let checked = false;
  const set = (next) => {
    checked = next === true;
    el.setAttribute("aria-checked", checked ? "true" : "false");
  };
  set(options.checked);
  const onClick = () => {
    set(!checked);
    options.onChange?.(checked);
  };
  el.addEventListener("click", onClick);
  return {
    el,
    get checked() {
      return checked;
    },
    /** Set the state without calling onChange (for a host that owns the state). */
    set,
    destroy() {
      el.removeEventListener("click", onClick);
      el.remove();
    },
  };
}

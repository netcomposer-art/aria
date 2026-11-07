# src/primitives: seam for the control primitives

Reserved for the control primitives (Petra): slider, select, toggle, slot row, readout, label.

- Read semantic tokens only (`slider-*`, `label-*`, `readout-*`, `slot-*`, `focus-*`).
- A primitive's internal geometry (arrow offsets, glyph boxes) may stay literal, because it belongs to that one control.
- No transitions on sliders. Rows stay on one line down to 360 px. Hidden means hidden, not unmounted.

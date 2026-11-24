// Skins (Peter, 2026-11-19): personal colour schemes on top of the default theme. Plain Node, no dependencies.
// A skin is one file, tokens/skins/<id>.json:
//   { "id": "oxide", "name": "Oxide", "about": "...",
//     "light": { "tint": { "hue": 60, "chroma": 0.009 }, "accent": "#5E3420" },
//     "dark":  { "tint": { "hue": 60, "chroma": 0.011 }, "accent": "#C9997A" } }
// tokens.json `skin` names the colours a skin moves. Each `tint` colour keeps its own OKLCH lightness and takes the
// skin's hue and chroma (less chroma towards white and black), so the grey ladder keeps its spacing and contrast.
// `accent` becomes the skin's accent; each `follow-accent` colour keeps its own default lightness, in the new accent's
// hue. `fixed` colours (the instruments' identity colours) never change.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgbOf = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`skins: ${hex} is not #rrggbb`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** #rrggbb to OKLCH { L, C, H }. */
export function hexToOklch(hex) {
  const [r, g, b] = rgbOf(hex).map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** #rrggbb to OKLab [L, a, b]. */
export function hexToOklab(hex) {
  const { L, C, H } = hexToOklch(hex);
  const h = (H * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

/**
 * The velocity fill in a skin, from the default fill the kit writes (any kit version: a hex on the default ramp per
 * theme, --nc-ui-velocity-fill). A fill on that ramp is min + t (max - min) in OKLab, so t follows from its lightness
 * and the skin's fill is the same t on the skin's ramp: each channel is A + B * l. Returns the CSS colour, a relative
 * oklab() over the cell's own fill.
 */
export function velocityRemap(from, to) {
  const [m0, M0] = [hexToOklab(from.min), hexToOklab(from.max)];
  const [m1, M1] = [hexToOklab(to.min), hexToOklab(to.max)];
  const span = M0[0] - m0[0];
  if (Math.abs(span) < 1e-6) throw new Error('skins: the default velocity ramp has no lightness span');
  const n = (x) => +x.toFixed(5);
  const ch = (k) => {
    const B = (M1[k] - m1[k]) / span;
    const A = m1[k] - B * m0[0];
    return `calc(${n(A)} + ${n(B)} * l)`;
  };
  return `oklab(from var(--nc-ui-velocity-fill) ${ch(0)} ${ch(1)} ${ch(2)})`;
}

/** OKLCH { L, C, H } to #RRGGBB (clipped to sRGB). */
export function oklchToHex({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.round(Math.min(1, Math.max(0, gam(Math.max(0, v)))) * 255));
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bb] = rgbOf(hex).map((v) => lin(v / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z][a-z0-9-]{1,23}$/;

/** Read and check every tokens/skins/*.json (the default skin first). */
export function loadSkins(dir) {
  if (!existsSync(dir)) return [];
  const skins = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const where = `tokens/skins/${f}`;
      if (!ID.test(s.id ?? '')) throw new Error(`${where}: id must be lowercase letters, digits and dashes`);
      if (`${s.id}.json` !== f) throw new Error(`${where}: id must match the file name`);
      if (typeof s.name !== 'string' || !s.name.trim()) throw new Error(`${where}: needs a name`);
      if (!s.default) {
        for (const mode of ['light', 'dark']) {
          const m = s[mode];
          if (!m || !HEX.test(m.accent ?? '')) throw new Error(`${where}: ${mode}.accent must be #rrggbb`);
          const t = m.tint ?? {};
          if (!(t.hue >= 0 && t.hue < 360)) throw new Error(`${where}: ${mode}.tint.hue must be 0-360`);
          if (!(t.chroma >= 0 && t.chroma <= 0.03)) throw new Error(`${where}: ${mode}.tint.chroma must be 0-0.03 (a tint, not a colour)`);
        }
      }
      return s;
    });
  const defaults = skins.filter((s) => s.default);
  if (skins.length && defaults.length !== 1) throw new Error('tokens/skins: exactly one skin must be "default": true');
  return [...defaults, ...skins.filter((s) => !s.default)];
}

/** The kit's no-green rule (scripts/lint-ui.mjs): hue 60°-180° (HSV) with any chroma (2/255 or more). */
export function isGreenHex(hex) {
  const [r, g, b] = rgbOf(hex);
  const mx = Math.max(r, g, b), c = mx - Math.min(r, g, b);
  if (c < 2) return false;
  let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h >= 60 && h <= 180;
}

/** A tinted grey that never reads as green: the tint is reduced until the rounded colour clears the rule. */
function tinted(L, C, H) {
  for (let c = C; c > 0.0005; c *= 0.8) {
    const hex = oklchToHex({ L, C: c, H });
    if (!isGreenHex(hex)) return hex;
  }
  return oklchToHex({ L, C: 0, H });
}

/**
 * The base colours a skin sets in one theme: { name: #RRGGBB }. `colors` are that theme's resolved base colours
 * (default skin), `spec` is tokens.json `skin`, `seed` is the skin's light or dark entry.
 */
export function skinColors(colors, spec, seed) {
  const out = {};
  for (const name of spec.tint) {
    const { L } = hexToOklch(colors[name]);
    const fade = Math.min(1, 4 * L * (1 - L) + 0.25); // less tint towards white and black
    out[name] = tinted(L, seed.tint.chroma * fade, seed.tint.hue);
  }
  const a0 = hexToOklch(colors[spec.accent]);
  const a = hexToOklch(seed.accent);
  if (isGreenHex(seed.accent)) throw new Error(`skins: accent ${seed.accent} is green (no green: hue 60-180)`);
  out[spec.accent] = seed.accent.toUpperCase();
  for (const name of spec['follow-accent'] ?? []) {
    const c = hexToOklch(colors[name]);
    // The default companion's own lightness, so what is drawn on it (the step mark on the quietest velocity) keeps
    // the default's contrast; the new accent's hue and relative chroma.
    out[name] = tinted(c.L, a0.C ? a.C * (c.C / a0.C) : a.C, a.H);
  }
  for (const name of spec.fixed ?? []) if (name in out) throw new Error(`skins: ${name} is fixed and also moved`);
  return out;
}

/** A tokens.json source with these base colours swapped in (plain values only), so every ref and mix follows. */
export function withColors(src, colors) {
  const out = structuredClone(src);
  for (const [name, value] of Object.entries(colors)) {
    const t = out.base.color[name];
    if (!t || typeof t.value !== 'string') throw new Error(`skins: base color.${name} must be a plain value`);
    out.base.color[name] = { ...t, value };
  }
  return out;
}

/** The selectors a skin's values apply under, one per theme context (same specificity, later wins). */
export const skinSelectors = (id) => ({
  light: `:root[data-nc-skin="${id}"]:not([data-nc-theme="dark"])`,
  system: `:root[data-nc-skin="${id}"]:not([data-nc-theme="light"])`,
  dark: `:root[data-nc-skin="${id}"][data-nc-theme="dark"]`,
});

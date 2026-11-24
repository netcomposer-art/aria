#!/usr/bin/env node
// lint:ui. The three nc-ui kit rules every module follows, checked on every push (CI) and by `npm run lint`:
// 1. No green anywhere: every colour literal (hex, rgb(), hsl(), oklch(), oklab(), CSS green names) in the kit,
//    its tokens and its build must not be green or green-tinted. Hue 60°–180° with chroma ≥ 2/255 fails; this
//    is Bass's check-green.mjs logic (bass bc19737 scripts/check-green.mjs), plus OKLCH/OKLab.
// 2. No opacity dimming: a disabled, bypassed or silent state dims by colour (text-sub, divider), never by
//    `opacity` or `filter: opacity()`. Only fades between fully hidden and fully shown (0 and 1) are allowed.
// 3. No literal 44px: write var(--nc-ui-target-min). The one exception is that same var's own fallback,
//    var(--nc-ui-target-min, 44px), in self-contained sheets such as confirm.css.
// Also: shared kit code never names another instrument's domain variable (--nc-bass-*, --nc-synth-*, …).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const LIT = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|okl(?:ch|ab)\([^)]*\)/g;
const NAMED = /(?<![\w-])(green|lime|limegreen|lawngreen|chartreuse|olive|olivedrab|darkolivegreen|yellowgreen|greenyellow|forestgreen|seagreen|darkseagreen|lightseagreen|mediumseagreen|springgreen|mediumspringgreen|palegreen|lightgreen|darkgreen|teal|darkcyan|aquamarine|mediumaquamarine|honeydew|mintcream)(?![\w-])/gi;
const SHADOW = /^rgba?\(0[ ,]+0[ ,]+0[ ,/]/;

const hex = (h) => {
  let s = h.slice(1);
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join("");
  if (s.length !== 6 && s.length !== 8) return null;
  return [0, 2, 4].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
};

/** OKLab → sRGB 0..255 (Björn Ottosson's matrices), unclamped. */
function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gamma = (x) => {
    const c = Math.min(1, Math.max(0, x));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  };
  return lin.map(gamma);
}

/** A colour literal → [r, g, b] in 0..255, or null when it is not a colour (or uses var()). */
export function rgbOf(lit) {
  if (lit[0] === "#") return hex(lit);
  if (/var\(|calc\(|from /.test(lit)) return null;
  if (lit.startsWith("okl")) {
    const parts = lit.slice(lit.indexOf("(") + 1, -1).split("/")[0].trim().split(/[\s,]+/);
    if (parts.length < 3) return null;
    const num = (v, pct) => (v.endsWith("%") ? (Number.parseFloat(v) / 100) * pct : Number(v));
    const L = num(parts[0], 1);
    if (lit.startsWith("oklch")) {
      const C = num(parts[1], 0.4);
      const H = (Number.parseFloat(parts[2]) * Math.PI) / 180;
      return oklabToRgb(L, C * Math.cos(H), C * Math.sin(H));
    }
    return oklabToRgb(L, num(parts[1], 0.4), num(parts[2], 0.4));
  }
  const n = lit.match(/[\d.]+%?/g)?.map((v) => (v.endsWith("%") ? Number.parseFloat(v) * 2.55 : Number(v)));
  if (!n || n.length < 3 || n.some(Number.isNaN)) return null;
  if (lit.startsWith("hsl")) {
    const [h, s, l] = [n[0], n[1] / 255, n[2] / 255];
    const a = s * Math.min(l, 1 - l);
    const f = (k) => 255 * (l - a * Math.max(-1, Math.min(((k + h / 30) % 12) - 3, 9 - ((k + h / 30) % 12), 1)));
    return [f(0), f(8), f(4)];
  }
  return n.slice(0, 3);
}

/** Bass's rule: hue 60°–180° with any chroma (≥ 2/255) is green or green-tinted. */
export function isGreen([r, g, b]) {
  const mx = Math.max(r, g, b);
  const c = mx - Math.min(r, g, b);
  if (c < 2) return false;
  let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h >= 60 && h <= 180;
}

/**
 * Identity colours (Peter, 2026-10-29): each instrument's name colour. OLIVE's is olive (#9CA536 dark, #8A9230 light
 * from 2026-11-06), which the green rule would flag. They are allowed as those literals, for the instrument's name
 * only (`instrument-olive`), never for state, controls or fills, which stay non-green.
 */
export const IDENTITY_COLOURS = new Set(["#9ca536", "#8a9230"]);

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Green colour literals and CSS green names (as values) in `text`. */
export function findGreen(text) {
  const out = [];
  for (const m of text.matchAll(LIT)) {
    const rgb = rgbOf(m[0]);
    if (rgb && isGreen(rgb) && !IDENTITY_COLOURS.has(m[0].toLowerCase())) out.push({ rule: "green", line: lineOf(text, m.index), match: m[0] });
  }
  for (const m of text.matchAll(NAMED)) {
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    // A CSS value (`color: green`, `background: lime`) or a JSON token value ("value": "green").
    if (/(?:^|[;{\s"'`])[a-z-]*(?:color|background|fill|stroke|border[a-z-]*|outline[a-z-]*|shadow)\s*:\s*[^;{}]*$/i.test(before) ||
        /"value"\s*:\s*"$/.test(before))
      out.push({ rule: "green", line: lineOf(text, m.index), match: m[0] });
  }
  return out;
}

/** `opacity` (or filter: opacity()) used to dim: any value other than 0 or 1, including a var(). */
export function findOpacityDim(text) {
  const out = [];
  for (const m of text.matchAll(/(?<![\w-])opacity\s*:\s*([^;}\n]+)/g)) {
    const value = m[1].trim().replace(/\s*!important$/, "").replace(/[`"',]+$/, "");
    if (/^(0|1|0?\.0+|1\.0+|0%|100%)$/.test(value)) continue;
    out.push({ rule: "opacity-dim", line: lineOf(text, m.index), match: m[0].trim() });
  }
  for (const m of text.matchAll(/filter\s*:[^;}\n]*\bopacity\(/g))
    out.push({ rule: "opacity-dim", line: lineOf(text, m.index), match: m[0].trim() });
  for (const m of text.matchAll(/\.style\.opacity\s*=/g))
    out.push({ rule: "opacity-dim", line: lineOf(text, m.index), match: m[0].trim() });
  return out;
}

/** A literal 44px, except as the fallback of var(--nc-ui-target-min…, 44px). */
export function findLiteral44(text) {
  const out = [];
  for (const m of text.matchAll(/(?<![\w.-])44px\b/g)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (/var\(--nc-ui-target-min(?:-coarse)?\s*,\s*$/.test(before)) continue;
    out.push({ rule: "literal-44px", line: lineOf(text, m.index), match: m[0] });
  }
  return out;
}

const DOMAINS = ["bass", "synth", "vox", "studio"];
/** Another instrument's domain variable in shared kit code. */
export function findDomainVar(text) {
  const out = [];
  const re = new RegExp(`--nc-(?:${DOMAINS.join("|")})-[\\w-]+`, "g");
  for (const m of text.matchAll(re)) out.push({ rule: "domain-token", line: lineOf(text, m.index), match: m[0] });
  return out;
}

/**
 * Lint one file's text. `kind` picks the checks: "source" (kit code: all four), "tokens" (tokens.json: green),
 * "build" (dist: green, opacity dimming).
 */
export function lintText(text, kind = "source") {
  const findings = [...findGreen(text)];
  if (kind === "source" || kind === "build") findings.push(...findOpacityDim(text));
  if (kind === "source") findings.push(...findLiteral44(text), ...findDomainVar(text));
  return findings;
}

const walk = (dir, ok) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" ? [] : walk(p, ok);
    return ok(p) ? [p] : [];
  });

/** Every file the lint reads in a checkout, with its kind. */
export function targets(root) {
  const isText = (p) => /\.(m?js|css|ts|json|html)$/.test(p);
  return [
    ...walk(join(root, "src"), (p) => isText(p) && !p.endsWith("tokens.ts")).map((p) => [p, "source"]),
    [join(root, "tokens/tokens.json"), "tokens"],
    // Built CSS gets the green and opacity checks; built JS (token tables, the bundle) the green check, since its
    // CSS is the same kit sheet already checked in nc-ui.css and its token tables list the base opacity scale.
    ...walk(join(root, "dist"), isText).map((p) => [p, p.endsWith(".css") && !p.includes("tokens") ? "build" : "tokens"]),
  ];
}

export function lintRepo(root) {
  const errors = [];
  const files = targets(root);
  for (const [file, kind] of files)
    for (const f of lintText(readFileSync(file, "utf8"), kind))
      errors.push(`${relative(root, file)}:${f.line} ${f.rule}: ${f.match}`);
  return { errors, files: files.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const { errors, files } = lintRepo(root);
  if (errors.length) {
    console.error(errors.join("\n"));
    console.error(`lint:ui: ${errors.length} problem(s) in ${files} files`);
    process.exit(1);
  }
  console.log(`lint:ui: ${files} files: no green, no opacity dimming, no literal 44px, no foreign domain tokens`);
}

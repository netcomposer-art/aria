#!/usr/bin/env node
// guard-app: keeps an app's look in nc-ui. An app may lay out its own surfaces with as much CSS as it likes, but it
// may not write a raw colour, font family or pixel size: it reads a token (var(--nc-ui-*)), so a change in nc-ui
// reaches it. Apps start with raw values already in them, so this is a ratchet: a baseline file records each
// file's count, the guard fails when any file's count goes up (or a new file has any), and lowering a count is
// always fine. Rewrite the baseline with --update after removing raw values, so the floor follows.
//
//   node <nc-ui>/scripts/guard-app.mjs <src dir>... --baseline ui-guard.json [--update]
//
// What counts as raw, in .css files and in style strings of .ts/.tsx/.js/.mjs files:
// - a colour literal: #hex, rgb()/rgba(), hsl()/hsla(), oklch()/oklab() (not inside var(--x, fallback));
// - a font-family declaration that names a font instead of a var();
// - a px length in a CSS declaration, except 0, inside var(--x, fallback), and in @media/@container queries
//   (CSS can't read variables there).
// - a Tailwind arbitrary value in a class name: text-[11px], bg-[#003153].
// Not counted: test files, generated files (dist, *.d.ts), and lines marked `ui-guard: allow <reason>`.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|okl(?:ch|ab))\([^)]*\)/g;
const PX = /(?<![\w.-])(?!0px)\d*\.?\d+px\b/g;
// Tailwind arbitrary values in class names: text-[11px], bg-[#003153], w-[3.5px].
const TW = /\[(?:-?\d*\.?\d+px|#[0-9a-fA-F]{3,8})\]/g;
const FONT = /font-family\s*:\s*([^;}\n]+)/gi;
const SKIP_DIR = new Set(["node_modules", "dist", "coverage", "test-results", "playwright-report", "vendor", ".git"]);

/** Blank out var(...) fallbacks, comments and allowed lines, keeping offsets for line numbers. */
function scrub(text) {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
  out = out
    .split("\n")
    .map((line, i) => (/ui-guard:\s*allow\b/.test(text.split("\n")[i] ?? "") ? blank(line) : line))
    .join("\n");
  // var(--x, fallback): the fallback is the token's own value, not a new raw value.
  let prev;
  do {
    prev = out;
    out = out.replace(/var\(\s*--[\w-]+\s*,([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (m, fb) => m.replace(fb, blank(fb)));
  } while (out !== prev);
  // @media / @container preludes may use px.
  out = out.replace(/@(media|container)[^{]*\{/g, blank);
  return out;
}

const isStyleish = (text, index) => {
  // In a script file, only count inside something that looks like CSS: a template/quoted string with a
  // `prop: value` shape, or a style object key (color:, fontFamily:, width: ...).
  const line = text.slice(text.lastIndexOf("\n", index) + 1, text.indexOf("\n", index) === -1 ? undefined : text.indexOf("\n", index));
  return /[a-zA-Z-]+\s*:\s*[^,;]*$/.test(line.slice(0, index - (text.lastIndexOf("\n", index) + 1)));
};

/** Raw values in one file's text. */
export function rawValues(text, file = "x.css") {
  const css = /\.(css|scss)$/.test(file);
  const t = scrub(text);
  const found = [];
  const line = (i) => t.slice(0, i).split("\n").length;
  for (const m of t.matchAll(COLOUR)) if (css || isStyleish(t, m.index)) found.push({ kind: "colour", line: line(m.index), match: m[0] });
  for (const m of t.matchAll(FONT)) if (!/^\s*(var\(|inherit|initial|unset)/.test(m[1])) found.push({ kind: "font", line: line(m.index), match: m[0].trim() });
  for (const m of t.matchAll(PX)) if ((css || isStyleish(t, m.index)) && !/^\[/.test(t[m.index - 1] ?? "")) found.push({ kind: "px", line: line(m.index), match: m[0] });
  if (!css) for (const m of t.matchAll(TW)) found.push({ kind: "tailwind", line: line(m.index), match: m[0] });
  return found;
}

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return SKIP_DIR.has(n) ? [] : walk(p);
    if (!/\.(css|scss|ts|tsx|js|mjs)$/.test(n) || /\.d\.ts$|\.(test|spec)\.[jt]sx?$|\.e2e\.mjs$/.test(n)) return [];
    return [p];
  });

/** Counts per file (relative to root), only files with any. */
export function countApp(root, dirs) {
  const counts = {};
  for (const d of dirs)
    for (const f of walk(resolve(root, d))) {
      const n = rawValues(readFileSync(f, "utf8"), f).length;
      if (n) counts[relative(root, f)] = n;
    }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

/** Files whose count went up against the baseline. */
export function compare(counts, baseline) {
  return Object.entries(counts)
    .filter(([f, n]) => n > (baseline[f] ?? 0))
    .map(([f, n]) => ({ file: f, now: n, was: baseline[f] ?? 0 }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--baseline");
  const baselinePath = at >= 0 ? resolve(args[at + 1]) : "";
  const dirs = args.filter((a, i) => !a.startsWith("--") && i !== at + 1);
  if (!baselinePath || !dirs.length) {
    console.error("usage: guard-app.mjs <src dir>... --baseline ui-guard.json [--update]");
    process.exit(2);
  }
  const root = process.cwd();
  const counts = countApp(root, dirs);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (args.includes("--update") || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, `${JSON.stringify({ _why: "nc-ui guard-app baseline: raw colours, fonts and px per file. Counts may only go down; see nc-ui docs/live.md.", total, files: counts }, null, 2)}\n`);
    console.log(`ui-guard: baseline written, ${total} raw values in ${Object.keys(counts).length} files`);
    process.exit(0);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const worse = compare(counts, baseline.files ?? {});
  if (worse.length) {
    for (const w of worse) {
      console.error(`${w.file}: ${w.now} raw values (baseline ${w.was}). Read a token instead:`);
      for (const r of rawValues(readFileSync(resolve(root, w.file), "utf8"), w.file)) console.error(`  ${w.file}:${r.line} ${r.kind} ${r.match}`);
    }
    console.error(`ui-guard: ${worse.length} file(s) gained raw colours/fonts/px. Use var(--nc-ui-*) (or mark a deliberate one 'ui-guard: allow <reason>').`);
    process.exit(1);
  }
  const was = baseline.total ?? total;
  console.log(`ui-guard: ${total} raw values (baseline ${was})${total < was ? ` — ${was - total} fewer; run with --update to lower the floor` : ""}`);
}

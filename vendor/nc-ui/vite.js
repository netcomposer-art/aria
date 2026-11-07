// Live nc-ui for Vite apps: one stylesheet, served from one place, read by every module.
//
// On netcomposer.art the site serves nc-ui at /nc-ui/ (tools/pull-ui.mjs). Every app links /nc-ui/nc-ui.css, so a
// token or kit change published there reaches Synth, Rhythm, Bass and the Studio on their next page load, with no
// app rebuild. The app still bundles its own copy, but inside the `nc-ui-fallback` cascade layer, which always loses
// to the live (unlayered) sheet: the bundled copy only shows when /nc-ui/ is missing.
//
// Standalone (vite dev / vite preview) the plugin serves /nc-ui/ from this package's dist, so an app looks the same
// on its own as it does on the site.
//
// Fallback on demand (default): the build also emits the matching fallback sheet next to the app's index.html
// (`nc-ui-fallback.css`, inside @layer nc-ui-fallback) and the live <link> loads it only if the live sheet fails.
// A normal visit parses the kit once, not twice; an app should then NOT also import nc-ui.fallback.css.
// `fallback: false` turns this off (an app that bundles its own copy).
//
//   // vite.config.ts
//   import { ncUiLive } from "@netcomposer/nc-ui/vite";
//   export default defineConfig({ plugins: [ncUiLive()] });

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Where the site serves nc-ui. Absolute, so every app on the origin reads the same file. */
export const LIVE_BASE = "/nc-ui/";
/** The cascade layer a bundled copy of nc-ui goes in, so the live sheet always wins. */
export const FALLBACK_LAYER = "nc-ui-fallback";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const TYPES = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };

/** The file a build emits next to index.html, loaded only when the live sheet fails. */
export const FALLBACK_FILE = "nc-ui-fallback.css";

/** The layered fallback for a live sheet: nc-ui.css -> nc-ui.fallback.css, tokens.css -> tokens.fallback.css. */
export function fallbackFor(href) {
  const name = href.slice(href.lastIndexOf("/") + 1);
  return name.replace(/\.css$/, ".fallback.css");
}

/** The onerror handler: add the fallback sheet once. Plain JS, no quotes that need escaping in an attribute. */
export function onErrorScript(url) {
  return `this.onerror=null;var l=document.createElement('link');l.rel='stylesheet';l.href='${url}';l.dataset.ncUiFallback='';document.head.appendChild(l)`;
}

/**
 * @param {{ href?: string, dist?: string, fallback?: boolean }} [options]
 *   href: the live stylesheet (default /nc-ui/nc-ui.css). dist: the folder served at /nc-ui/ in dev and preview.
 *   fallback: emit the fallback sheet and load it only when the live one fails (default true).
 */
export function ncUiLive(options = {}) {
  const href = options.href ?? `${LIVE_BASE}nc-ui.css`;
  const dist = options.dist ?? DIST;
  const withFallback = options.fallback !== false;
  let base = "/";
  let building = false;
  const serve = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? "").split("?")[0];
      if (!url.startsWith(LIVE_BASE)) return next();
      const file = normalize(join(dist, decodeURIComponent(url.slice(LIVE_BASE.length))));
      if (!file.startsWith(dist + sep) || !existsSync(file) || statSync(file).isDirectory()) return next();
      res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
      res.setHeader("cache-control", "no-cache");
      createReadStream(file).pipe(res);
    });
  };
  return {
    name: "nc-ui-live",
    configResolved(config) {
      base = config.base ?? "/";
      building = config.command === "build";
    },
    configureServer: serve,
    configurePreviewServer: serve,
    generateBundle() {
      if (!withFallback) return;
      const file = join(dist, fallbackFor(href));
      if (!existsSync(file)) throw new Error(`nc-ui-live: no fallback sheet ${file} (rebuild nc-ui)`);
      this.emitFile({ type: "asset", fileName: FALLBACK_FILE, source: readFileSync(file, "utf8") });
    },
    transformIndexHtml: {
      order: "post",
      // Last in <head>: after the app's own CSS, where the JS-injected kit used to land, so ties resolve as before.
      handler: () => {
        const attrs = { rel: "stylesheet", href, "data-nc-ui-live": "" };
        if (withFallback && building) attrs.onerror = onErrorScript(`${base}${FALLBACK_FILE}`);
        return [{ tag: "link", attrs, injectTo: "head" }];
      },
    },
  };
}

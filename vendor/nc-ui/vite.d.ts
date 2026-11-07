import type { Plugin } from "vite";

/** Where the site serves nc-ui: `/nc-ui/`. */
export declare const LIVE_BASE: string;
/** The cascade layer a bundled copy of nc-ui goes in (`nc-ui-fallback`), so the live sheet always wins. */
export declare const FALLBACK_LAYER: string;
/** Link the live nc-ui last in <head>, and serve /nc-ui/ from this package's dist in dev and preview. */
/** The file a build emits next to index.html, loaded only when the live sheet fails. */
export declare const FALLBACK_FILE: string;
export declare function fallbackFor(href: string): string;
export declare function onErrorScript(url: string): string;
export declare function ncUiLive(options?: { href?: string; dist?: string; fallback?: boolean }): Plugin;

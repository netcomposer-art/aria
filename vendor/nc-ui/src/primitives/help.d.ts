export declare const HELP_ATTR: "data-nc-help";
export declare const HELP_DELAY: number;
export interface HelpRect { top: number; bottom: number; left: number }
export declare function placeHelp(
  anchor: HelpRect,
  tip: { width: number; height: number },
  viewportWidth: number,
  bandTop?: number,
  gap?: number,
  edge?: number,
): { top: number; left: number; side: "above" | "below" };
export interface HelpTips {
  /** Hide the bubble now. */
  hide(): void;
  /**
   * Show the bubble at `el` without a hover (a one-time hint; touch too): `text`, or else its data-nc-help words. It
   * ignores hovers and goes on any press, any key, a scroll, a blur, hide(), or after `ms` (0 or none: no timeout).
   * Returns whether it showed.
   */
  pin(el: Element, text?: string, opts?: { ms?: number }): boolean;
  /** Remove the listeners and the bubble. */
  uninstall(): void;
}
/** Hover help for every [data-nc-help] element on the page. Idempotent per document. */
export declare function installHelpTips(opts?: { document?: Document; delay?: number }): HelpTips;

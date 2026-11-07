/** The kit's phone breakpoint, "(max-width: 768px)". */
export declare const PAGE_MENU_PHONE: string;
/** The ☰ glyph as inline SVG markup. */
export declare const PAGE_MENU_ICON: string;
export interface PageMenu {
  /** The ☰ button (the one passed in, or a new one to place at the header's right end). */
  button: HTMLButtonElement;
  /** The wrapper around the actions that fold away on phones. */
  panel: HTMLElement;
  open(): void;
  /** Close; the focus goes back to the ☰ when it was in the panel, or when `focus` is true. */
  close(opts?: { focus?: boolean }): void;
  isOpen(): boolean;
  /** Close and remove the listeners. */
  destroy(): void;
}
/**
 * On phones, put a page header's text actions (the `panel`'s children) behind a ☰ button; wider, nothing changes
 * (the panel is `display: contents`). Keep Panic outside the panel so it stays one tap away.
 */
export declare function pageMenu(opts: {
  panel: HTMLElement;
  button?: HTMLButtonElement;
  /** Accessible name of the button. Default "Menu". */
  label?: string;
  /** When the menu applies. Default PAGE_MENU_PHONE. */
  media?: string;
}): PageMenu;

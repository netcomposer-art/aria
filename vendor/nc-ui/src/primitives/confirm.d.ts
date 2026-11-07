export interface ConfirmOptions {
  /** The question, e.g. "Reset Rhythm?". The dialog's accessible name. */
  title: string;
  /** One line saying what happens. The dialog's accessible description. */
  body: string;
  /** More lines under the body, in order; `tone: "danger"` paints one in the danger colour (a warning). They join the
   * accessible description. Default none. */
  lines?: Array<string | { text: string; tone?: "danger" }>;
  /** A third action, a text button above Cancel and the action (e.g. "Save Scene first"): `onAction` runs and the
   * dialog stays open. Tab reaches it before Cancel; Enter on it runs it (never the action). Default none. */
  extra?: { label: string; onAction: () => void };
  /** The action button. Default "Confirm". */
  confirmLabel?: string;
  /** The way out. Default "Cancel". It has focus when the dialog opens. */
  cancelLabel?: string;
  /** Paint the action button with the danger token (a destructive action). Default false. */
  danger?: boolean;
  /** Mount point; its other children are inert while the dialog is open. Default document.body. */
  root?: HTMLElement;
  /** Focused when the dialog closes. Default: whatever had focus when it opened. Pass the opener: Safari on Mac does
   * not focus a clicked button, so without it focus lands on the page. */
  returnFocus?: HTMLElement;
  /** Closes the dialog from code: on abort it resolves false and cleans up exactly like Cancel. Already aborted:
   * resolves false and never opens. */
  signal?: AbortSignal;
}
export interface AskOptions extends ConfirmOptions {
  /** The text field: its label (above it), a starting value, a placeholder, and the input type (default "text"). */
  field?: { label?: string; value?: string; placeholder?: string; type?: "text" | "url" };
}
/**
 * The confirm dialog with one text field (e.g. "Load plugin from URL"). Resolves the text, trimmed, on the action
 * button or Enter in the field; null on Cancel, Escape, the backdrop or an aborted signal. The action is disabled
 * while the field is empty. The field has focus when it opens; Tab moves field, Cancel, action.
 */
/**
 * An in-app confirm dialog (role=alertdialog), never window.confirm. Resolves true only on the confirm button.
 * Cancel, Escape, a backdrop tap, an aborted signal, and a second confirm() while one is open resolve false. One dialog
 * at a time.
 */
export declare function confirm(opts: ConfirmOptions): Promise<boolean>;
/**
 * URL of confirm.css (beside confirm.js). confirm.js links it once per document at import and on each call, so an app
 * needs no kit.js and no nc-ui tokens; every token in it has its current value as a var() fallback.
 */
export declare const confirmCss: string;

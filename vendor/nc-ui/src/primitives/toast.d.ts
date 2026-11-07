export type ToastCloseReason = "timeout" | "action" | "close";
export interface ToastProps {
  /** The one line it says, e.g. "Surprise applied". */
  message: string;
  /** The one action, e.g. "Undo". Omit for a plain message. */
  actionLabel?: string;
  /** Runs on the action; the toast then closes. */
  onAction?: () => void;
  /** ms before it fades out. Default TOAST_DURATION (the toast-duration constant, 5500). */
  duration?: number;
  /** Once, when it starts to fade out. */
  onClose?: (reason: ToastCloseReason) => void;
  /** Elements it must not cover; it moves to the top edge when they sit in the bottom band. */
  avoid?: Array<Element | null | undefined>;
  /** Sit just below this element (left-aligned, scrolls with the page) instead of at a viewport edge. Falls back to the edge if it is off screen. */
  anchor?: Element | null;
  /** Mount point. Default document.body. */
  host?: Element;
  document?: Document;
}
export interface ToastHandle {
  el: HTMLElement;
  /** Fade out now (e.g. on the next edit). Safe to call twice. */
  close(reason?: ToastCloseReason): void;
  /** Resolves when it has left the DOM. */
  closed: Promise<ToastCloseReason>;
}
export declare const TOAST_DURATION: number;
export declare function createToast(props: ToastProps): ToastHandle;
export declare function toastAnnouncement(p: { message: string; actionLabel?: string }): string;
export declare function pickToastPlacement(
  avoid: Array<{ top: number; bottom: number }>,
  viewportHeight: number,
  toastHeight: number,
  offset: number,
): "top" | "bottom";
export declare function anchorToastPosition(
  anchor: { top: number; bottom: number; left: number; right: number },
  avoid: Array<{ top: number; bottom: number; left: number; right: number }>,
  toast: { width: number; height: number },
  viewportWidth: number,
  gap: number,
  edge: number,
): { top: number; left: number };

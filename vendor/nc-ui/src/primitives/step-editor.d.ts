export interface StepEditorProps {
  /** The held step or pad; the editor sits under it (a bottom sheet at phone widths). */
  anchor: Element;
  /** e.g. "Kick · step 5". */
  title: string;
  /** 0..1. */
  velocity: number;
  /** 0..1, 1 is certain. */
  probability: number;
  /** Every slider move. */
  onChange: (next: { velocity: number; probability: number }) => void;
  onClose?: () => void;
  host?: Element;
  document?: Document;
}
export interface StepEditorHandle {
  el: HTMLElement;
  close(): void;
}
export declare function openStepEditor(props: StepEditorProps): StepEditorHandle;
/** "80%" for 0.8. */
export declare function percent(value: number): string;

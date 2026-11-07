export interface SwitchOptions {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Accessible name when there is no visible title to point at. */
  label?: string;
  /** Id of the visible title that names the switch (preferred). */
  labelledBy?: string;
  onText?: string;
  offText?: string;
  id?: string;
  doc?: Document;
}
export interface SwitchHandle {
  readonly el: HTMLButtonElement;
  readonly checked: boolean;
  /** Set the state without calling onChange. */
  set(checked: boolean): void;
  destroy(): void;
}
export function createSwitch(options?: SwitchOptions): SwitchHandle;

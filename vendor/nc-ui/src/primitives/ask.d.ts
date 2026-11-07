import type { AskOptions } from "./confirm.js";
/**
 * The confirm dialog with one text field (e.g. "Load plugin from URL"). Resolves the text, trimmed, on the action
 * button or Enter in the field; null on Cancel, Escape, the backdrop or an aborted signal. The action is disabled
 * while the field is empty. The field has focus when it opens; Tab moves field, Cancel, action.
 */
export declare function ask(opts: AskOptions): Promise<string | null>;

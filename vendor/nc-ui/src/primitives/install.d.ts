/** Inject the kit sheet (kitCss) into the document once. The JS-injected CSS entry: link tokens.css, then call this. */
export function installTheme(doc?: Document): void;
/** The injected sheet's text ("" before installTheme). */
export function installedCss(): string;

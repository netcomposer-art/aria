export type TokenKind = "color" | "family" | "length" | "duration" | "other";
export type TokenTier = "semantic" | "runtime" | "rhythm";

export interface AliasEntry {
  prop: string;
  kind: TokenKind;
  tier: TokenTier;
}

export const tokenAlias: Record<string, AliasEntry>;
export function renamedCssVar(oldVar: string): string;
export function entry(name: string): AliasEntry;
export function prop(name: string): string;
export function v(name: string): string;
export function applyAlias(root: HTMLElement | null | undefined): void;
export function readLive(el: Element, name: string): string;
export function filterPaint(mode: string | undefined): string;
export function readCanvasFont(el: Element): string;

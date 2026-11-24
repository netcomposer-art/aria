import type { themes } from "../dist/tokens.js";
export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";
export declare const THEME_ATTR: "data-nc-theme";
export declare const THEME_EVENT: "nc-ui-theme-change";
export declare const THEME_CHOICES: readonly ThemeChoice[];
export declare const STUDIO_THEME_KEY: "netcomposer.studio.theme.v1";
export declare function normalizeTheme(v: unknown): ThemeChoice;
export declare function themeChoice(doc?: Document): ThemeChoice;
export declare function currentTheme(doc?: Document): Theme;
export declare function applyTheme(choice: ThemeChoice | string | null | undefined, doc?: Document): Theme;
export declare function followHostTheme(win?: Window): ThemeChoice | null;
export declare function onThemeChange(fn: (theme: Theme) => void, doc?: Document): () => void;
export declare function themeTokens(theme?: Theme, skin?: string): (typeof themes)[Theme];
export interface SkinSwatch { paper: string; surf: string; accent: string }
export interface Skin { id: string; name: string; about: string; default?: boolean; swatch: { light: SkinSwatch; dark: SkinSwatch } }
export interface Look { skin?: string; fill?: boolean }
export declare const SKIN_ATTR: "data-nc-skin";
export declare const FILL_ATTR: "data-nc-fill";
export declare const LOOK_EVENT: "nc-ui-look-change";
export declare const SKINS: readonly Skin[];
export declare const DEFAULT_SKIN: string;
export declare const STUDIO_SKIN_KEY: "netcomposer.studio.skin.v1";
export declare const STUDIO_FILL_KEY: "netcomposer.studio.fill.v1";
export declare function normalizeSkin(v: unknown): string;
export declare function currentSkin(doc?: Document): string;
export declare function fillOn(doc?: Document): boolean;
export declare function applyLook(look?: Look, doc?: Document): { skin: string; fill: boolean };

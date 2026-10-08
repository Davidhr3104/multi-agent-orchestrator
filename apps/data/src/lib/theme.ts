export const THEME_STORAGE_KEY = "helix-data-theme";

export type DeskTheme = "dark" | "light";

export function isDeskTheme(v: unknown): v is DeskTheme {
  return v === "dark" || v === "light";
}

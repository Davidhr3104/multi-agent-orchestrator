import type { DeskTheme } from "@/lib/types";

export const THEME_STORAGE_KEY = "helix-inbox-theme";

export function isDeskTheme(v: unknown): v is DeskTheme {
  return v === "dark" || v === "light";
}

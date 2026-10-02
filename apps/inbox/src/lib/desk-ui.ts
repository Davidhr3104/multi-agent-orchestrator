export const FOCUS_KEY = "helix-inbox-focus";
export const DENSE_KEY = "helix-inbox-dense";

export type ConfidenceBand = "high" | "mid" | "low";

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 85) return "high";
  if (score >= 60) return "mid";
  return "low";
}

export function rememberFocus(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) sessionStorage.setItem(FOCUS_KEY, id);
}

export function readFocus(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(FOCUS_KEY);
}

export type DeskWeights = {
  jurisdiction: number;
  margin: number;
  effort: number;
};

export const DEFAULT_WEIGHTS: DeskWeights = {
  jurisdiction: 30,
  margin: 40,
  effort: 30,
};

const KEY = "helix-legal-desk-weights";

export function loadDeskWeights(): DeskWeights {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_WEIGHTS;
    const parsed = JSON.parse(raw) as Partial<DeskWeights>;
    return {
      jurisdiction: clamp(parsed.jurisdiction, DEFAULT_WEIGHTS.jurisdiction),
      margin: clamp(parsed.margin, DEFAULT_WEIGHTS.margin),
      effort: clamp(parsed.effort, DEFAULT_WEIGHTS.effort),
    };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function saveDeskWeights(weights: DeskWeights) {
  window.localStorage.setItem(KEY, JSON.stringify(weights));
}

function clamp(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

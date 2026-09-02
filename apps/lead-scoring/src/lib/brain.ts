export type BrainSettings = {
  addendum: string;
  hitl: number;
};

const DEFAULT: BrainSettings = {
  addendum: "",
  hitl: 0.65,
};

let brain: BrainSettings = { ...DEFAULT };

export function getBrain(): BrainSettings {
  return { ...brain };
}

export function setBrain(patch: Partial<BrainSettings>): BrainSettings {
  const hitl = patch.hitl == null ? brain.hitl : Math.max(0.4, Math.min(0.95, Number(patch.hitl)));
  brain = {
    addendum: patch.addendum != null ? String(patch.addendum) : brain.addendum,
    hitl: Number.isFinite(hitl) ? hitl : brain.hitl,
  };
  return getBrain();
}

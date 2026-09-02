"use client";

const KEY = "helix-leads-brand";
const WS_KEY = "helix-leads-workspaces";
const WS_CUR = "helix-leads-workspace";
const ONBOARD_KEY = "helix-leads-onboarding";

export type BrandPrefs = {
  primary: string;
  logoUrl: string;
  productName: string;
};

export const DEFAULT_BRAND: BrandPrefs = {
  primary: "#38bdf8",
  logoUrl: "",
  productName: "Helix for Leads",
};

export function readBrand(): BrandPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_BRAND, ...JSON.parse(raw) } : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

export function writeBrand(prefs: BrandPrefs) {
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
  applyBrand(prefs);
}

export function applyBrand(prefs: BrandPrefs) {
  document.documentElement.style.setProperty("--helix-primary", prefs.primary);
}

export type Workspace = { id: string; name: string };

export function readWorkspaces(): Workspace[] {
  try {
    const raw = window.localStorage.getItem(WS_KEY);
    if (raw) {
      return (JSON.parse(raw) as Workspace[]).map((w) => ({
        ...w,
        name: w.name.replace(/^Cliente\s+/i, "Client "),
      }));
    }
  } catch {
    /* ignore */
  }
  return [
    { id: "a", name: "Client A" },
    { id: "b", name: "Client B" },
    { id: "c", name: "Client C" },
  ];
}

export function readCurrentWorkspace(): string {
  try {
    return window.localStorage.getItem(WS_CUR) || "a";
  } catch {
    return "a";
  }
}

export function writeCurrentWorkspace(id: string) {
  window.localStorage.setItem(WS_CUR, id);
}

export type OnboardingState = {
  crm: boolean;
  scoring: boolean;
  team: boolean;
};

export function readOnboarding(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(ONBOARD_KEY);
    if (raw) return JSON.parse(raw) as OnboardingState;
  } catch {
    /* ignore */
  }
  return { crm: false, scoring: false, team: false };
}

export function writeOnboarding(state: OnboardingState) {
  window.localStorage.setItem(ONBOARD_KEY, JSON.stringify(state));
}

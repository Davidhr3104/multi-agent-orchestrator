const KEY = "helix.workspace.v1";

export type Workspace = { id: string; name: string };

const DEFAULTS: Workspace[] = [
  { id: "default", name: "Default desk" },
  { id: "demo", name: "Demo seed" },
];

export function listWorkspaces(): Workspace[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(`${KEY}.list`);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Workspace[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function readCurrentWorkspace(): string {
  if (typeof window === "undefined") return "default";
  try {
    return window.localStorage.getItem(KEY) || "default";
  } catch {
    return "default";
  }
}

export function writeCurrentWorkspace(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

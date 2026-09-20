/** `demo` auto-loads catalog samples. Anything else (including unset) starts empty. */
export function autoSeedEnabled(): boolean {
  return (process.env.HELIX_DESK_SEED || "").trim().toLowerCase() === "demo";
}

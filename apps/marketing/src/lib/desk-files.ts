import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Small JSON side files (source status, AI usage, latest waste report) next to the desk data. */
export function marketingDataFile(name: string): string {
  const override = process.env.HELIX_MARKETING_DATA_DIR?.trim();
  if (override) return path.join(override, name);
  if (process.env.VERCEL) return path.join("/tmp", `helix-marketing-${name}`);
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/marketing")) return path.join(cwd, ".data", name);
  return path.join(cwd, "apps", "marketing", ".data", name);
}

export function readJsonFile<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(marketingDataFile(name), "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(name: string, value: unknown): void {
  try {
    const file = marketingDataFile(name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  } catch (err) {
    console.warn(`[helix-marketing] ${name} persist skipped:`, err instanceof Error ? err.message : err);
  }
}

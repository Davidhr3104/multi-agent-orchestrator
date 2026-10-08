import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cellRef(colIndex: number, rowIndex: number): string {
  return `${excelCol(colIndex)}${rowIndex + 2}`;
}

export function excelCol(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function cloneGrid(grid: { headers: string[]; rows: string[][] }): { headers: string[]; rows: string[][] } {
  return {
    headers: [...grid.headers],
    rows: grid.rows.map((r) => [...r]),
  };
}

export function headerKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

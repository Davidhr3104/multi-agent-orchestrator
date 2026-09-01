const STOP = new Set(
  `the a an and or of to in on for with from by as is are was were be been being
   el la los las un una unos unas de del y o a en que se su sus por con para
   es son fue fueron al lo como más mas muy ya no si al this that it at`.split(
    /\s+/
  )
);

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-záéíóúñü]{2,}/gi) ?? [];
}

export function keywords(text: string, limit = 8): string[] {
  const freq = new Map<string, number>();
  for (const w of words(text)) {
    if (w.length < 5 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

export function snippet(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function avgSentenceLength(text: string): number {
  const s = sentences(text);
  if (!s.length) return 0;
  const total = s.reduce((n, x) => n + words(x).length, 0);
  return Math.round((total / s.length) * 10) / 10;
}

export function looksLikeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

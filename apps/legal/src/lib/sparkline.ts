export function last7Buckets<T extends { createdAt: string }>(
  items: T[],
  now: number,
  pred: (item: T) => boolean = () => true
): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const item of items) {
    if (!pred(item)) continue;
    const age = Math.floor((now - new Date(item.createdAt).getTime()) / 86_400_000);
    if (age >= 0 && age < 7) days[6 - age] += 1;
  }
  return days;
}

export function sparkPath(values: number[]): string {
  const n = Math.max(values.length, 2);
  const max = Math.max(...values, 1);
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * 100;
      const y = 26 - (v / max) * 20;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function sparkGold(values: number[], width = 216, height = 54) {
  const n = Math.max(values.length, 2);
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * width;
    const y = height - 8 - (v / max) * (height - 18);
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] ?? { x: width, y: height / 2 };
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return { line, area, last, width, height };
}

export function weekDeltaLabel(thisWeek: number, lastWeek: number): string {
  if (lastWeek === 0 && thisWeek === 0) return "— vs last week";
  if (lastWeek === 0) return "↑ new this week";
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (pct === 0) return "→ 0% vs last week";
  return `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs last week`;
}

export function previous7Count<T extends { createdAt: string }>(
  items: T[],
  now: number,
  pred: (item: T) => boolean = () => true
): number {
  let n = 0;
  for (const item of items) {
    if (!pred(item)) continue;
    const age = Math.floor((now - new Date(item.createdAt).getTime()) / 86_400_000);
    if (age >= 7 && age < 14) n += 1;
  }
  return n;
}

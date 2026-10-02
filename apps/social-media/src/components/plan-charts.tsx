import { PILLAR_LABEL } from "@/lib/format";
import type { Pillar } from "@/lib/types";

const COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#fb7185", "#a78bfa"];

export function PillarDonut({ rows }: { rows: { pillar: Pillar; count: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Planned posts by pillar">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth="16" />
        {rows.map((row, index) => {
          const length = (row.count / total) * c;
          const dash = `${length} ${c - length}`;
          const circle = (
            <circle key={row.pillar} cx="70" cy="70" r={r} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += length;
          return circle;
        })}
        <text x="70" y="74" textAnchor="middle" className="fill-foreground text-sm font-semibold">
          {rows.reduce((sum, row) => sum + row.count, 0)}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {rows.map((row, index) => (
          <li key={row.pillar} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
            <span className="text-foreground">{PILLAR_LABEL[row.pillar]}</span>
            <span className="tabular font-mono text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlannedArea({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 320;
  const h = 96;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * w;
    const y = h - 8 - (value / max) * (h - 16);
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="Planned posts over the next two weeks">
      <polygon points={area} className="fill-primary/20" />
      <polyline points={line} fill="none" className="stroke-primary" strokeWidth="2" />
    </svg>
  );
}

export function PlanHeatmap({ cells }: { cells: { day: string; hour: number; count: number }[] }) {
  const max = Math.max(1, ...cells.map((cell) => cell.count));
  const hours = [...new Set(cells.map((cell) => cell.hour))].sort((a, b) => a - b);
  const days = [...new Set(cells.map((cell) => cell.day))];
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-[10px]">
        <thead>
          <tr>
            <th />
            {hours.map((hour) => (
              <th key={hour} className="px-1 font-normal text-muted-foreground">
                {hour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <th className="pr-2 text-left font-normal text-muted-foreground">{day}</th>
              {hours.map((hour) => {
                const count = cells.find((cell) => cell.day === day && cell.hour === hour)?.count ?? 0;
                const alpha = count === 0 ? 0.08 : 0.2 + (count / max) * 0.8;
                return (
                  <td key={hour}>
                    <span className="grid size-5 place-items-center rounded-sm text-[9px] text-foreground" style={{ background: `rgba(52, 211, 153, ${alpha})` }} title={`${day} ${hour}:00 · ${count} planned`}>
                      {count || ""}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

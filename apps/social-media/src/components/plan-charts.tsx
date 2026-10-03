import type { ReactNode } from "react";
import { AreaChart, Donut } from "@helix/ui";
import { channelLabel, PILLAR_LABEL } from "@/lib/format";
import { formatKey } from "@/lib/tz";
import { PILLAR_COLOR, PILLAR_ORDER } from "@/lib/visuals";
import type { Channel, Pillar } from "@/lib/types";

/** Chart wrappers for planned-calendar data. Nothing here is engagement: every number counts posts or scores. */

export function Source({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-muted-foreground">{children}</p>;
}

export function hourLabel(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
}

export function PillarDonut({ rows, size = 150 }: { rows: { pillar: Pillar; count: number }[]; size?: number }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Donut
      size={size}
      ariaLabel="Planned posts by pillar"
      centerValue={total}
      centerLabel="posts"
      slices={rows.map((row) => ({ label: PILLAR_LABEL[row.pillar], value: row.count, color: PILLAR_COLOR[row.pillar] }))}
    />
  );
}

export function PlannedArea({ days }: { days: { key: string; count: number }[] }) {
  return (
    <AreaChart
      ariaLabel="Posts planned on each of the next 14 days"
      color="#34d399"
      unit=" posts"
      height={170}
      smooth={false}
      points={days.map((day) => ({ label: formatKey(day.key, { month: "short", day: "numeric" }), value: day.count, detail: `${day.count} planned` }))}
    />
  );
}

export function PillarLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Pillar colours">
      {PILLAR_ORDER.map((pillar) => (
        <li key={pillar} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: PILLAR_COLOR[pillar] }} />
          {PILLAR_LABEL[pillar]}
        </li>
      ))}
    </ul>
  );
}

/** One bar per channel, split by pillar. Bar length is the channel's share of the busiest channel. */
export function ChannelPillarBars({ rows }: { rows: { channel: Channel; total: number; byPillar: Record<Pillar, number> }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.channel} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-xs">
            <span className="text-foreground">{channelLabel(row.channel)}</span>
            <span
              role="img"
              aria-label={`${channelLabel(row.channel)}: ${PILLAR_ORDER.filter((p) => row.byPillar[p] > 0)
                .map((p) => `${row.byPillar[p]} ${PILLAR_LABEL[p]}`)
                .join(", ") || "no posts"}`}
              className="flex h-4 overflow-hidden rounded-md bg-muted"
              style={{ width: `${Math.max(row.total ? 6 : 0, (row.total / max) * 100)}%` }}
            >
              {PILLAR_ORDER.filter((p) => row.byPillar[p] > 0).map((p) => (
                <span key={p} title={`${PILLAR_LABEL[p]}: ${row.byPillar[p]}`} style={{ width: `${(row.byPillar[p] / row.total) * 100}%`, background: PILLAR_COLOR[p] }} />
              ))}
            </span>
            <span className="tabular text-right font-mono text-muted-foreground">{row.total}</span>
          </li>
        ))}
      </ul>
      <PillarLegend />
    </div>
  );
}

export function PlanHeatmap({ cells }: { cells: { day: string; hour: number; count: number }[] }) {
  const max = Math.max(1, ...cells.map((cell) => cell.count));
  const hours = [...new Set(cells.map((cell) => cell.hour))].sort((a, b) => a - b);
  const days = [...new Set(cells.map((cell) => cell.day))];
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs" aria-label="Planned posts by weekday and hour">
        <thead>
          <tr>
            <th />
            {hours.map((hour) => (
              <th key={hour} scope="col" className="px-0.5 text-center font-normal text-muted-foreground">
                {hourLabel(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <th scope="row" className="pr-2 text-left font-normal text-muted-foreground">
                {day}
              </th>
              {hours.map((hour) => {
                const count = cells.find((cell) => cell.day === day && cell.hour === hour)?.count ?? 0;
                const alpha = count === 0 ? 0.08 : 0.3 + (count / max) * 0.7;
                return (
                  <td key={hour}>
                    <span
                      className="grid size-7 place-items-center rounded-md text-xs font-semibold text-foreground sm:size-8"
                      style={{ background: `rgba(52, 211, 153, ${alpha})` }}
                      title={`${day} ${hourLabel(hour)}: ${count} planned`}
                    >
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

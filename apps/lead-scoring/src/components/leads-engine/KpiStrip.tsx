"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  ingested: number;
  hotPercent: number;
  median: number;
  hitlPending: number;
};

function KpiValue({ value }: { value: string }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setBump((n) => n + 1);
  }, [value]);
  return (
    <p
      key={bump}
      className={"mt-3 font-mono text-3xl font-bold tracking-tight text-on-surface" + (bump ? " kpi-bump" : "")}
    >
      {value}
    </p>
  );
}

export function KpiStrip({ ingested, hotPercent, median, hitlPending }: Props) {
  const cards = [
    {
      label: "Ingested",
      value: String(ingested),
      hint: "Seed + live contacts",
      icon: "database",
      tone: "primary" as const,
    },
    {
      label: "High Intent",
      value: `${hotPercent}%`,
      hint: "Hot tier share",
      icon: "local_fire_department",
      tone: "tertiary" as const,
    },
    {
      label: "Median Score",
      value: String(median),
      hint: "Across roster",
      icon: "speed",
      tone: "secondary" as const,
    },
    {
      label: "HITL Pending",
      value: String(hitlPending),
      hint: "Needs human review",
      icon: "person_alert",
      tone: hitlPending > 0 ? ("error" as const) : ("outline" as const),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-outline-variant/25 bg-surface-container p-4"
        >
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-bold tracking-[0.14em] text-outline uppercase">{c.label}</p>
            <span
              className={
                c.tone === "tertiary"
                  ? "material-symbols-outlined text-[20px] text-tertiary"
                  : c.tone === "secondary"
                    ? "material-symbols-outlined text-[20px] text-secondary"
                    : c.tone === "error"
                      ? "material-symbols-outlined text-[20px] text-error"
                      : c.tone === "outline"
                        ? "material-symbols-outlined text-[20px] text-outline"
                        : "material-symbols-outlined text-[20px] text-primary"
              }
            >
              {c.icon}
            </span>
          </div>
          <KpiValue value={c.value} />
          <p className="mt-1 text-xs text-on-surface-variant">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}

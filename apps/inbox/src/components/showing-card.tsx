"use client";

import { useMemo, useState } from "react";
import type { InboxMessage } from "@/lib/types";
import { planShowing } from "@/lib/showing-schedule";

export function ShowingCard({
  thread,
  onUseDraft,
}: {
  thread: InboxMessage;
  onUseDraft: (draft: string) => void;
}) {
  const plan = useMemo(
    () => planShowing({ fromName: thread.fromName, subject: thread.subject, body: thread.body }),
    [thread.fromName, thread.subject, thread.body]
  );
  const [copied, setCopied] = useState(false);
  if (!plan) return null;

  const statusLabel = {
    offer: "Horarios libres",
    confirm: "Horario libre",
    conflict: "Choque de agenda",
    book: "Listo para agendar",
  }[plan.status];

  return (
    <section className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">Visita</p>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{plan.channel}</span>
        <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">{statusLabel}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{plan.property.name}</p>
      <p className="text-[11px] text-muted-foreground">{plan.property.address}</p>
      <p className="mt-2 text-xs text-foreground/80">{plan.summary}</p>
      {plan.slots.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {plan.slots.map((slot) => (
            <li key={slot.start} className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-foreground">
              {slot.label}
              {slot.zoneFit ? " · misma zona" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 rounded-md border border-border bg-surface-muted p-2 text-[11px] leading-relaxed text-foreground">{plan.draft}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
          onClick={() => onUseDraft(plan.draft)}
        >
          Usar borrador
        </button>
        {plan.event ? (
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(JSON.stringify(plan.event, null, 2)).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? "Evento copiado" : "Copiar evento"}
          </button>
        ) : null}
      </div>
      {plan.event ? (
        <pre className="mt-2 max-h-36 overflow-auto rounded-md border border-border bg-surface p-2 text-[10px] leading-relaxed text-muted-foreground">
          {JSON.stringify(plan.event, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

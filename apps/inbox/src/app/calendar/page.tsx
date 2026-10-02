"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgendaMeeting } from "@/lib/showing-schedule";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "helix-inbox-integration-tokens";
const TZ = "America/Mexico_City";
const HOUR_START = 8;
const HOUR_END = 19;

type Payload = {
  events?: AgendaMeeting[];
  calendly?: { connected: boolean; name: string | null; schedulingUrl: string | null; error: string | null };
};

type View = "month" | "week";

function readToken(): string {
  try {
    return (JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "{}") as { calendly?: string }).calendly ?? "";
  } catch {
    return "";
  }
}

function saveToken(value: string) {
  let current: Record<string, string> = {};
  try {
    current = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    current = {};
  }
  current.calendly = value;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(current));
}

function mxParts(date: Date) {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    min: Number(map.minute),
  };
}

function mxDay(y: number, m: number, d: number, h = 12): Date {
  return new Date(Date.UTC(y, m - 1, d, h + 6, 0));
}

function dayId(date: Date): string {
  const p = mxParts(date);
  return `${p.y}-${p.m}-${p.d}`;
}

function shiftMonth(date: Date, delta: number): Date {
  const p = mxParts(date);
  return mxDay(p.y, p.m + delta, 1);
}

function shiftWeek(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 7 * 86_400_000);
}

function mondayOf(date: Date): Date {
  const p = mxParts(date);
  const noon = mxDay(p.y, p.m, p.d);
  const dow = noon.getUTCDay();
  const back = (dow + 6) % 7;
  return new Date(noon.getTime() - back * 86_400_000);
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

function monthTitle(date: Date): string {
  const raw = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: TZ }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const [events, setEvents] = useState<AgendaMeeting[]>([]);
  const [calendly, setCalendly] = useState<Payload["calendly"]>(undefined);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [view, setView] = useState<View>("month");
  const [connectOpen, setConnectOpen] = useState(false);

  async function load(nextToken: string) {
    setLoading(true);
    const res = await fetch("/api/calendar", {
      headers: nextToken ? { Authorization: `Bearer ${nextToken}` } : {},
    });
    const data = (await res.json()) as Payload;
    setEvents(data.events ?? []);
    setCalendly(data.calendly);
    setLoading(false);
  }

  useEffect(() => {
    setCursor(new Date());
    const saved = readToken();
    setToken(saved);
    void load(saved);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaMeeting[]>();
    for (const event of events) {
      const id = dayId(new Date(event.start));
      map.set(id, [...(map.get(id) ?? []), event]);
    }
    return map;
  }, [events]);

  const monthCells = useMemo(() => {
    if (!cursor) return [];
    const p = mxParts(cursor);
    const first = mxDay(p.y, p.m, 1);
    const lead = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(first.getTime() + (index - lead) * 86_400_000));
  }, [cursor]);

  const weekDays = useMemo(() => {
    if (!cursor) return [];
    const start = mondayOf(cursor);
    return Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 86_400_000));
  }, [cursor]);

  const todayId = dayId(new Date());
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{cursor ? monthTitle(cursor) : "Calendario"}</h1>
          <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => setCursor(new Date())}>
            Hoy
          </button>
          <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => cursor && setCursor(view === "month" ? shiftMonth(cursor, -1) : shiftWeek(cursor, -1))} aria-label="Anterior">
            ‹
          </button>
          <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => cursor && setCursor(view === "month" ? shiftMonth(cursor, 1) : shiftWeek(cursor, 1))} aria-label="Siguiente">
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button type="button" className={cn("rounded-md px-3 py-1", view === "month" && "bg-accent text-white")} onClick={() => setView("month")}>
              Mes
            </button>
            <button type="button" className={cn("rounded-md px-3 py-1", view === "week" && "bg-accent text-white")} onClick={() => setView("week")}>
              Semana
            </button>
          </div>
          {calendly?.schedulingUrl ? (
            <a href={calendly.schedulingUrl} target="_blank" rel="noreferrer" className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              Abrir Calendly
            </a>
          ) : (
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-xs" onClick={() => setConnectOpen((open) => !open)}>
              {calendly?.connected ? "Calendly" : "Conectar Calendly"}
            </button>
          )}
        </div>
      </div>

      {connectOpen || calendly?.error ? (
        <form
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveToken(token.trim());
            void load(token.trim());
          }}
        >
          <p className="text-xs text-muted-foreground">{calendly?.error || (calendly?.connected ? `Conectado${calendly.name ? ` como ${calendly.name}` : ""}.` : "Token de Calendly para traer reuniones con su enlace.")}</p>
          <input type="password" value={token} placeholder="Token de Calendly" onChange={(e) => setToken(e.target.value)} className="min-w-[200px] flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs" />
          <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs font-semibold">Conectar</button>
        </form>
      ) : null}

      {loading || !cursor ? (
        <p className="text-sm text-muted-foreground">Cargando calendario…</p>
      ) : view === "month" ? (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((label) => (
              <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </div>
            ))}
          </div>
          <div className="grid min-h-0 grid-cols-7 grid-rows-6">
            {monthCells.map((day) => {
              const p = mxParts(day);
              const inMonth = p.m === mxParts(cursor).m;
              const id = dayId(day);
              const rows = byDay.get(id) ?? [];
              return (
                <div key={id + (inMonth ? "" : "-out")} className={cn("min-h-0 border-t border-r border-border/80 p-1", !inMonth && "bg-surface-muted/40")}>
                  <button type="button" className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-[11px]", id === todayId ? "bg-accent font-semibold text-white" : "text-muted-foreground")} onClick={() => { setCursor(day); setView("week"); }}>
                    {p.d}
                  </button>
                  <div className="space-y-0.5">
                    {rows.slice(0, 3).map((event) => (
                      <a
                        key={event.id}
                        href={event.href}
                        target="_blank"
                        rel="noreferrer"
                        title={`${event.title} · ${event.hrefLabel}`}
                        className={cn(
                          "block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-4",
                          event.source === "calendly"
                            ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                            : "bg-violet-500/20 text-violet-800 dark:text-violet-200"
                        )}
                      >
                        {clock(event.start)} {event.title}
                      </a>
                    ))}
                    {rows.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{rows.length - 3}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-border">
            <div />
            {weekDays.map((day, index) => {
              const p = mxParts(day);
              const id = dayId(day);
              return (
                <div key={id} className="border-l border-border px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{WEEKDAYS[index]}</p>
                  <p className={cn("mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm", id === todayId && "bg-accent font-semibold text-white")}>{p.d}</p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            <div>
              {hours.map((hour) => (
                <div key={hour} className="h-14 border-b border-border/60 pr-2 text-right text-[10px] text-muted-foreground">
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {weekDays.map((day) => {
              const id = dayId(day);
              const rows = byDay.get(id) ?? [];
              return (
                <div key={id} className="relative border-l border-border">
                  {hours.map((hour) => (
                    <div key={hour} className="h-14 border-b border-border/60" />
                  ))}
                  {rows.map((event) => {
                    const start = mxParts(new Date(event.start));
                    const end = mxParts(new Date(event.end));
                    const startHour = start.h + start.min / 60;
                    const endHour = end.h + end.min / 60;
                    const top = ((startHour - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
                    const height = (Math.max(endHour - startHour, 0.5) / (HOUR_END - HOUR_START)) * 100;
                    if (startHour >= HOUR_END || endHour <= HOUR_START) return null;
                    return (
                      <a
                        key={event.id}
                        href={event.href}
                        target="_blank"
                        rel="noreferrer"
                        title={event.location}
                        className={cn(
                          "absolute right-1 left-1 overflow-hidden rounded-md px-1.5 py-1 text-[10px] leading-tight",
                          event.source === "calendly" ? "bg-emerald-500/25 text-emerald-900 dark:text-emerald-100" : "bg-violet-500/25 text-violet-900 dark:text-violet-100"
                        )}
                        style={{ top: `${Math.max(top, 0)}%`, height: `${Math.min(height, 100 - Math.max(top, 0))}%` }}
                      >
                        <span className="font-semibold">{clock(event.start)}</span> {event.title}
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

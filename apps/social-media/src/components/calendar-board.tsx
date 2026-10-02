"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { channelLabel, formatSlot, PILLAR_LABEL, snippet, STATUS_LABEL } from "@/lib/format";
import type { Channel, Pillar, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CalendarCard = {
  id: string;
  caption: string;
  channel: Channel;
  pillar: Pillar;
  status: PostStatus;
  scheduledFor: string;
  mediaUrl?: string;
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_BAR: Record<PostStatus, string> = {
  draft: "border-l-slate-400",
  needs_review: "border-l-amber-400",
  changes: "border-l-rose-400",
  approved: "border-l-emerald-400",
  published: "border-l-violet-400",
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function mondayOf(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
}

function parseCursor(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return startOfDay(new Date());
}

function formatCursor(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(iso: string, day: Date) {
  const when = new Date(iso);
  return dayKey(when) === dayKey(day);
}

export function CalendarBoard({ posts, view, feed, cursor: cursorValue, search }: { posts: CalendarCard[]; view: "month" | "week" | "day" | "grid"; feed: "all" | "instagram" | "tiktok"; cursor?: string; search: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(posts);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    setRows(posts);
  }, [posts]);

  const cursor = parseCursor(cursorValue);
  const today = startOfDay(new Date());
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const visibleDays =
    view === "month" ? Array.from({ length: 42 }, (_, index) => addDays(mondayOf(monthStart), index)) : view === "week" ? Array.from({ length: 7 }, (_, index) => addDays(mondayOf(cursor), index)) : [startOfDay(cursor)];

  const rangeLabel =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? `${visibleDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${visibleDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  function href(next: { view?: "month" | "week" | "day" | "grid"; feed?: "all" | "instagram" | "tiktok"; cursor?: Date }) {
    const params = new URLSearchParams(search);
    const nextView = next.view ?? view;
    const nextFeed = next.feed ?? feed;
    if (nextView === "month") params.delete("view");
    else params.set("view", nextView);
    if (nextView === "grid" && nextFeed !== "all") params.set("feed", nextFeed);
    else params.delete("feed");
    const day = next.cursor ?? cursor;
    const todayKey = formatCursor(startOfDay(new Date()));
    if (formatCursor(day) === todayKey) params.delete("cursor");
    else params.set("cursor", formatCursor(day));
    const qs = params.toString();
    return qs ? `/calendar?${qs}` : "/calendar";
  }

  function shifted(direction: number) {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    else if (view === "week") next.setDate(next.getDate() + direction * 7);
    else next.setDate(next.getDate() + direction);
    return startOfDay(next);
  }

  async function move(id: string, day: Date) {
    const card = rows.find((row) => row.id === id);
    if (!card) return;
    const current = new Date(card.scheduledFor);
    const next = new Date(day);
    next.setHours(current.getHours(), current.getMinutes(), 0, 0);
    if (dayKey(current) === dayKey(next) && current.getHours() === next.getHours() && current.getMinutes() === next.getMinutes()) return;
    const when = next.toISOString();
    const previous = card.scheduledFor;
    setRows((list) => list.map((row) => (row.id === id ? { ...row, scheduledFor: when } : row)));
    try {
      await postJson(`/api/posts/${encodeURIComponent(id)}/schedule`, { when });
      notifyDesk("Moved the post. It kept its time. Nothing was published.");
      router.refresh();
    } catch (err) {
      setRows((list) => list.map((row) => (row.id === id ? { ...row, scheduledFor: previous } : row)));
      notifyDesk(err instanceof Error ? err.message : "Couldn't move the post");
    }
  }

  async function swap(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const source = rows.find((row) => row.id === sourceId);
    const target = rows.find((row) => row.id === targetId);
    if (!source || !target) return;
    setRows((list) => list.map((row) => (row.id === sourceId ? { ...row, scheduledFor: target.scheduledFor } : row.id === targetId ? { ...row, scheduledFor: source.scheduledFor } : row)));
    try {
      await postJson(`/api/posts/${encodeURIComponent(sourceId)}/schedule`, { when: target.scheduledFor });
      await postJson(`/api/posts/${encodeURIComponent(targetId)}/schedule`, { when: source.scheduledFor });
      notifyDesk("Swapped the two slots. The quality score stays the same.");
      router.refresh();
    } catch (err) {
      setRows((list) => list.map((row) => (row.id === sourceId ? { ...row, scheduledFor: source.scheduledFor } : row.id === targetId ? { ...row, scheduledFor: target.scheduledFor } : row)));
      notifyDesk(err instanceof Error ? err.message : "Couldn't reorder the feed");
    }
  }

  const outside = view === "grid" ? [] : rows.filter((row) => !visibleDays.some((day) => sameDay(row.scheduledFor, day)));
  const feedRows = rows.filter((card) => feed === "all" || card.channel === feed).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Calendar view">
          {(
            [
              ["month", "Month"],
              ["week", "Week"],
              ["day", "Day"],
              ["grid", "Grid preview"],
            ] as const
          ).map(([item, label]) => (
            <Link key={item} href={href({ view: item })} aria-current={view === item ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", view === item ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
              {label}
            </Link>
          ))}
        </div>
        {view === "grid" ? (
          <div className="flex gap-2">
            {(
              [
                ["all", "All feeds"],
                ["instagram", "Instagram"],
                ["tiktok", "TikTok"],
              ] as const
            ).map(([item, label]) => (
              <Link key={item} href={href({ view: "grid", feed: item })} aria-current={feed === item ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", feed === item ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                {label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href={href({ cursor: shifted(-1) })} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
              Previous
            </Link>
            <Link href={href({ cursor: today })} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
              Today
            </Link>
            <Link href={href({ cursor: shifted(1) })} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent">
              Next
            </Link>
            <p className="min-w-36 text-sm font-semibold text-foreground">{rangeLabel}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Drag a card onto a day to move it. It keeps its clock time, and the quality score does not change.</p>

      {view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {feedRows.map((card) => (
            <li
              key={card.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain");
                if (sourceId) void swap(sourceId, card.id);
              }}
              className="min-w-0 overflow-hidden rounded-xl border border-border bg-card/80"
            >
              <article
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", card.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className={cn("border-l-4", STATUS_BAR[card.status])}
              >
                {card.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.mediaUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="grid aspect-square place-items-center bg-muted/30 px-3 text-center text-xs text-muted-foreground">{PILLAR_LABEL[card.pillar]}</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">{formatSlot(card.scheduledFor)}</p>
                  <p className="text-xs font-semibold text-foreground">{channelLabel(card.channel)}</p>
                  <p className="line-clamp-3 text-sm text-foreground">{card.caption}</p>
                  <Link href={`/posts/${card.id}`} draggable={false} className="text-xs font-semibold text-primary">
                    Open
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : view === "day" ? (
        <DayAgenda day={visibleDays[0]} rows={rows} over={over} setOver={setOver} move={move} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
          <div className="grid min-w-[680px] grid-cols-7 sm:min-w-0">
            {DOW.map((label) => (
              <div key={label} className="border-b border-border px-2 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {label}
              </div>
            ))}
            {visibleDays.map((day, index) => {
              const key = dayKey(day);
              const list = rows.filter((row) => sameDay(row.scheduledFor, day)).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = dayKey(day) === dayKey(today);
              return (
                <div
                  key={key}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOver(key);
                  }}
                  onDragLeave={() => setOver((value) => (value === key ? null : value))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setOver(null);
                    const id = event.dataTransfer.getData("text/plain");
                    if (id) void move(id, day);
                  }}
                  className={cn("min-h-14 min-w-0 border-b border-border p-1", index % 7 !== 6 && "border-r", !inMonth && view === "month" && "bg-background/50", over === key && "bg-primary/10")}
                >
                  <p className={cn("mb-0.5 text-[11px] font-semibold leading-none", isToday ? "text-primary" : inMonth || view === "week" ? "text-foreground" : "text-muted-foreground/60")}>
                    {day.getDate()}
                    {isToday ? " · Today" : ""}
                  </p>
                  <ul className="space-y-0.5">
                    {list.map((card) => (
                      <li key={card.id}>
                        <Card card={card} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outside.length ? (
        <section className="rounded-xl border border-border bg-card/80 p-4">
          <h2 className="text-sm font-semibold text-foreground">Outside this range</h2>
          <p className="mt-1 text-xs text-muted-foreground">{outside.length} filtered posts sit on other dates. Use Previous or Next to reach them.</p>
          <ul className="mt-3 divide-y divide-border">
            {outside
              .slice()
              .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
              .map((card) => (
                <li key={card.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    {formatSlot(card.scheduledFor)} · {channelLabel(card.channel)} · {snippet(card.caption, 64)}
                  </span>
                  <Link href={`/posts/${card.id}`} className="shrink-0 text-xs font-semibold text-primary">
                    Open
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Card({ card }: { card: CalendarCard }) {
  const time = new Date(card.scheduledFor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      title={`${time} · ${channelLabel(card.channel)} · ${STATUS_LABEL[card.status]} — ${card.caption}`}
      className={cn("flex min-w-0 items-center gap-1 rounded border-l-2 bg-background/80 px-1 py-0.5 text-[10px] leading-none", STATUS_BAR[card.status])}
    >
      <span className="shrink-0 font-semibold text-foreground">{time}</span>
      <Link href={`/posts/${card.id}`} draggable={false} className="min-w-0 truncate text-muted-foreground hover:text-foreground">
        {snippet(card.caption, 22)}
      </Link>
    </article>
  );
}

function DayAgenda({
  day,
  rows,
  over,
  setOver,
  move,
}: {
  day: Date;
  rows: CalendarCard[];
  over: string | null;
  setOver: (value: string | null) => void;
  move: (id: string, day: Date) => Promise<void>;
}) {
  const key = dayKey(day);
  const list = rows.filter((row) => sameDay(row.scheduledFor, day)).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(key);
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(null);
        const id = event.dataTransfer.getData("text/plain");
        if (id) void move(id, day);
      }}
      className={cn("space-y-2 rounded-xl border border-border bg-card/80 p-4", over === key && "bg-primary/10")}
    >
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Nothing planned. Drop a card here to move it onto this day.</p> : null}
      {list.map((card) => (
        <article key={card.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", card.id)} className={cn("grid gap-3 rounded-lg border border-border border-l-4 bg-background/70 p-3 sm:grid-cols-[7rem_1fr_auto]", STATUS_BAR[card.status])}>
          <p className="font-mono text-xs text-muted-foreground">{formatSlot(card.scheduledFor)}</p>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {channelLabel(card.channel)} · {PILLAR_LABEL[card.pillar]} · {STATUS_LABEL[card.status]}
            </p>
            <p className="mt-1 text-sm text-foreground">{card.caption}</p>
          </div>
          <Link href={`/posts/${card.id}`} draggable={false} className="text-xs font-semibold text-primary">
            Open
          </Link>
        </article>
      ))}
    </div>
  );
}

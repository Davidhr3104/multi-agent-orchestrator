"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChannelChip } from "@/components/channel";
import { ChannelPreview } from "@/components/channel-preview";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { PostThumb } from "@/components/post-thumb";
import { channelLabel, formatSlot, PILLAR_LABEL, snippet, STATUS_LABEL } from "@/lib/format";
import { addDaysKey, dayKey, dowOfKey, formatKey, formatTime, pad, parseDayKey, zonedTime, zoneParts } from "@/lib/tz";
import { sampleMedia } from "@/lib/visuals";
import type { Channel, MediaItem, Pillar, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CalendarCard = {
  id: string;
  caption: string;
  channel: Channel;
  pillar: Pillar;
  status: PostStatus;
  scheduledFor: string;
  hashtags: string[];
  mediaUrl?: string;
};

type View = "month" | "week" | "day" | "grid";
type Feed = "all" | "instagram" | "tiktok";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_BAR: Record<PostStatus, string> = {
  draft: "border-l-slate-400",
  needs_review: "border-l-amber-400",
  changes: "border-l-rose-400",
  approved: "border-l-emerald-400",
  published: "border-l-violet-400",
};

/** Every date on this board is a desk-zone day key ("2026-10-03"), so server and browser always agree. */
function mondayOf(key: string) {
  return addDaysKey(key, -((dowOfKey(key) + 6) % 7));
}

function monthStart(key: string) {
  const { year, month } = parseDayKey(key);
  return `${year}-${pad(month)}-01`;
}

function shiftMonth(key: string, direction: number) {
  const { year, month, day } = parseDayKey(key);
  const target = new Date(Date.UTC(year, month - 1 + direction, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}

function validKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function thumbPost(card: CalendarCard) {
  const media: MediaItem[] | undefined = card.mediaUrl ? [{ id: `m-${card.id}`, kind: "image", label: "Attached image", url: card.mediaUrl, source: "upload" }] : undefined;
  return { id: card.id, pillar: card.pillar, channel: card.channel, media };
}

const pill = (active: boolean) =>
  cn("inline-flex min-h-10 items-center rounded-full border px-3.5 text-xs font-semibold md:min-h-9", active ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground");

const navBtn = "inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-accent md:min-h-9";

export function CalendarBoard({
  posts,
  view,
  feed,
  cursor: cursorValue,
  search,
  todayKey,
  brand,
}: {
  posts: CalendarCard[];
  view: View;
  feed: Feed;
  cursor?: string;
  search: string;
  todayKey: string;
  brand: { name: string; handle: string };
}) {
  const router = useRouter();
  const [rows, setRows] = useState(posts);
  const [over, setOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setRows(posts);
  }, [posts]);

  const cursor = validKey(cursorValue) ? cursorValue : todayKey;
  const first = monthStart(cursor);
  const visibleKeys = useMemo(
    () => (view === "month" ? Array.from({ length: 42 }, (_, index) => addDaysKey(mondayOf(first), index)) : view === "week" ? Array.from({ length: 7 }, (_, index) => addDaysKey(mondayOf(cursor), index)) : [cursor]),
    [view, cursor, first]
  );
  const cursorMonth = parseDayKey(cursor).month;

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarCard[]>();
    for (const row of rows) {
      const key = dayKey(row.scheduledFor);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    return map;
  }, [rows]);

  const rangeLabel =
    view === "month"
      ? formatKey(cursor, { month: "long", year: "numeric" })
      : view === "week"
        ? `${formatKey(visibleKeys[0], { month: "short", day: "numeric" })} – ${formatKey(visibleKeys[6], { month: "short", day: "numeric" })}`
        : formatKey(cursor, { weekday: "long", month: "long", day: "numeric" });

  function href(next: { view?: View; feed?: Feed; cursor?: string }) {
    const params = new URLSearchParams(search);
    const nextView = next.view ?? view;
    const nextFeed = next.feed ?? feed;
    if (nextView === "month") params.delete("view");
    else params.set("view", nextView);
    if (nextView === "grid" && nextFeed !== "all") params.set("feed", nextFeed);
    else params.delete("feed");
    const day = next.cursor ?? cursor;
    if (day === todayKey) params.delete("cursor");
    else params.set("cursor", day);
    const qs = params.toString();
    return qs ? `/calendar?${qs}` : "/calendar";
  }

  function shifted(direction: number) {
    if (view === "month") return shiftMonth(cursor, direction);
    return addDaysKey(cursor, view === "week" ? direction * 7 : direction);
  }

  async function move(id: string, key: string) {
    const card = rows.find((row) => row.id === id);
    if (!card) return;
    const current = zoneParts(card.scheduledFor);
    const target = parseDayKey(key);
    if (dayKey(card.scheduledFor) === key) return;
    const when = zonedTime(target.year, target.month, target.day, current.hour, current.minute).toISOString();
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

  const outside = view === "grid" ? [] : rows.filter((row) => !visibleKeys.includes(dayKey(row.scheduledFor)));
  const feedRows = rows.filter((card) => feed === "all" || card.channel === feed).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const picked = feedRows.find((card) => card.id === selected) ?? feedRows[0];
  const agendaKeys = visibleKeys.filter((key) => (byDay.get(key)?.length ?? 0) > 0 && (view !== "month" || parseDayKey(key).month === cursorMonth));

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
            <Link key={item} href={href({ view: item })} aria-current={view === item ? "page" : undefined} className={pill(view === item)}>
              {label}
            </Link>
          ))}
        </div>
        {view === "grid" ? (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All feeds"],
                ["instagram", "Instagram"],
                ["tiktok", "TikTok"],
              ] as const
            ).map(([item, label]) => (
              <Link key={item} href={href({ view: "grid", feed: item })} aria-current={feed === item ? "page" : undefined} className={pill(feed === item)}>
                {label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href({ cursor: shifted(-1) })} className={navBtn}>
              Previous
            </Link>
            <Link href={href({ cursor: todayKey })} className={navBtn}>
              Today
            </Link>
            <Link href={href({ cursor: shifted(1) })} className={navBtn}>
              Next
            </Link>
            <p className="min-w-36 text-sm font-semibold text-foreground">{rangeLabel}</p>
          </div>
        )}
      </div>
      <p className="hidden text-xs text-muted-foreground md:block">Drag a card onto a day to move it. It keeps its clock time, and the quality score does not change. Times are Eastern (ET).</p>
      <p className="text-xs text-muted-foreground md:hidden">Times are Eastern (ET). Open a post to reschedule it.</p>

      {view === "grid" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ul className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Feed grid">
            {feedRows.map((card) => (
              <li
                key={card.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData("text/plain");
                  if (sourceId) void swap(sourceId, card.id);
                }}
                className="min-w-0"
              >
                <article
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", card.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className={cn("relative overflow-hidden rounded-lg border-l-4", STATUS_BAR[card.status], picked?.id === card.id && "ring-2 ring-primary")}
                >
                  <button type="button" aria-pressed={picked?.id === card.id} onClick={() => setSelected(card.id)} className="block w-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <PostThumb post={thumbPost(card)} className="aspect-square w-full rounded-none" />
                    <span className="sr-only">
                      {channelLabel(card.channel)} {formatSlot(card.scheduledFor)}: {snippet(card.caption, 60)}
                    </span>
                  </button>
                  <ChannelChip channel={card.channel} className="pointer-events-none absolute top-1.5 right-1.5 bg-background/85 backdrop-blur" />
                  <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs leading-none text-white">{formatKey(dayKey(card.scheduledFor), { month: "short", day: "numeric" })}</span>
                </article>
              </li>
            ))}
            {feedRows.length === 0 ? <li className="col-span-3 text-sm text-muted-foreground">No posts for this feed.</li> : null}
          </ul>
          {picked ? (
            <aside className="space-y-3 lg:sticky lg:top-4" aria-label="Selected post preview">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {formatSlot(picked.scheduledFor)} ET · {STATUS_LABEL[picked.status]}
                </p>
                <Link href={`/posts/${picked.id}`} className="inline-flex min-h-10 items-center text-xs font-semibold text-primary">
                  Open editor
                </Link>
              </div>
              <ChannelPreview
                channel={picked.channel}
                brand={brand.name}
                handle={brand.handle}
                caption={picked.caption}
                hashtags={picked.hashtags}
                media={picked.mediaUrl ? thumbPost(picked).media?.[0] : sampleMedia(picked)}
                sample={!picked.mediaUrl}
              />
              <p className="text-xs text-muted-foreground">A mock of the destination feed, not the live network. Drag a tile onto another to swap their slots.</p>
            </aside>
          ) : null}
        </div>
      ) : view === "day" ? (
        <DayAgenda dayKeyValue={cursor} list={byDay.get(cursor) ?? []} over={over} setOver={setOver} move={move} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card/80 md:block">
            <div className="grid grid-cols-7">
              {DOW.map((label) => (
                <div key={label} className="border-b border-border px-2 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {label}
                </div>
              ))}
              {visibleKeys.map((key, index) => {
                const list = byDay.get(key) ?? [];
                const inMonth = parseDayKey(key).month === cursorMonth;
                const isToday = key === todayKey;
                const density = Math.min(0.3, list.length * 0.07);
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
                      if (id) void move(id, key);
                    }}
                    style={over === key ? undefined : { backgroundColor: list.length ? `rgba(247, 81, 161, ${density})` : undefined }}
                    className={cn("min-h-24 min-w-0 border-b border-border p-1.5", index % 7 !== 6 && "border-r", !inMonth && view === "month" && "opacity-50", over === key && "bg-primary/20")}
                  >
                    <p className="mb-1 flex items-center justify-between gap-1 text-xs leading-none font-semibold">
                      <span className={cn(isToday ? "rounded bg-primary px-1.5 py-1 text-primary-foreground" : "text-foreground")}>
                        {parseDayKey(key).day}
                        {isToday ? " Today" : ""}
                      </span>
                      {list.length ? <span className="text-muted-foreground">{list.length} {list.length === 1 ? "post" : "posts"}</span> : null}
                    </p>
                    <ul className="space-y-1">
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

          <div className="space-y-4 md:hidden" aria-label="Posts in this range">
            {agendaKeys.length === 0 ? <p className="rounded-xl border border-border bg-card/80 p-4 text-sm text-muted-foreground">Nothing planned in this {view}. Use Previous or Next.</p> : null}
            {agendaKeys.map((key) => (
              <section key={key} aria-label={formatKey(key, { weekday: "long", month: "long", day: "numeric" })}>
                <h3 className={cn("mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase", key === todayKey ? "text-primary" : "text-muted-foreground")}>
                  {formatKey(key, { weekday: "short", month: "short", day: "numeric" })}
                  {key === todayKey ? " · Today" : ""}
                  <span className="rounded-full bg-muted px-2 py-0.5 normal-case tracking-normal">{byDay.get(key)?.length} planned</span>
                </h3>
                <ul className="space-y-2">
                  {(byDay.get(key) ?? []).map((card) => (
                    <li key={card.id}>
                      <AgendaRow card={card} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
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
                  <span className="flex min-w-0 items-center gap-2 text-foreground">
                    <ChannelChip channel={card.channel} />
                    <span className="min-w-0 truncate">
                      {formatSlot(card.scheduledFor)} · {snippet(card.caption, 64)}
                    </span>
                  </span>
                  <Link href={`/posts/${card.id}`} className="inline-flex min-h-10 shrink-0 items-center text-xs font-semibold text-primary">
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
  const time = formatTime(card.scheduledFor);
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      title={`${time} ET · ${channelLabel(card.channel)} · ${STATUS_LABEL[card.status]} — ${card.caption}`}
      className={cn("flex min-w-0 items-center gap-1.5 rounded-md border-l-2 bg-background/85 p-1", STATUS_BAR[card.status])}
    >
      <PostThumb post={thumbPost(card)} showLabel={false} className="size-8 shrink-0 rounded" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs leading-none font-semibold text-foreground">
          <ChannelChip channel={card.channel} className="p-0" />
          {time}
        </span>
        <Link href={`/posts/${card.id}`} draggable={false} className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground">
          {snippet(card.caption, 40)}
        </Link>
      </span>
    </article>
  );
}

function AgendaRow({ card }: { card: CalendarCard }) {
  return (
    <Link href={`/posts/${card.id}`} className={cn("flex min-h-16 items-center gap-3 rounded-xl border border-border border-l-4 bg-card/80 p-2.5", STATUS_BAR[card.status])}>
      <PostThumb post={thumbPost(card)} showLabel={false} className="size-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <ChannelChip channel={card.channel} label />
          {formatTime(card.scheduledFor)} ET
        </span>
        <span className="mt-1 line-clamp-2 block text-sm text-foreground">{card.caption}</span>
        <span className="block text-xs text-muted-foreground">
          {PILLAR_LABEL[card.pillar]} · {STATUS_LABEL[card.status]}
        </span>
      </span>
    </Link>
  );
}

function DayAgenda({
  dayKeyValue,
  list,
  over,
  setOver,
  move,
}: {
  dayKeyValue: string;
  list: CalendarCard[];
  over: string | null;
  setOver: (value: string | null) => void;
  move: (id: string, key: string) => Promise<void>;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(dayKeyValue);
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(null);
        const id = event.dataTransfer.getData("text/plain");
        if (id) void move(id, dayKeyValue);
      }}
      className={cn("space-y-2 rounded-xl border border-border bg-card/80 p-3 sm:p-4", over === dayKeyValue && "bg-primary/10")}
    >
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Nothing planned. Drop a card here to move it onto this day.</p> : null}
      {list.map((card) => (
        <article
          key={card.id}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("text/plain", card.id)}
          className={cn("flex gap-3 rounded-lg border border-border border-l-4 bg-background/70 p-3", STATUS_BAR[card.status])}
        >
          <PostThumb post={thumbPost(card)} className="h-24 w-24 shrink-0 sm:h-28 sm:w-36" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
              <ChannelChip channel={card.channel} label />
              <span className="font-mono text-muted-foreground">{formatSlot(card.scheduledFor)} ET</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {PILLAR_LABEL[card.pillar]} · {STATUS_LABEL[card.status]}
            </p>
            <p className="mt-1 text-sm text-foreground">{card.caption}</p>
            <Link href={`/posts/${card.id}`} draggable={false} className="mt-1 inline-flex min-h-10 items-center text-xs font-semibold text-primary">
              Open
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

"use client";

import type { StoredLead } from "@helix/core";
import { relativeTime } from "./lead-ui";

type FeedItem = {
  id: string;
  ts: string;
  title: string;
  detail: string;
  tone: "ok" | "warn" | "info";
};

type Props = {
  leads: StoredLead[];
  logs: string[];
};

export function WebhookFeed({ leads, logs }: Props) {
  const items: FeedItem[] = [
    ...logs.slice(-6).reverse().map((msg, i) => ({
      id: `log-${i}`,
      ts: new Date().toISOString(),
      title: "Pipeline",
      detail: msg,
      tone: "info" as const,
    })),
    ...[...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((lead) => ({
        id: lead.id,
        ts: lead.createdAt,
        title: lead.classification === "spam" ? "Filtered" : "Scored",
        detail: `${lead.name} · ${lead.score} (${lead.tier}) via ${lead.source}`,
        tone:
          lead.classification === "spam"
            ? ("warn" as const)
            : lead.needsReview
              ? ("warn" as const)
              : ("ok" as const),
      })),
  ].slice(0, 8);

  return (
    <div className="rounded-xl border border-outline-variant/25 bg-surface-container">
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Live Webhook Stream</h3>
          <p className="text-xs text-on-surface-variant">Derived from roster events — not synthetic ARR</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-tertiary uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-tertiary" />
          Live
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-outline">Waiting for ingest…</p>
      ) : (
        <ul className="max-h-80 divide-y divide-outline-variant/15 overflow-y-auto font-mono text-xs">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 px-5 py-3">
              <span
                className={
                  item.tone === "ok"
                    ? "mt-1 size-1.5 shrink-0 rounded-full bg-tertiary"
                    : item.tone === "warn"
                      ? "mt-1 size-1.5 shrink-0 rounded-full bg-error"
                      : "mt-1 size-1.5 shrink-0 rounded-full bg-secondary"
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{item.title}</span>
                  <span className="text-outline">{relativeTime(item.ts)}</span>
                </div>
                <p className="mt-0.5 truncate text-on-surface-variant">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InboxMessage } from "@/lib/types";

export default function InboxAnalyticsPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/messages")
      .then((r) => r.json())
      .then((d: { messages?: InboxMessage[] }) => {
        setMessages(d.messages ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      map.set(m.category, (map.get(m.category) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [messages]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      const day = m.createdAt.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, volume]) => ({ day, volume }));
  }, [messages]);

  const avgConfidence = useMemo(() => {
    if (!messages.length) return 0;
    return Math.round(messages.reduce((s, m) => s + m.aiConfidence, 0) / messages.length);
  }, [messages]);

  const hitlRate = useMemo(() => {
    if (!messages.length) return 0;
    return Math.round((messages.filter((m) => m.needsReview).length / messages.length) * 100);
  }, [messages]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading analytics…</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Volume, category mix, and review load for this desk</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">Threads</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{messages.length}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">Avg AI confidence</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{avgConfidence}%</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">HITL rate</p>
          <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-300">{hitlRate}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-xl p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Volume by day</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay.length ? byDay : [{ day: "—", volume: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="volume" stroke="#6366F1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-panel rounded-xl p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">By category</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory.length ? byCategory : [{ name: "—", count: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

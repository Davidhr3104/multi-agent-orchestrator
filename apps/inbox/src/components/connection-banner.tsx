"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Health = {
  claude: boolean;
  gmailConnected: boolean;
  oauthConfigured: boolean;
};

export function ConnectionBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json())
      .then((d: Health) => setHealth(d))
      .catch(() => setHealth(null));
  }, []);

  if (!health) return null;

  const items: { id: string; text: string; href: string; label: string }[] = [];
  if (!health.claude) {
    items.push({
      id: "claude",
      text: "Claude API key is missing. Drafts are using the local fallback.",
      href: "/settings",
      label: "Add key",
    });
  }
  if (!health.gmailConnected) {
    items.push({
      id: "gmail",
      text: health.oauthConfigured
        ? "Gmail is not connected. The desk is on sample mail."
        : "Gmail OAuth is not configured.",
      href: health.oauthConfigured ? "/api/auth/gmail/start" : "/settings",
      label: health.oauthConfigured ? "Reconnect" : "Open settings",
    });
  }

  const visible = items.filter((item) => !hidden.includes(item.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-1 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2">
      {visible.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
          <span>{item.text}</span>
          <span className="flex items-center gap-2">
            <Link href={item.href} className="rounded-md bg-amber-500 px-2 py-1 font-semibold text-white">
              {item.label}
            </Link>
            <button type="button" className="text-amber-700/80 dark:text-amber-200/80" onClick={() => setHidden((cur) => [...cur, item.id])}>
              Dismiss
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

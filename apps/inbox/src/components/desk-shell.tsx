"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InboxChrome } from "@/components/inbox-chrome";
import type { InboxMessage } from "@/lib/types";

export function DeskShell({
  children,
  initialCounts,
}: {
  children: ReactNode;
  initialCounts?: { queue: number; review: number; routed: number; blocked: number };
}) {
  const pathname = usePathname();
  const [queueCount, setQueueCount] = useState(initialCounts?.queue ?? 0);
  const [reviewCount, setReviewCount] = useState(initialCounts?.review ?? 0);
  const [routedCount, setRoutedCount] = useState(initialCounts?.routed ?? 0);
  const [blockedCount, setBlockedCount] = useState(initialCounts?.blocked ?? 0);

  useEffect(() => {
    void fetch("/api/messages")
      .then((r) => r.json())
      .then((d: { messages?: InboxMessage[] }) => {
        const rows = d.messages ?? [];
        setQueueCount(rows.filter((m) => m.status === "open" || m.status === "review").length);
        setReviewCount(rows.filter((m) => m.needsReview).length);
        setRoutedCount(rows.filter((m) => m.status === "routed").length);
        setBlockedCount(rows.filter((m) => m.status === "blocked" || m.category === "spam").length);
      })
      .catch(() => undefined);
  }, [pathname]);

  return (
    <InboxChrome
      queueCount={queueCount}
      reviewCount={reviewCount}
      routedCount={routedCount}
      blockedCount={blockedCount}
    >
      {children}
    </InboxChrome>
  );
}

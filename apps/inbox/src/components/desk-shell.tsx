"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InboxChrome } from "@/components/inbox-chrome";
import type { InboxMessage } from "@/lib/types";

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queueCount, setQueueCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [routedCount, setRoutedCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

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

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { StoredRfp } from "@helix/core";
import { LegalChrome, LEGAL_HREF, type LegalNavId } from "@/components/legal-chrome";

export function DeskShell({
  children,
  active = "dashboard",
  onNav,
}: {
  children: ReactNode;
  active?: LegalNavId;
  onNav?: (id: LegalNavId) => void;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [deadlineCount, setDeadlineCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => {
        const rfps = d.rfps ?? [];
        const now = Date.now();
        setOpportunityCount(rfps.length);
        setReviewCount(rfps.filter((r) => r.needsReview).length);
        setDeadlineCount(
          rfps.filter((r) => {
            const t = Date.parse(r.deadline);
            if (Number.isNaN(t)) return false;
            const days = (t - now) / 86_400_000;
            return days >= 0 && days <= 14;
          }).length
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/#legal-opportunities");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <LegalChrome
      active={active}
      onNav={(id) => {
        onNav?.(id);
        if (
          id === "analytics" ||
          id === "settings" ||
          id === "audit" ||
          id === "dashboard" ||
          id === "documents" ||
          id === "deadlines" ||
          id === "pricing" ||
          id === "help"
        )
          return;
        if (typeof window !== "undefined" && window.location.pathname !== "/") {
          router.push(LEGAL_HREF[id]);
        }
      }}
      collapsed={collapsed}
      onToggle={() => setCollapsed((v) => !v)}
      opportunityCount={opportunityCount}
      deadlineCount={deadlineCount}
      reviewCount={reviewCount}
      onSearch={() => router.push("/#legal-opportunities")}
    >
      {children}
    </LegalChrome>
  );
}

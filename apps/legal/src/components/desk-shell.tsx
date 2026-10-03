"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StoredRfp } from "@helix/core";
import { AskAiDrawer } from "@/components/ask-ai-drawer";
import { LegalChrome, LEGAL_HREF, type LegalNavId } from "@/components/legal-chrome";
import { deadlineSummary } from "@/lib/desk-metrics";

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
  const pathname = usePathname();
  const dress = pathname !== "/";
  const [collapsed, setCollapsed] = useState(false);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [deadlineCount, setDeadlineCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => {
        const rfps = d.rfps ?? [];
        const now = Date.now();
        setOpportunityCount(rfps.length);
        setReviewCount(rfps.filter((r) => r.needsReview).length);
        const dl = deadlineSummary(rfps, now);
        // One definition: open RFPs due within 14 days, plus open RFPs already past due.
        setDeadlineCount(dl.within14 + dl.pastDue);
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
        setAskQuestion(undefined);
        setAskOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    function onAsk(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      setAskQuestion(detail || undefined);
      setAskOpen(true);
    }
    window.addEventListener("helix-legal-ask", onAsk);
    return () => window.removeEventListener("helix-legal-ask", onAsk);
  }, []);

  return (
    <LegalChrome
      active={active}
      onNav={(id) => {
        onNav?.(id);
        if (
          id === "analytics" ||
          id === "outcomes" ||
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
      onSearch={() => {
        setAskQuestion(undefined);
        setAskOpen(true);
      }}
    >
      <div className={dress ? "legal-pages relative flex min-h-0 flex-1 flex-col" : "contents"}>{children}</div>
      <AskAiDrawer open={askOpen} onOpenChange={setAskOpen} initialQuestion={askQuestion} />
    </LegalChrome>
  );
}

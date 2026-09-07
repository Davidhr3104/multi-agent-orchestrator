"use client";

import Link from "next/link";

const MODULES = [
  {
    title: "RFP Intelligence desk",
    blurb: "Metrics, opportunities table, ingest, client profile.",
    href: "/",
    cta: "Open dashboard",
  },
  {
    title: "Opportunities",
    blurb: "Hot / warm / cold match queue with COI and bid chips.",
    href: "/#legal-opportunities",
    cta: "View opportunities",
  },
  {
    title: "Documents",
    blurb: "Ingested RFP source and proposal drafts.",
    href: "/documents",
    cta: "Open vault",
  },
  {
    title: "Deadlines",
    blurb: "Due windows and calendar export.",
    href: "/deadlines",
    cta: "Open deadlines",
  },
  {
    title: "Smart pricing",
    blurb: "Modeled bids from historical desk pricing.",
    href: "/pricing",
    cta: "Open pricing",
  },
  {
    title: "Analytics",
    blurb: "Win / loss modeled by method.",
    href: "/analytics",
    cta: "Open analytics",
  },
];

export default function IntelligencePage() {
  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1">
        <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Intelligence</h1>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          RFP Intelligence & Document Analysis modules on Helix for Legal.
        </p>
      </div>

      <section className="animate-entrance stagger-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle transition-colors duration-150 hover:border-[#F59E0B]/50"
          >
            <h2 className="text-[13px] font-semibold text-[#F3F4F6]">{mod.title}</h2>
            <p className="mt-2 text-[11px] text-[#9CA3AF]">{mod.blurb}</p>
            <p className="mt-3 text-[11px] font-medium text-[#F59E0B]">{mod.cta} →</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

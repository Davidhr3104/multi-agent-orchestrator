"use client";

import Link from "next/link";

const DESKS = [
  {
    id: "legal",
    lockup: "HELIX FOR LEGAL",
    blurb: "RFP intelligence, COI, pricing, deadlines.",
    href: "/intelligence",
    status: "active" as const,
  },
  {
    id: "leads",
    lockup: "HELIX FOR LEADS",
    blurb: "Inbound lead score, HITL, outreach.",
    href: process.env.NEXT_PUBLIC_HELIX_LEADS_URL || "https://helix-for-leads.vercel.app",
    status: "active" as const,
    external: true,
  },
  {
    id: "inbox",
    lockup: "HELIX FOR INBOX",
    blurb: "Rank, draft, route email — EA triage.",
    href: process.env.NEXT_PUBLIC_HELIX_INBOX_URL || "http://localhost:43151",
    status: "active" as const,
    external: true,
  },
  {
    id: "commerce",
    lockup: "HELIX FOR COMMERCE",
    blurb: "Shopify merchandising — planned.",
    href: "#",
    status: "planned" as const,
  },
  {
    id: "marketing",
    lockup: "HELIX FOR MARKETING",
    blurb: "Campaign desk — backlog.",
    href: "#",
    status: "backlog" as const,
  },
  {
    id: "video",
    lockup: "HELIX FOR VIDEO",
    blurb: "Editorial / VO desk — backlog.",
    href: "#",
    status: "backlog" as const,
  },
];

export default function WorkspacesPage() {
  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1">
        <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Workspaces</h1>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          Helix family desks. Same multi-agent engine — one product per vertical.
        </p>
      </div>

      <section className="animate-entrance stagger-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DESKS.map((desk) => {
          const active = desk.status === "active";
          const card = (
            <div
              className={`rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle transition-colors duration-150 ${
                active ? "hover:border-[#F59E0B]/50" : "opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-[#F3F4F6]">{desk.lockup}</h2>
                <span
                  className={`font-mono-numbers shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] ${
                    desk.status === "active"
                      ? "bg-[#064E3B] text-[#6EE7B7]"
                      : desk.status === "planned"
                        ? "border border-[#F59E0B]/40 text-[#F59E0B]"
                        : "bg-[#1F2937] text-[#6B7280]"
                  }`}
                >
                  {desk.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[#9CA3AF]">{desk.blurb}</p>
              {active ? (
                <p className="mt-3 text-[11px] font-medium text-[#F59E0B]">Open desk →</p>
              ) : (
                <p className="mt-3 text-[11px] text-[#4B5563]">Not armed on this build</p>
              )}
            </div>
          );

          if (!active) return <div key={desk.id}>{card}</div>;
          if ("external" in desk && desk.external) {
            return (
              <a key={desk.id} href={desk.href} target="_blank" rel="noreferrer">
                {card}
              </a>
            );
          }
          return (
            <Link key={desk.id} href={desk.href}>
              {card}
            </Link>
          );
        })}
      </section>
    </main>
  );
}

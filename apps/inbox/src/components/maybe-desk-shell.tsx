"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk-shell";

export function MaybeDeskShell({
  children,
  initialCounts,
}: {
  children: ReactNode;
  initialCounts?: { queue: number; review: number; routed: number; blocked: number };
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/operator")) return <>{children}</>;
  return <DeskShell initialCounts={initialCounts}>{children}</DeskShell>;
}

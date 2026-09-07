"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk-shell";

export function MaybeDeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/operator")) return <>{children}</>;
  return <DeskShell>{children}</DeskShell>;
}

"use client";

import { useRouter } from "next/navigation";
import { AiToast, useAiDeskEvents } from "@/components/ai-desk-events";

/** Refetches the server-rendered page whenever Helix AI, an outreach button or Reset demo changes the desk. Mounted once in the shell. */
export function DeskRefresher() {
  const router = useRouter();
  const { toast, undo } = useAiDeskEvents(() => router.refresh());
  return <AiToast message={toast} undo={undo} />;
}

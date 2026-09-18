import { cookies } from "next/headers";
import { applyDeskPatches, listMessages, wakeSnoozed } from "@/lib/store";
import { applyThreadPatches, readDeskCookie } from "@/lib/desk-state-cookie";
import { isSupabaseConfigured } from "@/lib/supabase-desk";
import type { InboxMessage } from "@/lib/types";

function requestFromCookies(cookieHeader: string): Request {
  return new Request("http://localhost", { headers: { cookie: cookieHeader } });
}

export async function loadDeskMessages(): Promise<{
  messages: InboxMessage[];
  persistence: "memory" | "supabase";
}> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const state = readDeskCookie(requestFromCookies(cookieHeader));
  applyDeskPatches(state.patches);
  await wakeSnoozed();
  const messages = applyThreadPatches(await listMessages(), state.patches);
  return {
    messages,
    persistence: isSupabaseConfigured() ? "supabase" : "memory",
  };
}

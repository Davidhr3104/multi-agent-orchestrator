import { DEFAULT_CHECKLIST, needsFeedback } from "./showings";
import type { Showing } from "./types";

const DAY = 86_400_000;

export type ContactRecency = "recent" | "idle" | "stale";

/** How recently the agent was in touch — the desk has no presence data, so this is the honest stand-in for "online". */
export function contactRecency(lastContactAt: string | undefined, now: number): { level: ContactRecency; label: string } {
  if (!lastContactAt) return { level: "stale", label: "Never contacted" };
  const days = Math.floor((now - Date.parse(lastContactAt)) / DAY);
  if (days <= 7) return { level: "recent", label: days <= 0 ? "Contacted today" : `Contacted ${days} day${days === 1 ? "" : "s"} ago` };
  if (days <= 30) return { level: "idle", label: `Contacted ${days} days ago` };
  return { level: "stale", label: `No contact in ${days} days` };
}

export type ShowingTone = "confirmed" | "unconfirmed" | "feedback" | "completed" | "cancelled";

export const SHOWING_TONE_LABEL: Record<ShowingTone, string> = {
  confirmed: "Confirmed",
  unconfirmed: "Not confirmed",
  feedback: "Waiting for feedback",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** "Confirmed" means the agent ticked "Confirm the time with the buyer" on the visit checklist. */
export function showingTone(s: Showing, now: number): ShowingTone {
  if (s.status === "cancelled") return "cancelled";
  if (s.status === "done" || s.status === "no_show") return "completed";
  if (needsFeedback(s, now)) return "feedback";
  return s.checklist.find((c) => c.label === DEFAULT_CHECKLIST[0])?.done ? "confirmed" : "unconfirmed";
}

/** Digits only, for wa.me and tel: links. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "");

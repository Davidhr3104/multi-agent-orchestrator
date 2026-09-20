import { getPreferences, listAllThreads } from "@/lib/store";
import { summarizeInboxSla } from "@/lib/sla";
import { SlaDesk } from "@/components/sla-desk";

export const dynamic = "force-dynamic";

export default async function SlaPage() {
  const prefs = await getPreferences();
  const threads = await listAllThreads();
  const sla = summarizeInboxSla(threads, { vipSenders: prefs.vipSenders });
  return <SlaDesk initialThreads={threads} initialSla={sla} vipSenders={prefs.vipSenders} />;
}

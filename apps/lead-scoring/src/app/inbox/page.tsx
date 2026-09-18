import { listLeads } from "@/lib/store";
import { LeadsInboxView } from "./inbox-view";

export default async function InboxPage() {
  const leads = (await listLeads()).filter((l) => l.needsReview);
  return <LeadsInboxView initialLeads={leads} />;
}

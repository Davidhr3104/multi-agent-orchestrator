import { listLeads } from "@/lib/store";
import { LeadsRosterView } from "./leads-view";

export default async function LeadsPage() {
  const leads = await listLeads();
  return <LeadsRosterView initialLeads={leads} />;
}

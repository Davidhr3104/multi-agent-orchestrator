import { listLeads } from "@/lib/store";
import { sourceAttribution } from "@helix/core";
import { LeadsAnalyticsView } from "./analytics-view";

export default async function AnalyticsPage() {
  const leads = await listLeads();
  return <LeadsAnalyticsView initialRows={sourceAttribution(leads)} />;
}

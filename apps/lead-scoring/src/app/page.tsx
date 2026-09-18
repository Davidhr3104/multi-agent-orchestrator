import { listLeads } from "@/lib/store";
import { isGhlConfigured } from "@/lib/ghl";
import { roiMetrics, sourceAttribution } from "@helix/core";
import { LeadDashboard } from "@/components/lead-dashboard";

export default async function Home() {
  const leads = await listLeads();
  return (
    <main className="flex-1">
      <LeadDashboard
        initialLeads={leads}
        initialGhlConfigured={isGhlConfigured()}
        initialAttribution={sourceAttribution(leads)}
        initialRoi={roiMetrics(leads)}
      />
    </main>
  );
}

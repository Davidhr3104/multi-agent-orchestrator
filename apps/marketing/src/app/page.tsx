import { EngineShell } from "@/components/engine-shell";
import { MarketingDashboard } from "@/components/marketing-dashboard";

export default function Home() {
  return (
    <EngineShell active="engine">
      <MarketingDashboard />
    </EngineShell>
  );
}

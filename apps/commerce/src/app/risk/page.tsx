import { listOrders } from "@/lib/store";
import { summarizeDeskRisk } from "@helix/core";
import { RiskDesk } from "@/components/risk-desk";
import { RiskHistoryCard } from "@/components/risk-history-card";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const orders = await listOrders();
  const risk = summarizeDeskRisk(orders);
  return (
    <div className="space-y-6">
      <RiskDesk initialOrders={orders} initialRisk={risk} />
      <RiskHistoryCard />
    </div>
  );
}

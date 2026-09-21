import { listOrders } from "@/lib/store";
import { summarizeDeskRisk } from "@helix/core";
import { RiskDesk } from "@/components/risk-desk";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const orders = await listOrders();
  const risk = summarizeDeskRisk(orders);
  return <RiskDesk initialOrders={orders} initialRisk={risk} />;
}

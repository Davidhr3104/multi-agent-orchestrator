import { listInquiries, listOrders } from "@/lib/store";
import { AnalyticsView } from "./analytics-view";

export default async function AnalyticsPage() {
  const [orders, inquiries] = await Promise.all([listOrders(), listInquiries()]);
  return <AnalyticsView initialOrders={orders} initialInquiries={inquiries} />;
}

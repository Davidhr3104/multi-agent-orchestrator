import { listOrders } from "@/lib/store";
import { OrdersView } from "./orders-view";

export default async function OrdersPage() {
  const orders = await listOrders();
  return <OrdersView initialOrders={orders} />;
}

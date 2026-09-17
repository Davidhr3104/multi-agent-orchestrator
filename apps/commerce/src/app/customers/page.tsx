import { listInquiries, listOrders } from "@/lib/store";
import { CustomersView } from "./customers-view";

export default async function CustomersPage() {
  const [orders, inquiries] = await Promise.all([listOrders(), listInquiries()]);
  return <CustomersView initialOrders={orders} initialInquiries={inquiries} />;
}

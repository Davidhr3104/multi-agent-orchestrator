import { listOrders, listProducts } from "@/lib/store";
import { CommerceDashboard } from "@/components/commerce-dashboard";

export default async function Home() {
  const [orders, products] = await Promise.all([listOrders(), listProducts()]);
  return (
    <div className="space-y-6">
      <CommerceDashboard initialOrders={orders} initialProducts={products} />
    </div>
  );
}

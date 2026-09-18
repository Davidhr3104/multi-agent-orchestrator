import { listProducts } from "@/lib/store";
import { InventoryView } from "./inventory-view";

export default async function InventoryPage() {
  const products = await listProducts();
  return <InventoryView initialProducts={products} />;
}

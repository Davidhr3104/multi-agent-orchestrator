import { listProducts } from "@/lib/store";
import { ProductsView } from "./products-view";

export default async function ProductsPage() {
  const products = await listProducts();
  return <ProductsView initialProducts={products} />;
}

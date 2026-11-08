import { MerchantCatalogPanel } from "@/components/merchant/MerchantCatalogPanel";
export function MerchantProductsPanel({ embedded = false }: { embedded?: boolean }) {
  void embedded;
  return <MerchantCatalogPanel kind="products" />;
}
export default function MerchantProductsScreen() { return <MerchantProductsPanel />; }

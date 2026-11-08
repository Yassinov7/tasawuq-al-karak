import { MerchantCatalogPanel } from "@/components/merchant/MerchantCatalogPanel";
export function MerchantOffersPanel({ embedded = false }: { embedded?: boolean }) {
  void embedded;
  return <MerchantCatalogPanel kind="offers" />;
}
export default function MerchantOffersScreen() { return <MerchantOffersPanel />; }

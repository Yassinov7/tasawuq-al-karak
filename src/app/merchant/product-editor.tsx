import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { MerchantAddProduct } from "@/components/merchant/MerchantAddProduct";
import { MerchantEditProduct } from "@/components/merchant/MerchantEditProduct";

export default function MerchantProductEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const productId = Array.isArray(id) ? id[0] : id;
  if (!user) return null;
  return productId
    ? <MerchantEditProduct key={`${user.id}:${productId}`} ownerId={user.id} productId={productId} />
    : <MerchantAddProduct key={user.id} ownerId={user.id} />;
}

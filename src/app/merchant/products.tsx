import { Redirect } from "expo-router";

export default function MerchantProductsScreen() {
  return <Redirect href={{ pathname: "/merchant/catalog", params: { tab: "products" } }} />;
}

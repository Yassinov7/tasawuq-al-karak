import { Redirect } from "expo-router";

export default function MerchantOffersScreen() {
  return <Redirect href={{ pathname: "/merchant/catalog", params: { tab: "offers" } }} />;
}

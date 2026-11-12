import { FinanceScreen } from "@/components/finance/FinanceScreen";
import { MerchantFinanceView } from "@/components/finance/MerchantFinanceView";

export default function MerchantFinance() {
  return <FinanceScreen MerchantView={MerchantFinanceView} />;
}

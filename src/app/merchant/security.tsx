import SecurityScreen from "@/components/account/SecurityScreen";
import { useMerchantWorkspace } from "@/context/MerchantWorkspaceContext";
export default function MerchantPage() { const { headerHeight } = useMerchantWorkspace(); return <SecurityScreen embedded keyboardOffset={headerHeight} />; }

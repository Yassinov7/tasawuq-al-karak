import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

import type { MerchantAvailabilityFilter } from "@/lib/merchant-store";
function useWorkspaceState() {
  const [availability, setAvailability] = useState<MerchantAvailabilityFilter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [headerHeight, setHeaderHeight] = useState(0);
  return useMemo(() => ({ availability, setAvailability, query, setQuery, notice, setNotice, headerHeight, setHeaderHeight }), [availability, query, notice, headerHeight]);
}
const MerchantWorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);
export function MerchantWorkspaceProvider({ children }: PropsWithChildren) {
  return <MerchantWorkspaceContext.Provider value={useWorkspaceState()}>{children}</MerchantWorkspaceContext.Provider>;
}
export function useMerchantWorkspace() {
  const workspace = useContext(MerchantWorkspaceContext);
  if (!workspace) throw new Error("Merchant workspace is unavailable");
  return workspace;
}

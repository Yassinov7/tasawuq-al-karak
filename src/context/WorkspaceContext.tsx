import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type WorkspaceAccess = {
  roles: string[];
  merchantId: string | null;
  merchantApproval: string | null;
  stores: { id: string; name: string; status: string }[];
  driverId: string | null;
  driverApproval: string | null;
  driverActive: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceAccess | null>(null);

export async function getDashboardPath(userId: string): Promise<"/admin" | "/driver" | "/merchant" | "/home"> {
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((row) => row.role as string);
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("driver")) {
    const { data } = await supabase.from("drivers").select("id,approval,is_active").eq("user_id", userId).maybeSingle();
    if (data?.approval === "approved" && data.is_active) return "/driver";
  }
  // Membership is the source of truth for merchant access. Do not gate this
  // lookup on user_roles: older/onboarded accounts can have the membership
  // row while the role row is missing or temporarily unavailable through RLS.
  const { data: memberships } = await supabase
    .from("merchant_members")
    .select("merchant_id,merchants(approval)")
    .eq("user_id", userId);
  if ((memberships ?? []).some((membership) => {
    const merchant = Array.isArray(membership.merchants) ? membership.merchants[0] : membership.merchants;
    return merchant?.approval === "approved";
  })) return "/merchant";

  // Keep applicants in the merchant workspace so they can see the review
  // status instead of silently falling back to the customer home screen.
  if (roles.includes("merchant") || (memberships ?? []).length > 0) return "/merchant";
  return "/home";
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<WorkspaceAccess, "refresh"> & { loadedUserId: string | null }>({ roles: [], merchantId: null, merchantApproval: null, stores: [], driverId: null, driverApproval: null, driverActive: false, loading: true, loadedUserId: null });
  const refresh = useCallback(async () => {
    if (!user) { setState({ roles: [], merchantId: null, merchantApproval: null, stores: [], driverId: null, driverApproval: null, driverActive: false, loading: false, loadedUserId: null }); return; }
    setState((previous) => ({ ...previous, loading: true }));
    const [roleResult, memberResult, driverResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("merchant_members").select("merchant_id,merchants(approval)").eq("user_id", user.id),
      supabase.from("drivers").select("id,approval,is_active").eq("user_id", user.id).maybeSingle(),
    ]);
    const memberships = memberResult.data ?? [];
    const selectedMembership = memberships.find((membership) => {
      const merchant = Array.isArray(membership.merchants) ? membership.merchants[0] : membership.merchants;
      return merchant?.approval === "approved";
    }) ?? memberships[0];
    const merchantId = selectedMembership?.merchant_id ?? null;
    const merchantRelation = Array.isArray(selectedMembership?.merchants) ? selectedMembership.merchants[0] : selectedMembership?.merchants;
    let stores: WorkspaceAccess["stores"] = [];
    if (merchantId) {
      const { data } = await supabase.from("stores").select("id,name,status").eq("merchant_id", merchantId).order("created_at");
      stores = (data ?? []) as WorkspaceAccess["stores"];
    }
    setState({ roles: (roleResult.data ?? []).map((row) => row.role as string), merchantId, merchantApproval: (merchantRelation as { approval?: string } | null)?.approval ?? null, stores, driverId: driverResult.data?.id ?? null, driverApproval: driverResult.data?.approval ?? null, driverActive: driverResult.data?.is_active ?? false, loading: false, loadedUserId: user.id });
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);
  const value = useMemo(() => ({ ...state, loading: !!user && (state.loading || state.loadedUserId !== user.id), refresh }), [refresh, state, user]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() { const value = useContext(WorkspaceContext); if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider"); return value; }

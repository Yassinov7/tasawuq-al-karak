import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type DeliveryZone = { id: string; name: string; regionName: string; fixedFee: number; currency: "SYP" | "USD" };
export type CustomerAddress = { id: string; label: string; recipientName: string; phone: string; address: string; zoneId: string; zone: DeliveryZone | null; isDefault: boolean };
type AddressInput = { label: string; recipientName: string; phone: string; address: string; zoneId: string };
type AddressContextValue = {
  addresses: CustomerAddress[];
  zones: DeliveryZone[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addAddress: (input: AddressInput) => Promise<void>;
  setDefault: (addressId: string) => Promise<void>;
  removeAddress: (addressId: string) => Promise<void>;
};
const AddressContext = createContext<AddressContextValue | null>(null);

export function AddressProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setAddresses([]); setZones([]); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const [addressResult, zoneResult] = await Promise.all([
        supabase.from("customer_addresses").select("id,label,recipient_name,phone,address,zone_id,is_default,delivery_zones(id,name,region_name,fixed_fee,currency)").eq("customer_id", userId).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("delivery_zones").select("id,name,region_name,fixed_fee,currency").eq("is_active", true).order("region_name").order("name"),
      ]);
      if (addressResult.error) throw addressResult.error;
      if (zoneResult.error) throw zoneResult.error;
      type ZoneRow = { id: string; name: string; region_name: string; fixed_fee: number | string; currency: "SYP" | "USD" };
      type AddressRow = { id: string; label: string; recipient_name: string; phone: string; address: string; zone_id: string; is_default: boolean; delivery_zones: ZoneRow | ZoneRow[] | null };
      const zoneFromRow = (row: ZoneRow): DeliveryZone => ({ id: row.id, name: row.name, regionName: row.region_name, fixedFee: Number(row.fixed_fee), currency: row.currency });
      const zoneRows = (zoneResult.data ?? []) as ZoneRow[];
      const addressRows = (addressResult.data ?? []) as AddressRow[];
      setZones(zoneRows.map(zoneFromRow));
      setAddresses(addressRows.map((row) => {
        const joined = Array.isArray(row.delivery_zones) ? row.delivery_zones[0] : row.delivery_zones;
        return { id: row.id, label: row.label, recipientName: row.recipient_name, phone: row.phone, address: row.address, zoneId: row.zone_id, zone: joined ? zoneFromRow(joined) : null, isDefault: row.is_default };
      }));
    } catch {
      setError("تعذر تحميل العناوين ومناطق التوصيل.");
    } finally { setIsLoading(false); }
  }, [userId]);

  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);

  const addAddress = async (input: AddressInput) => {
    if (!userId) throw new Error("سجّل الدخول أولاً");
    const { error: insertError } = await supabase.from("customer_addresses").insert({
      customer_id: userId, label: input.label.trim(), recipient_name: input.recipientName.trim(), phone: input.phone.trim(), address: input.address.trim(), zone_id: input.zoneId, is_default: addresses.length === 0,
    });
    if (insertError) throw insertError;
    await refresh();
  };

  const setDefault = async (addressId: string) => {
    if (!userId) throw new Error("سجّل الدخول أولاً");
    const { error: clearError } = await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", userId);
    if (clearError) throw clearError;
    const { error: updateError } = await supabase.from("customer_addresses").update({ is_default: true }).eq("customer_id", userId).eq("id", addressId);
    if (updateError) throw updateError;
    await refresh();
  };

  const removeAddress = async (addressId: string) => {
    const removed = addresses.find((address) => address.id === addressId);
    const { error: deleteError } = await supabase.from("customer_addresses").delete().eq("id", addressId);
    if (deleteError) throw deleteError;
    if (removed?.isDefault) {
      const remaining = addresses.find((address) => address.id !== addressId);
      if (remaining) await setDefault(remaining.id);
      else await refresh();
    } else await refresh();
  };

  return <AddressContext.Provider value={{ addresses, zones, isLoading, error, refresh, addAddress, setDefault, removeAddress }}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const context = useContext(AddressContext);
  if (!context) throw new Error("useAddresses must be used inside AddressProvider");
  return context;
}

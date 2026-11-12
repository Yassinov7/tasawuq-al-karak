import { recordLiveDiagnostic } from "@/lib/live-diagnostics";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { startLiveUpdates, liveSubscriptionSignature, type LiveState } from "@/lib/live-updates";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
export type LiveSubscription = { table: "catalog_category_revision" | "merchants" | "stores" | "products" | "store_offers" | "merchant_terms" | "order_pricing_current" | "customer_orders" | "store_orders" | "delivery_tasks" | "money_invoices" | "money_allocations" | "money_driver_policies" | "merchant_applications" | "driver_applications" | "notifications"; filter?: string };
type AcceptEvent = (table: LiveSubscription["table"], payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => boolean;
export type LiveOptions = { channelName: string; enabled: boolean; subscriptions: readonly LiveSubscription[]; onChange: () => void | Promise<void>; acceptEvent?: AcceptEvent; sdkManagedRecovery?: boolean };
let instance = 0;
export function useLiveController({ channelName, enabled, subscriptions, onChange, acceptEvent, sdkManagedRecovery }: LiveOptions) {
  const [connection,setConnection]=useState<{scope:string;status:LiveState}>({scope:"",status:"connecting"});
  const callback = useRef(onChange);
  const eventFilter = useRef(acceptEvent);
  useEffect(() => { callback.current = onChange; eventFilter.current = acceptEvent; }, [onChange, acceptEvent]);
  const signature = liveSubscriptionSignature(subscriptions);
  const scope=JSON.stringify([channelName,enabled,signature]);
  const status:LiveState=!enabled||!subscriptions.length?"paused":connection.scope===scope?connection.status:"connecting";
  const start = useCallback(() => {
    if (!enabled) return;
    const entries = JSON.parse(signature) as LiveSubscription[];
    if (!entries.length) return;
    return startLiveUpdates({
      sdkManagedRecovery,
      foreground: AppState.currentState === null || AppState.currentState === "active",
      watchApp: changed => { const listener = AppState.addEventListener("change", value => changed(value === "active")); return () => listener.remove(); },
      refresh: () => callback.current(), status: value => setConnection(previous=>previous.scope===scope&&previous.status===value?previous:{scope,status:value}),
      listen: (event, changed) => {
        let channel = supabase.channel(`${channelName}:${++instance}`);
        for (const item of entries) channel = channel.on("postgres_changes", { event: "*", schema: "public", table: item.table, ...(item.filter ? { filter: item.filter } : {}) }, payload => {
          if (eventFilter.current?.(item.table, payload) !== false) event();
        });
        let attached=true;
        recordLiveDiagnostic(channelName,"CREATED");
        try { channel.subscribe((value,error)=>{if(attached){recordLiveDiagnostic(channelName,value,error);changed(value);}}); }
        catch(error){attached=false;recordLiveDiagnostic(channelName,"CHANNEL_ERROR",error);void supabase.removeChannel(channel);throw error;}
        return () => { attached=false;recordLiveDiagnostic(channelName,"REMOVED"); void supabase.removeChannel(channel); };
      },
    });
  }, [channelName, enabled, sdkManagedRecovery, signature, scope]);
  return { status, start };
}
export function useLiveUpdates(options: LiveOptions) {
  const { status, start } = useLiveController(options);
  useEffect(start, [start]);
  return status;
}

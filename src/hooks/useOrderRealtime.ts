import { useEffect } from "react";

import { supabase } from "@/lib/supabase";

export type OrderRealtimeSubscription = {
  table: "customer_orders" | "store_orders" | "delivery_tasks" | "driver_cash_handover_requests" | "driver_cash_handover_attempts" | "delivery_collection_results" | "driver_wage_policies" | "driver_wage_entitlements" | "driver_cash_receipt_allocations" | "driver_wage_payments" | "merchant_delivery_positions" | "merchant_settlement_documents" | "merchant_settlement_payments" | "c7_merchant_settlement_payments" | "subscription_plan_versions" | "subscription_memberships" | "subscription_account_events" | "subscription_billing_documents" | "subscription_cash_receipts";
  filter?: string;
};

type UseOrderRealtimeOptions = {
  channelName: string;
  enabled: boolean;
  subscriptions: readonly OrderRealtimeSubscription[];
  onChange: () => void;
};

let nextChannelInstance = 0;

/**
 * Refreshes screen data after relevant, RLS-filtered database events.
 * Event payloads are deliberately not used as screen state.
 */
export function useOrderRealtime({
  channelName,
  enabled,
  subscriptions,
  onChange,
}: UseOrderRealtimeOptions) {
  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    let active = true;
    let hasSubscribed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (!active || refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (active) onChange();
      }, 350);
    };

    // A unique instance suffix prevents a remounted screen (including Strict
    // Mode's effect cycle) from reusing a channel that is already subscribed.
    // Supabase only permits postgres_changes handlers before subscribe().
    let channel = supabase.channel(`${channelName}:${++nextChannelInstance}`);
    for (const subscription of subscriptions) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: subscription.table,
          ...(subscription.filter ? { filter: subscription.filter } : {}),
        },
        scheduleRefresh,
      );
    }

    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        if (hasSubscribed) scheduleRefresh();
        hasSubscribed = true;
      }
    });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, onChange, subscriptions]);
}

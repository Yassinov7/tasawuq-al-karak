import { useEffect } from "react";

import { supabase } from "@/lib/supabase";

export type OrderRealtimeSubscription = {
  table: "customer_orders" | "store_orders" | "delivery_tasks";
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

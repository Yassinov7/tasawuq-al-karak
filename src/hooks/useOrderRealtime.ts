import { useFocusEffect } from "expo-router";
import { useLiveController, type LiveOptions, type LiveSubscription } from "@/hooks/useLiveUpdates";
export type OrderRealtimeSubscription = LiveSubscription;
/** Screen-scoped subscription: blur cleanup, focus/resume reconnect and authoritative read. */
export function useOrderRealtime(options: LiveOptions) {
 const {status,start}=useLiveController(options);
 useFocusEffect(start);
 return status;
}

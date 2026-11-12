import { useCallback, useMemo } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { createDriverReadQueue, type DriverReadReason } from "@/lib/driver-read-queue";

export function useDriverTaskRefresh(load: (signal: AbortSignal, reason: DriverReadReason) => Promise<void>, enabled: boolean, shouldRefresh?: () => boolean) {
  const queue = useMemo(() => createDriverReadQueue(load), [load]);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let foreground = AppState.currentState === null || AppState.currentState === "active";
    if (foreground) {
      queue.open();
      if (!shouldRefresh || shouldRefresh()) void queue.request("initial");
    }
    const listener = AppState.addEventListener("change", state => {
      const next = state === "active";
      if (next === foreground) return;
      foreground = next;
      if (next) { queue.open(); if (!shouldRefresh || shouldRefresh()) void queue.request("change"); }
      else queue.close();
    });
    return () => { listener.remove(); queue.close(); };
  }, [enabled, queue, shouldRefresh]));
  return queue.request;
}

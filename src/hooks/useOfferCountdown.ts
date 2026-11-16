import { useEffect, useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { calculateOfferRemaining, formatOfferCountdown } from "@/lib/offer-countdown";

type Listener = () => void;
let clock = Date.now();
let state: AppStateStatus = AppState.currentState;
let timer: ReturnType<typeof setTimeout> | undefined;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
const listeners = new Set<Listener>();
const diagnosed = new Set<string>();

function stopTimer() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}
function publishNow() {
  clock = Date.now();
  listeners.forEach(listener => listener());
}
function schedule() {
  stopTimer();
  if (state !== "active" || listeners.size === 0) return;
  const remainder = clock % 60_000;
  timer = setTimeout(() => { publishNow(); schedule(); }, Math.max(1_000, 60_000 - remainder + 50));
}
function subscribe(listener: Listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    state = AppState.currentState;
    clock = Date.now();
    appStateSubscription = AppState.addEventListener("change", next => {
      state = next;
      if (next === "active") publishNow();
      schedule();
    });
    schedule();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopTimer();
      appStateSubscription?.remove();
      appStateSubscription = undefined;
    }
  };
}
function snapshot() { return clock; }

export function useOfferCountdown(endsAt: string | null | undefined, compact = false, offerId?: string) {
  const now = useSyncExternalStore(subscribe, snapshot, snapshot);
  const remaining = calculateOfferRemaining(endsAt, now);
  useEffect(() => {
    if (!__DEV__ || !offerId) return;
    const reason = !endsAt ? "missing ends_at" : !Number.isFinite(Date.parse(endsAt)) ? "invalid ends_at" : null;
    if (!reason) return;
    const key = `${offerId}:${reason}`;
    if (diagnosed.has(key)) return;
    diagnosed.add(key);
    console.warn(`[offer-countdown] ${reason}; offer=${offerId.slice(0, 8)}`);
  }, [endsAt, offerId]);
  return { ...remaining, label: formatOfferCountdown(remaining, compact) };
}

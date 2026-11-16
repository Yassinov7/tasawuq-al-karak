import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import { appendNotificationPage, notificationCursorFilter, notificationPageSize, reachedNotificationCursor, type NotificationCursor } from "@/lib/notification-inbox";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export type NotificationType = "order" | "offer" | "promotion" | "system";
export type NotificationData = {
  orderId?: string;
  storeOrderId?: string;
  deliveryTaskId?: string;
  productId?: string;
  storeId?: string;
  offerId?: string;
  route?: string;
  applicationId?: string;
  applicationRole?: string;
  invoiceId?: string;
  reference?: string;
  url?: string;
  event?: string;
};
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  read: boolean;
  createdAt: string;
};

type NotificationContextValue = ReturnType<typeof usePushRegistration> & {
  notifications: AppNotification[];
  initialLoading: boolean;
  unreadCount: number;
  syncError: string | null;
  loadingMore: boolean;
  pageError: boolean;
  loadMore: (retry?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Json | null;
  read_at: string | null;
  created_at: string;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

async function readPage(owner: string, cursor?: NotificationCursor) {
  let query = supabase.from("notifications").select("id,type,title,body,data,read_at,created_at")
    .eq("user_id", owner).order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(notificationPageSize + 1);
  if (cursor) query = query.or(notificationCursorFilter(cursor));
  const { data, error } = await query;
  if (error) throw error;
  const page = (data ?? []) as NotificationRow[];
  const rows: AppNotification[] = page.slice(0, notificationPageSize).map(row => ({
    id: row.id, type: row.type, title: row.title, body: row.body,
    data: parseNotificationData(row.data), read: !!row.read_at, createdAt: row.created_at,
  }));
  return { rows, next: page.length > notificationPageSize ? rows.at(-1)! : null };
}

function isAccessError(error: unknown) {
  return !!error && typeof error === "object" && "code" in error &&
    ["PGRST301", "PGRST302", "PGRST303", "42501"].includes(String(error.code));
}

export function parseNotificationData(value: Json | null): NotificationData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const data: NotificationData = {};
  for (const key of ["orderId", "storeOrderId", "deliveryTaskId", "productId", "storeId", "offerId", "route", "url", "invoiceId", "reference", "applicationId", "applicationRole", "event"] as const) {
    const candidate = value[key];
    if (typeof candidate === "string") data[key] = candidate;
  }
  return data;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
 const {user}=useAuth();
 return <OwnedNotifications key={user?.id??"guest"} owner={user?.id}>{children}</OwnedNotifications>;
}
function OwnedNotifications({ children, owner }: { children: ReactNode; owner?: string }) {
  const push = usePushRegistration(owner);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(Boolean(owner));
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  // undefined = first page pending, null = end of list.
  const cursor = useRef<NotificationCursor | null | undefined>(undefined);
  const loadedTail = useRef<NotificationCursor | undefined>(undefined);
  const alive = useRef(true);
  const generation = useRef(0);
  const refreshing = useRef<number | null>(null);
  const paging = useRef(false);

  useEffect(() => {
    alive.current = true;
    const invalidate = () => {
      alive.current = false;
      generation.current++;
      refreshing.current = null;
      paging.current = false;
    };
    return invalidate;
  }, []);

  const refresh = useCallback(async () => {
    if (!owner || !alive.current) return;
    const token = ++generation.current;
    const target = loadedTail.current;
    refreshing.current = token;
    paging.current = false;
    setLoadingMore(false);
    const current = () => alive.current && token === generation.current;
    try {
      const [first, count] = await Promise.all([
        readPage(owner),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", owner).is("read_at", null),
      ]);
      if (!current()) return;
      if (count.error) throw count.error;
      let { rows, next } = first;
      // Revalidate the entire visible range in server pages. New arrivals can
      // shift the first page without replacing or dropping the loaded tail.
      while (target && next && !reachedNotificationCursor(next, target)) {
        const page = await readPage(owner, next);
        if (!current()) return;
        rows = appendNotificationPage(rows, page.rows);
        next = page.next;
      }
      if (target) {
        const boundary = rows.findIndex(row => reachedNotificationCursor(row, target));
        const visibleCount = Math.max(notificationPageSize, boundary + 1);
        if (boundary >= 0 && visibleCount < rows.length) {
          rows = rows.slice(0, visibleCount);
          next = rows.at(-1)!;
        }
      }
      setNotifications(rows);
      loadedTail.current = rows.at(-1);
      cursor.current = next;
      setUnreadCount(count.count ?? 0);
      setSyncError(null);
      setPageError(false);
    } catch (error) {
      if (current()) {
        if (isAccessError(error)) {
          setNotifications([]);
          setUnreadCount(0);
          loadedTail.current = undefined;
          cursor.current = undefined;
          setPageError(false);
        }
        setSyncError("تعذر تحديث الإشعارات.");
      }
      throw error;
    } finally {
      if (current()) {
        refreshing.current = null;
        setInitialLoading(false);
      }
    }
  }, [owner]);

  const loadMore = useCallback(async (retry = false) => {
    const after = cursor.current;
    if (!owner || !after || !alive.current || refreshing.current !== null || paging.current || (pageError && !retry)) return;
    paging.current = true;
    const token = generation.current;
    const current = () => alive.current && token === generation.current;
    setLoadingMore(true);
    setPageError(false);
    try {
      const page = await readPage(owner, after);
      if (!current()) return;
      setNotifications(previous => appendNotificationPage(previous, page.rows));
      loadedTail.current = page.rows.at(-1) ?? loadedTail.current;
      cursor.current = page.next;
    } catch (error) {
      if (current()) {
        if (isAccessError(error)) {
          setNotifications([]);
          setUnreadCount(0);
          loadedTail.current = undefined;
          cursor.current = undefined;
          setSyncError("تعذر تحديث الإشعارات.");
        } else setPageError(true);
      }
    } finally {
      if (current()) {
        paging.current = false;
        setLoadingMore(false);
      }
    }
  }, [owner, pageError]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh().catch(() => undefined), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  useLiveUpdates({ channelName: `notifications:${owner ?? "guest"}`, enabled: !!owner,
    subscriptions: owner ? [{ table: "notifications", filter: `user_id=eq.${owner}` }] : [], onChange: refresh });

  const mutate = useCallback(async (kind: "read" | "readAll" | "remove" | "clear", id?: string) => {
    if (!owner) throw Error("سجّل الدخول لتحديث الإشعارات.");
    const identity = await supabase.auth.getUser();
    if (identity.error || identity.data.user?.id !== owner || !alive.current) throw Error("تغير الحساب؛ أعد فتح الإشعارات.");
    let query = kind === "read" || kind === "readAll"
      ? supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", owner).is("read_at", null)
      : supabase.from("notifications").delete().eq("user_id", owner);
    if (id) query = query.eq("id", id);
    const result = await query;
    if (result.error) {
      if (alive.current) setSyncError("تعذر حفظ تغيير الإشعارات.");
      throw result.error;
    }
    if (!alive.current) return;
    setNotifications(previous => kind === "clear" ? [] : kind === "remove" ? previous.filter(row => row.id !== id)
      : previous.map(row => !id || row.id === id ? { ...row, read: true } : row));
    if (kind === "clear" || kind === "readAll") setUnreadCount(0);
    await refresh().catch(() => undefined);
  }, [owner, refresh]);
  const markAsRead = useCallback(async (id: string) => {
    if (!notifications.find(row => row.id === id)?.read) await mutate("read", id);
  }, [mutate, notifications]);
  const markAllAsRead = useCallback(() => mutate("readAll"), [mutate]);
  const removeNotification = useCallback((id: string) => mutate("remove", id), [mutate]);
  const clearNotifications = useCallback(() => mutate("clear"), [mutate]);
  const value = useMemo(() => ({
    notifications, initialLoading, unreadCount, syncError, loadingMore, pageError, loadMore,
    ...push, refresh, markAsRead, markAllAsRead, removeNotification, clearNotifications,
  }), [notifications, initialLoading, unreadCount, syncError, loadingMore, pageError, loadMore, push, refresh,
    markAsRead, markAllAsRead, removeNotification, clearNotifications]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
export function useNotifications(){const context=useContext(NotificationContext);if(!context)throw Error("useNotifications must be used inside NotificationProvider");return context;}

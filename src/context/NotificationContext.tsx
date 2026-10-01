import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type NotificationType = "order" | "offer" | "promotion" | "system";
export type NotificationData = { orderId?: string; productId?: string; storeId?: string; offerId?: string; url?: string };
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  read: boolean;
  createdAt: string;
  externalPushReady: boolean;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  addNotification: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
};

type NotificationRow = { id: string; type: NotificationType; title: string; body: string; data: NotificationData | null; read_at: string | null; created_at: string };
const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    const { data, error } = await supabase.from("notifications")
      .select("id,type,title,body,data,read_at,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) return;
    setNotifications(((data ?? []) as NotificationRow[]).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data ?? undefined,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
      externalPushReady: false,
    })));
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    if (!user) return () => clearTimeout(timer);
    const channel = supabase.channel(`user-notifications:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [user, refresh]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const markAsRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    void supabase.from("notifications").update({ read_at: readAt }).eq("id", id);
  }, []);
  const markAllAsRead = useCallback(() => {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    if (user) void supabase.from("notifications").update({ read_at: readAt }).eq("user_id", user.id).is("read_at", null);
  }, [user]);
  const removeNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    void supabase.from("notifications").delete().eq("id", id);
  }, []);
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    if (user) void supabase.from("notifications").delete().eq("user_id", user.id);
  }, [user]);
  const addNotification = useCallback((notification: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications((current) => [{ ...notification, id: `local-${Date.now()}`, createdAt: new Date().toISOString(), read: false }, ...current]);
  }, []);

  const value = useMemo(() => ({ notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications, addNotification }), [notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications, addNotification]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}

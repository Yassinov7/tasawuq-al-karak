import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export type NotificationType = "order" | "offer" | "promotion" | "system";
export type NotificationData = {
  orderId?: string;
  storeOrderId?: string;
  productId?: string;
  storeId?: string;
  offerId?: string;
  url?: string;
};
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
  syncError: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  addNotification: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
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

function parseNotificationData(value: Json | null): NotificationData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const data: NotificationData = {};
  for (const key of ["orderId", "storeOrderId", "productId", "storeId", "offerId", "url"] as const) {
    const candidate = value[key];
    if (typeof candidate === "string") data[key] = candidate;
  }
  return data;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تعذر تحديث الإشعارات.";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setSyncError(null);
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,data,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setSyncError(getErrorMessage(error));
      throw error;
    }
    setNotifications(((data ?? []) as NotificationRow[]).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: parseNotificationData(row.data),
      read: Boolean(row.read_at),
      createdAt: row.created_at,
      externalPushReady: false,
    })));
    setSyncError(null);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh().catch(() => undefined);
    }, 0);
    if (!user) return () => clearTimeout(timer);
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void refresh().catch(() => undefined),
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const markAsRead = useCallback(async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.read) return;
    if (id.startsWith("local-")) {
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      return;
    }
    if (!user) throw new Error("سجّل الدخول لتحديث حالة الإشعار.");
    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      setSyncError(getErrorMessage(error));
      throw error;
    }
    if (!data) throw new Error("لم يتم العثور على الإشعار.");
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    setSyncError(null);
  }, [notifications, user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) throw new Error("سجّل الدخول لتحديث حالة الإشعارات.");
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      setSyncError(getErrorMessage(error));
      throw error;
    }
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setSyncError(null);
  }, [user]);

  const removeNotification = useCallback(async (id: string) => {
    if (id.startsWith("local-")) {
      setNotifications((current) => current.filter((item) => item.id !== id));
      return;
    }
    if (!user) throw new Error("سجّل الدخول لحذف الإشعار.");
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    if (error) {
      setSyncError(getErrorMessage(error));
      throw error;
    }
    if (!data?.length) throw new Error("لم يتم العثور على الإشعار.");
    setNotifications((current) => current.filter((item) => item.id !== id));
    setSyncError(null);
  }, [user]);

  const clearNotifications = useCallback(async () => {
    if (!user) throw new Error("سجّل الدخول لحذف الإشعارات.");
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      setSyncError(getErrorMessage(error));
      throw error;
    }
    setNotifications([]);
    setSyncError(null);
  }, [user]);

  const addNotification = useCallback((notification: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications((current) => [{
      ...notification,
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
    }, ...current]);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    syncError,
    refresh,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    addNotification,
  }), [notifications, unreadCount, syncError, refresh, markAsRead, markAllAsRead, removeNotification, clearNotifications, addNotification]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}

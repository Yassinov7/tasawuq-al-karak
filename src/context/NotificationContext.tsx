import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import type { LiveState } from "@/lib/live-updates";
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

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  syncError: string | null;
  liveStatus: LiveState;
  pushMessage:string;pushReady:boolean;pushBusy:boolean;enablePush:()=>Promise<void>;
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

export function parseNotificationData(value: Json | null): NotificationData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const data: NotificationData = {};
  for (const key of ["orderId", "storeOrderId", "deliveryTaskId", "productId", "storeId", "offerId", "route", "url", "invoiceId", "reference", "applicationId", "applicationRole"] as const) {
    const candidate = value[key];
    if (typeof candidate === "string") data[key] = candidate;
  }
  return data;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
 const {user}=useAuth();
 return <OwnedNotifications key={user?.id??"guest"} owner={user?.id}>{children}</OwnedNotifications>;
}
function OwnedNotifications({children,owner}:{children:ReactNode;owner?:string}) {
 const push=usePushRegistration(owner);
 const [notifications,setNotifications]=useState<AppNotification[]>([]);
 const [unreadCount,setUnreadCount]=useState(0);
 const [syncError,setSyncError]=useState<string|null>(null);
 const alive=useRef(true),generation=useRef(0);
 useEffect(()=>{alive.current=true;const invalidate=()=>{alive.current=false;generation.current++;};return invalidate;},[]);
 const refresh=useCallback(async()=>{
  if(!owner)return;
  const token=++generation.current;
  const [list,count]=await Promise.all([
   supabase.from("notifications").select("id,type,title,body,data,read_at,created_at").eq("user_id",owner).order("created_at",{ascending:false}).limit(100),
   supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",owner).is("read_at",null),
  ]);
  if(!alive.current||token!==generation.current)return;
  const error=list.error??count.error;
  if(error){if(["PGRST301","PGRST302","PGRST303","42501"].includes(error.code??"")){setNotifications([]);setUnreadCount(0);}setSyncError("تعذر تحديث الإشعارات؛ المعروض آخر بيانات متاحة.");throw error;}
  setNotifications(((list.data??[]) as NotificationRow[]).map(row=>({id:row.id,type:row.type,title:row.title,body:row.body,data:parseNotificationData(row.data),read:!!row.read_at,createdAt:row.created_at})));
  setUnreadCount(count.count??0);setSyncError(null);
 },[owner]);
 useEffect(()=>{const timer=setTimeout(()=>void refresh().catch(()=>undefined),0);return()=>clearTimeout(timer);},[refresh]);
 const liveStatus=useLiveUpdates({channelName:`notifications:${owner??"guest"}`,enabled:!!owner,subscriptions:owner?[{table:"notifications",filter:`user_id=eq.${owner}`}]:[],onChange:refresh});
 const mutate=useCallback(async(kind:"read"|"readAll"|"remove"|"clear",id?:string)=>{
  if(!owner)throw Error("سجّل الدخول لتحديث الإشعارات.");
  const identity=await supabase.auth.getUser();
  if(identity.error||identity.data.user?.id!==owner||!alive.current)throw Error("تغير الحساب؛ أعد فتح الإشعارات.");
  generation.current++;
  let query;
  if(kind==="read"||kind==="readAll"){
   query=supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",owner).is("read_at",null);
   if(id)query=query.eq("id",id);
  }else{
   query=supabase.from("notifications").delete().eq("user_id",owner);
   if(id)query=query.eq("id",id);
  }
  const result=await query;
  if(result.error){if(alive.current)setSyncError("تعذر حفظ تغيير الإشعارات.");throw result.error;}
  if(alive.current)await refresh();
 },[owner,refresh]);
 const markAsRead=useCallback(async(id:string)=>{if(notifications.find(n=>n.id===id)?.read)return;await mutate("read",id);},[mutate,notifications]);
 const markAllAsRead=useCallback(()=>mutate("readAll"),[mutate]);
 const removeNotification=useCallback((id:string)=>mutate("remove",id),[mutate]);
 const clearNotifications=useCallback(()=>mutate("clear"),[mutate]);
 const value=useMemo(()=>({notifications,unreadCount,syncError,liveStatus,...push,refresh,markAsRead,markAllAsRead,removeNotification,clearNotifications}),[notifications,unreadCount,syncError,liveStatus,push,refresh,markAsRead,markAllAsRead,removeNotification,clearNotifications]);
 return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
export function useNotifications(){const context=useContext(NotificationContext);if(!context)throw Error("useNotifications must be used inside NotificationProvider");return context;}

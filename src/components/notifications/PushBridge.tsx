import { useEffect } from "react";
import { useRouter } from "expo-router";
import { AppState } from "react-native";
import { useAppDialog } from "@/context/AppDialogContext";
import { NotificationOpenError,openOwnedNotification } from "@/lib/notification-opening";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { pushUnavailableReason } from "@/lib/push-device";

/** Native payload contains only an opaque notification ID; destination and role come from an owned DB row. */
export function PushBridge() {
 const {user}=useAuth(),router=useRouter(),{alert}=useAppDialog();
 const {refresh,unreadCount}=useNotifications();
 useEffect(()=>{let active=true;if(!pushUnavailableReason())void import("expo-notifications").then(n=>{if(active)return n.setBadgeCountAsync(unreadCount);}).catch(()=>undefined);return()=>{active=false;};},[unreadCount]);
 useEffect(()=>{
  if(!user||pushUnavailableReason())return;
  let active=true;const opening=new Set<string>(),handled=new Set<string>();const stops:(()=>void)[]=[];
  void import("expo-notifications").then(n=>{
   if(!active)return;
   // Foreground updates are shown through the in-app list, avoiding duplicate banners.
   n.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:false})});
   const open=async(response:import("expo-notifications").NotificationResponse)=>{
    const id=response.notification.request.content.data?.notificationId;
    if(typeof id!=="string"||opening.has(id)||handled.has(id)||!active)return;
    opening.add(id);
    const clear=()=>{if(n.getLastNotificationResponse()?.notification.request.content.data?.notificationId===id)n.clearLastNotificationResponse();};
    try{
     const href=await openOwnedNotification(user.id,id,()=>active);
     if(!active)return;
     handled.add(id);if(handled.size>100)handled.delete(handled.values().next().value!);
     clear();router.push(href);void refresh().catch(()=>undefined);
    }catch(cause){
     if(!active)return;
     if(cause instanceof NotificationOpenError&&cause.reason!=="network"){handled.add(id);clear();}
     void alert("تعذر فتح الإشعار",cause instanceof NotificationOpenError?cause.message:"تحقق من الاتصال وافتح الإشعار من القائمة داخل التطبيق.");
    }finally{opening.delete(id);}
   };
   const received=n.addNotificationReceivedListener(()=>{if(active)void refresh().catch(()=>undefined);});
   const tapped=n.addNotificationResponseReceivedListener(r=>{void open(r).catch(()=>undefined);});
   const resume=AppState.addEventListener("change",state=>{if(state==="active"&&active){const last=n.getLastNotificationResponse();if(last)void open(last).catch(()=>undefined);}});
   stops.push(()=>received.remove(),()=>tapped.remove(),()=>resume.remove(),()=>n.setNotificationHandler(null));
   const last=n.getLastNotificationResponse();if(last)void open(last).catch(()=>undefined);
  }).catch(()=>undefined);
  return()=>{active=false;stops.forEach(stop=>stop());};
 },[user,router,refresh,alert]);
 return null;
}

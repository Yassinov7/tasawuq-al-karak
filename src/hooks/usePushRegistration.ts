import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { pushUnavailableReason, registerPushDevice } from "@/lib/push-device";
export function usePushRegistration(owner?:string) {
 const [pushMessage,setMessage]=useState("");
 const [pushReady,setReady]=useState(false),[pushBusy,setBusy]=useState(false);
 const alive=useRef(true),epoch=useRef(0),lock=useRef(false);
 const register=useCallback(async(ask:boolean)=>{
  if(!owner||lock.current)return;
  const token=++epoch.current;lock.current=true;setBusy(true);
  try{const result=await registerPushDevice(owner,ask,()=>alive.current&&token===epoch.current);if(alive.current&&token===epoch.current){setMessage(result.message);setReady(result.ready);}}
  catch{if(alive.current&&token===epoch.current){setReady(false);setMessage("تعذر تفعيل تنبيهات هذا الجهاز. تحقق من الاتصال وحاول لاحقًا؛ تبقى الإشعارات داخل التطبيق متاحة.");}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 },[owner]);
 useEffect(()=>{
  let active=true;
  alive.current=true;
  const timer=setTimeout(()=>{if(owner)void register(false);},0);
  const listener=AppState.addEventListener("change",state=>{if(state==="active"&&owner)void register(false);});
  let stopToken:(()=>void)|undefined;
  if(owner&&!pushUnavailableReason())void import("expo-notifications").then(n=>{
   if(!active)return;
   const subscription=n.addPushTokenListener(()=>void register(false));stopToken=()=>subscription.remove();
  }).catch(()=>{if(active)setMessage("تحتاج تنبيهات الجهاز نسخة هاتف مبنية بالحزمة الجديدة.");});
  const invalidate=()=>{alive.current=false;epoch.current++;};
  return()=>{active=false;invalidate();clearTimeout(timer);listener.remove();stopToken?.();};
 },[owner,register]);
 return {pushMessage,pushReady,pushBusy,enablePush:useCallback(()=>register(true),[register])};
}

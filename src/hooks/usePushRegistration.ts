import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { pushUnavailableReason, registerPushDevice, type PushRegistrationState } from "@/lib/push-device";
export function usePushRegistration(owner?:string) {
 const unavailable=pushUnavailableReason();
 const [result,setResult]=useState<{ status: PushRegistrationState; message: string }>({status:"checking",message:"جارٍ التحقق من إذن التنبيهات…"});
 const [pushBusy,setBusy]=useState(false);
 const alive=useRef(true),epoch=useRef(0),lock=useRef(false);
 const register=useCallback(async(ask:boolean)=>{
  if(!owner||unavailable||lock.current)return;
  const token=++epoch.current;lock.current=true;setBusy(true);
  try {
   const next=await registerPushDevice(owner,ask,()=>alive.current&&token===epoch.current);
   if(alive.current&&token===epoch.current)setResult(next);
  } catch {
   if(alive.current&&token===epoch.current)setResult({status:"permission-check-failed",message:"تعذر التحقق من إذن تنبيهات الجهاز. أعد المحاولة."});
  }
  finally{lock.current=false;if(alive.current)setBusy(false);}
 },[owner,unavailable]);
 useEffect(()=>{
  let active=true;
  alive.current=true;
  const timer=setTimeout(()=>{if(owner)void register(false);},0);
  const listener=AppState.addEventListener("change",state=>{if(state==="active"&&owner)void register(false);});
  let stopToken:(()=>void)|undefined;
  if(owner&&!pushUnavailableReason())void import("expo-notifications").then(n=>{
   if(!active)return;
   const subscription=n.addPushTokenListener(()=>void register(false));stopToken=()=>subscription.remove();
  }).catch(()=>undefined); // Explicit registration reports native-module failures.
  const invalidate=()=>{alive.current=false;epoch.current++;};
  return()=>{active=false;invalidate();clearTimeout(timer);listener.remove();stopToken?.();};
 },[owner,register]);
 const enablePush=useCallback(()=>register(true),[register]);
 const retryPush=useCallback(()=>register(false),[register]);
 return {pushStatus:unavailable?"unsupported" as const:result.status,pushMessage:unavailable??result.message,pushBusy,enablePush,retryPush};
}

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Typography, Spacing, Radius } from "@/constants/theme";
import { createToastStore, type ToastInput, type ToastNotice } from "@/lib/toast-store";
const ToastContext=createContext<{show:(input:ToastInput)=>boolean}|null>(null);
export function ToastProvider({children}:{children:ReactNode}){
 const {user}=useAuth(),path=usePathname(),{colors}=useTheme(),insets=useSafeAreaInsets();
 const scope=JSON.stringify([user?.id??"guest",path]);
 const lease=useMemo(()=>({scope}),[scope]);
 const [notice,setNotice]=useState<ToastNotice|null>(null);
 const store=useMemo(()=>createToastStore(setNotice),[]);
 useLayoutEffect(()=>{store.setScope(lease);return ()=>store.setScope(null);},[store,lease]);
 const value=useMemo(()=>({show:(input:ToastInput)=>store.show(input,lease)}),[store,lease]);
 const tone=notice?.tone??"info";
 const foreground=tone==="success"?colors.successForeground:tone==="error"?colors.errorForeground:tone==="warning"?colors.warningForeground:colors.infoForeground;
 const surface=tone==="success"?colors.successSurface:tone==="error"?colors.errorSurface:tone==="warning"?colors.warningSurface:colors.infoSurface;
 const title=tone==="success"?"نجاح":tone==="error"?"تعذر الإجراء":tone==="warning"?"تنبيه":"معلومة";
 return <ToastContext.Provider value={value}>{children}
  {notice?<View pointerEvents="box-none" style={{position:"absolute",top:insets.top+64,start:Spacing.three,end:Spacing.three,alignItems:"center",zIndex:1000}}>
   <View style={{width:"100%",maxWidth:520,backgroundColor:surface,borderColor:colors.borderStrong,borderWidth:1,borderRadius:Radius.lg,padding:Spacing.three,gap:Spacing.two}}>
    <Text accessibilityLiveRegion="polite" style={{...Typography.bodyStrong,color:foreground,textAlign:"right"}}>{title}: {notice.message}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="إغلاق الرسالة" onPress={store.dismiss} style={{minHeight:44,justifyContent:"center"}}><Text style={{...Typography.bodyStrong,color:foreground,textAlign:"right"}}>إغلاق</Text></Pressable>
   </View>
  </View>:null}
 </ToastContext.Provider>;
}
export function useToast(){const context=useContext(ToastContext);if(!context)throw Error("ToastProvider missing");return context;}

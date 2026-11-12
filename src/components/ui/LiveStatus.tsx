import { Text, View } from "react-native";
import { Typography, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { LiveState } from "@/lib/live-updates";
export function LiveStatus({ state, compact=false, updatedAt, busy=false, textScale=1, hideTimestamp=false }: { state: LiveState; compact?:boolean; updatedAt?:number; busy?:boolean; textScale?:number; hideTimestamp?:boolean }) {
 const { colors }=useTheme();
 const label=state==="live"?"متصل":state==="disconnected"?"غير متصل":state==="paused"?"معلّق بالخلفية":"جارٍ الاتصال";
 if(compact){
  const time=updatedAt?new Date(updatedAt).toLocaleTimeString("ar-SY",{hour:"2-digit",minute:"2-digit",hour12:false}):"—";
  return <View accessible accessibilityLabel={`التحديث المباشر ${label}. ${busy?"جارٍ تحديث البيانات. ":""}${updatedAt?`آخر قراءة ناجحة الساعة ${time}.`:"لم تكتمل قراءة البيانات بعد."} اتصال التحديث المباشر مستقل عن نجاح قراءة البيانات.`}
   style={{minHeight:36*textScale,flexDirection:"row-reverse",alignItems:"center",gap:Spacing.two,flexWrap:"wrap"}}>
   <View style={{flexDirection:"row-reverse",alignItems:"center",gap:Spacing.one,width:104*textScale,maxWidth:"100%"}}>
    <View style={{width:8,height:8,borderRadius:4,backgroundColor:state==="live"?colors.successForeground:state==="disconnected"?colors.errorForeground:colors.textSecondary}}/>
    <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:"right"}}>{state==="live"?"متصل":state==="disconnected"?"دون اتصال":state==="paused"?"متوقف":"جارٍ الاتصال"}</Text>
   </View>
   {!hideTimestamp?<Text style={{...Typography.caption,color:colors.textSecondary,textAlign:"right",width:144*textScale,maxWidth:"100%"}}>{`تحديث ${time}`}</Text>:null}
  </View>;
 }
 // Always mounted: reconnect attempts cannot insert/remove a banner above the list.
 return <View style={{minHeight:52,padding:Spacing.two,backgroundColor:colors.surfaceSecondary,justifyContent:"center"}}>
  <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:"right"}}>التحديث المباشر: {label}</Text>
  <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:"right"}}>التحديث اليدوي متاح</Text>
 </View>;
}

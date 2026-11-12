import { RefreshStatus } from "@/components/ui/LoadingState";
import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Typography, Spacing, MaxContentWidth } from "@/constants/theme";
import { AppButton } from "@/components/ui/AppButton";
import { HomeSummary } from "@/components/home/HomeSummary";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { useDriverTaskRefresh as useScreenRefresh } from "@/hooks/useDriverTaskRefresh";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { readAdminHome, type AdminHome } from "@/lib/operational-home";

export default function AdminHomeScreen(){const {user}=useAuth();return user?<AdminHomeContent key={user.id} owner={user.id}/>:null;}
function AdminHomeContent({owner}:{owner:string}){
 const router=useRouter(),{colors}=useTheme();
 const [data,setData]=useState<AdminHome>(),[busy,setBusy]=useState(true),[error,setError]=useState(false);
 const load=useCallback(async(signal:AbortSignal)=>{
  setBusy(true);
  try{const next=await readAdminHome(owner,signal);if(!signal.aborted){setData(next);setError(false);}}
  catch{if(!signal.aborted)setError(true);}
  finally{if(!signal.aborted)setBusy(false);}
 },[owner]);
 const refresh=useScreenRefresh(load,true);
 const live=useOrderRealtime({channelName:`admin-home:${owner}`,enabled:true,subscriptions:[{table:"merchant_applications"},{table:"driver_applications"},{table:"customer_orders"},{table:"order_pricing_current"}],onChange:()=>refresh("change")});
 return <ScrollView style={{flex:1,backgroundColor:colors.background}} contentContainerStyle={{padding:Spacing.four,gap:Spacing.three,width:"100%",maxWidth:MaxContentWidth,alignSelf:"center"}}
  refreshControl={<RefreshControl refreshing={busy&&!!data} onRefresh={()=>void refresh("manual")} tintColor={colors.primary} colors={[colors.primary]}/> }>
  <Text style={{...Typography.pageTitle,color:colors.text,textAlign:"right"}}>متابعة المنصة</Text>
  <Text style={{...Typography.body,color:colors.textSecondary,textAlign:"right"}}>طلبات الانضمام ومتابعة الطلبات. الأعداد تشمل جميع السجلات المطابقة، وليست الصفحة المحمّلة فقط.</Text>
  <LiveStatus state={live}/>
  <RefreshStatus busy={busy} label={data?"جارٍ تحديث الملخص…":"جارٍ تحميل الملخص…"}/>
  {error?<View style={{gap:Spacing.two}}><Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,backgroundColor:colors.errorSurface,padding:Spacing.three,textAlign:"right"}}>{data?"تعذر التحديث؛ المعروض آخر أعداد مؤكدة.":"تعذر تحميل الأعداد. تحقق من الاتصال وأعد المحاولة."}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={()=>void refresh("manual")}/></View>:null}
  <HomeSummary title="تجار ينتظرون المراجعة" count={data?.merchant_pending} description="فتح طلبات انضمام التجار قيد المراجعة" tone="warning" onPress={()=>router.push({pathname:"/admin/applications",params:{role:"merchant",status:"pending"}})}/>
  <HomeSummary title="سائقون ينتظرون المراجعة" count={data?.driver_pending} description="فتح طلبات انضمام السائقين قيد المراجعة" tone="warning" onPress={()=>router.push({pathname:"/admin/applications",params:{role:"driver",status:"pending"}})}/>
  <HomeSummary title="طلبات تحتاج مراجعة السعر" count={data?.pricing_review} description="طلبات جارية تحتاج مراجعة اختلاف المبلغ" tone="warning" onPress={()=>router.push({pathname:"/admin/orders",params:{filter:"pricing_review"}})}/>
  <HomeSummary title="طلبات جديدة" count={data?.new_orders} description="فتح الطلبات المرسلة حديثًا لمتابعة معالجتها" onPress={()=>router.push({pathname:"/admin/orders",params:{filter:"new"}})}/>
  <HomeSummary title="متابعة التوصيل" count={data?.delivery_orders} description="طلبات جاهزة للتوصيل أو في الطريق إلى العميل" onPress={()=>router.push({pathname:"/admin/orders",params:{filter:"awaiting_delivery"}})}/>
  {data&&!busy&&!error&&Object.entries(data).every(([key,value])=>key==="owner"||value===0)?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:"right"}}>لا توجد حالات ضمن قوائم المتابعة حاليًا.</Text>:null}
  <View style={{gap:Spacing.two,marginTop:Spacing.three}}><AppButton title="فتح المالية" variant="outline" onPress={()=>router.push("/admin/finance")}/><AppButton title="إدارة المنصة والإعدادات" variant="outline" onPress={()=>router.push("/admin/more")}/></View>
 </ScrollView>;
}

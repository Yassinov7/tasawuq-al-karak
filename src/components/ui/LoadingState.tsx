import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Typography, Spacing, Radius } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function useLongWait(busy:boolean){
 const [elapsed,setElapsed]=useState<object|null>(null);
 const cycle=useMemo(()=>({busy}),[busy]);
 useEffect(()=>{if(!busy)return;const timer=setTimeout(()=>setElapsed(cycle),12000);return()=>clearTimeout(timer);},[busy,cycle]);
 return busy&&elapsed===cycle;
}
/** Static placeholders: no shimmer, looping animation or disappearing whole page. */
export function LoadingSkeleton({cards=2,label="جارٍ تحميل البيانات"}:{cards?:number;label?:string}){
 const {colors}=useTheme();const delayed=useLongWait(true);
 return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{busy:true}} style={{gap:Spacing.three,paddingVertical:Spacing.two}}>
  {Array.from({length:cards},(_,index)=><View key={index} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{minHeight:124,padding:Spacing.four,gap:Spacing.three,borderRadius:Radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface}}>
   <View style={{height:18,width:"55%",alignSelf:"flex-end",borderRadius:Radius.sm,backgroundColor:colors.mutedSurface}}/>
   <View style={{height:14,width:"85%",alignSelf:"flex-end",borderRadius:Radius.sm,backgroundColor:colors.mutedSurface}}/>
   <View style={{height:14,width:"70%",alignSelf:"flex-end",borderRadius:Radius.sm,backgroundColor:colors.mutedSurface}}/>
  </View>)}
  <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:"right",minHeight:40}}>{delayed?"التحميل يستغرق وقتًا أطول. تحقق من الاتصال ثم أعد المحاولة.":label}</Text>
 </View>;
}
/** Reserve the same row for idle/background/manual refresh; spinner stops on a long wait. */
export function RefreshStatus({busy,label="جارٍ تحديث البيانات…",idleText=""}:{busy:boolean;label?:string;idleText?:string}){
 const {colors}=useTheme();const delayed=useLongWait(busy);
 return <View style={{minHeight:40,flexDirection:"row-reverse",alignItems:"center",gap:Spacing.two}}>
  <View style={{width:20,height:20}}>{busy&&!delayed?<ActivityIndicator size="small" color={colors.primary}/>:null}</View>
  <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:"right",flex:1}}>{delayed?"التحديث يستغرق وقتًا أطول؛ البيانات المعروضة لم تُؤكد مجددًا.":busy?label:idleText}</Text>
 </View>;
}

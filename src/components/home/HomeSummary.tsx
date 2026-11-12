import { Pressable, Text, View } from "react-native";
import { Typography, Spacing, Radius } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function HomeSummary({title,count,description,tone="info",onPress,disabled=false,compact=false}:{title:string;count:number|undefined;description:string;tone?:"warning"|"info"|"success";onPress:()=>void;disabled?:boolean;compact?:boolean}){
 const {colors}=useTheme();
 const foreground=tone==="warning"?colors.warningForeground:tone==="success"?colors.successForeground:colors.infoForeground;
 const surface=tone==="warning"?colors.warningSurface:tone==="success"?colors.successSurface:colors.infoSurface;
 if(compact)return <Pressable accessibilityRole="button" accessibilityState={{disabled}} accessibilityLabel={`${title}، ${count===undefined?"لم يُحمّل العدد":count}، ${description}`} disabled={disabled} onPress={onPress}
  style={({pressed})=>({padding:Spacing.two,gap:Spacing.one,borderRadius:Radius.md,borderWidth:1,borderColor:tone==="warning"?colors.pendingBorder:colors.borderStrong,backgroundColor:pressed?colors.surfacePressed:tone==="warning"?colors.pendingSurface:surface,minHeight:88,flexGrow:1,alignItems:"center",justifyContent:"center"})}>
  <View style={{minHeight:Typography.metric.lineHeight,alignItems:"center",justifyContent:"center"}}>
   {count===undefined?<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:40,height:24,borderRadius:Radius.sm,backgroundColor:colors.mutedSurface}}/>:<Text style={{...Typography.metric,color:tone==="warning"?colors.pendingForeground:foreground,textAlign:"center"}}>{count.toLocaleString("ar-SY")}</Text>}
  </View>
  <Text style={{...Typography.label,color:tone==="warning"?colors.pendingForeground:foreground,textAlign:"center"}}>{title}</Text>
 </Pressable>;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${title}، ${count===undefined?"لم يُحمّل العدد":count}، ${description}`} disabled={disabled} onPress={onPress}
  style={({pressed})=>({padding:Spacing.four,gap:Spacing.two,borderRadius:Radius.lg,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:pressed?colors.surfacePressed:surface,minHeight:88})}>
  <View style={{flexDirection:"row-reverse",alignItems:"center",gap:Spacing.two}}><Text style={{...Typography.cardTitle,color:foreground,textAlign:"right",flex:1}}>{title}</Text><Text style={{...Typography.metric,color:foreground,textAlign:"center",minWidth:72}}>{count===undefined?"—":count.toLocaleString("ar-SY")}</Text></View>
  <Text style={{...Typography.body,color:foreground,textAlign:"right"}}>{description}</Text>
 </Pressable>;
}

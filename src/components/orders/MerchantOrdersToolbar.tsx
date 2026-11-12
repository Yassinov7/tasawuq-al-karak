import { useRef } from "react";
import { ActivityIndicator, I18nManager, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { OrderFilter } from "@/lib/merchant-orders";
import type { LiveState } from "@/lib/live-updates";

const filters: {value:OrderFilter;label:string}[] = [
  {value:"all",label:"الكل"},{value:"awaiting_review",label:"جديدة"},
  {value:"preparing",label:"قيد التجهيز"},{value:"ready_for_pickup",label:"جاهزة"},
];
export function MerchantOrdersToolbar({value,onChange,onSubmit,onClear,filter,onFilter,counts,connection,onConnection,updating,delayed,targeted=false}:{
  value:string;onChange:(value:string)=>void;onSubmit:()=>void;onClear:()=>void;
  filter:OrderFilter;onFilter:(filter:OrderFilter)=>void;counts:Record<OrderFilter,number>|null;
  connection:LiveState;onConnection:()=>void;updating:boolean;delayed:boolean;targeted?:boolean;
}) {
  const {colors}=useTheme();
  const filterScroll=useRef<ScrollView>(null);
  const positioned=useRef(false);
  const connected=connection==="live";
  const connectionLabel=connected?"التحديث المباشر متصل":connection==="disconnected"?"التحديث المباشر غير متصل؛ قد تستمر القراءة اليدوية":"التحديث المباشر بانتظار الاتصال";
  return <View style={styles.toolbar}>
    <View style={styles.searchRow}>
      {!targeted?<View style={[styles.search,{backgroundColor:colors.surfaceSecondary,borderColor:colors.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="بحث عن الطلب" onPress={onSubmit} style={styles.iconButton}><AppIcon name="search-outline" size={20} color={colors.textSecondary}/></Pressable>
        <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSubmit} returnKeyType="search" autoCapitalize="characters" autoCorrect={false}
          accessibilityLabel="ابحث برمز SOR أو ORD أو رقم الطلب" placeholder="رمز الطلب أو رقمه" placeholderTextColor={colors.textMuted}
          style={[styles.input,{color:colors.text}]} textAlign="right"/>
        {value.length>0?<Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={onClear} style={styles.iconButton}><AppIcon name="close-outline" size={18} color={colors.textSecondary}/></Pressable>:null}
      </View>:<View style={styles.spacer}/>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${connectionLabel}. ${updating?"جارٍ تحديث البيانات.":""} عرض تفاصيل الاتصال`} onPress={onConnection} style={styles.connection}>
        {updating&&!delayed?<ActivityIndicator size="small" color={colors.primary}/>:<AppIcon name={delayed?"time-outline":connected?"checkmark-circle-outline":"cloud-offline-outline"} size={20} color={connected?colors.successForeground:connection==="disconnected"?colors.errorForeground:colors.textSecondary}/>}
      </Pressable>
    </View>
    {!targeted?<ScrollView ref={filterScroll} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters}
      onContentSizeChange={()=>{
        // Native RTL starts at the right. Match that start when the host remains LTR.
        if(!positioned.current){if(!I18nManager.isRTL)filterScroll.current?.scrollToEnd({animated:false});positioned.current=true;}
      }}>
      {filters.map(item=><Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected:filter===item.value}}
        accessibilityLabel={`${item.label}، ${counts?`${counts[item.value]} طلبًا في المتجر` : "العدد غير مؤكد"}`}
        onPress={()=>onFilter(item.value)} style={({pressed})=>[styles.chip,{backgroundColor:pressed?colors.surfacePressed:filter===item.value?colors.surfaceSelected:colors.background,borderColor:filter===item.value?colors.primary:colors.border}]}>
        <Text style={[styles.chipText,{color:filter===item.value?colors.primary:colors.textSecondary}]}>{item.label}</Text>
      </Pressable>)}
    </ScrollView>:null}
  </View>;
}
const styles=StyleSheet.create({
 toolbar:{gap:Spacing.two},searchRow:{flexDirection:"row-reverse",alignItems:"center",gap:Spacing.one},
 search:{flex:1,minWidth:0,flexDirection:"row-reverse",alignItems:"center",borderWidth:1,borderRadius:Radius.md},
 input:{...Typography.body,flex:1,minWidth:0,minHeight:44,paddingVertical:Spacing.two},
 iconButton:{minWidth:44,minHeight:44,justifyContent:"center",alignItems:"center"},
 connection:{width:44,minHeight:44,alignItems:"center",justifyContent:"center"},spacer:{flex:1},
 filters:{flexDirection:"row-reverse",gap:Spacing.two,paddingVertical:Spacing.half},
 chip:{minHeight:44,paddingHorizontal:Spacing.three,paddingVertical:Spacing.one,borderRadius:Radius.full,borderWidth:1,justifyContent:"center"},
 chipText:{...Typography.label,textAlign:"center"},
});

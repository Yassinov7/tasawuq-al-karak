import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { orderTotal, type MerchantOrder, type OrderStatus } from "@/lib/merchant-orders";
import { groupOrderItems } from "@/lib/order-item-groups";
import { formatSyp } from "@/lib/money";

const labels:Record<OrderStatus,string>={awaiting_review:"جديدة",preparing:"قيد التجهيز",ready_for_pickup:"جاهزة",handed_to_driver:"لدى السائق",delivered:"تم التسليم",rejected:"معتذر عنه",cancelled:"ملغى"};
const date=(value:string)=>new Date(value).toLocaleString("ar-SY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
export function MerchantOrderCard({order,expanded,toggle,busy,onStart,onReady,onReject}:{
 order:MerchantOrder;expanded:boolean;toggle:()=>void;busy:boolean;onStart:()=>void;onReady:()=>void;onReject:()=>void;
}){
 const {colors}=useTheme();
 const total=orderTotal(order.store_order_totals),parent=order.customer_orders;
 const stateColor=order.status==="awaiting_review"?colors.pendingForeground:order.status==="rejected"?colors.errorForeground:order.status==="delivered"?colors.successForeground:order.status==="cancelled"?colors.textSecondary:colors.infoForeground;
 const groups=expanded?groupOrderItems(order.store_order_items):[];
 return <View style={[styles.card,{backgroundColor:colors.surface,borderColor:expanded?colors.borderStrong:colors.border}]}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded}} accessibilityLabel={`${expanded?"إخفاء":"عرض"} تفاصيل طلب متجرك ${order.reference??parent.order_number}`}
   onPress={toggle} style={({pressed})=>[styles.summary,{backgroundColor:pressed?colors.surfacePressed:colors.surface}]}>
   <View style={styles.row}>
    <View style={styles.reference}>{order.reference?<DocumentReference value={order.reference}/>:<Text style={[styles.meta,{color:colors.textSecondary}]}>الرمز غير متاح</Text>}</View>
    <View style={[styles.status,{backgroundColor:colors.surfaceSecondary}]}><Text style={[styles.statusText,{color:stateColor}]}>{labels[order.status]}</Text></View>
   </View>
   <View style={styles.row}>
    <View style={styles.metadata}>
     <Text style={[styles.meta,{color:colors.textSecondary}]}>{date(order.created_at)}</Text>
     <Text style={[styles.meta,{color:colors.textSecondary}]}>{order.store_order_items.length.toLocaleString("ar-SY")} بنود</Text>
    </View>
    <View style={styles.amount}>
     <Text style={[styles.meta,{color:colors.textSecondary}]}>إجمالي متجرك</Text>
     <Text style={[styles.strong,{color:total?colors.text:colors.errorForeground}]}>{total??"غير متاح"}</Text>
    </View>
   </View>
   <View style={styles.row}>
    <View style={styles.link}><Text style={[styles.meta,{color:colors.primary}]}>{expanded?"إخفاء التفاصيل":"التفاصيل"}</Text><AppIcon name={expanded?"chevron-up-outline":"chevron-down-outline"} size={16} color={colors.primary}/></View>
    {order.customer_note?<View style={styles.link}><AppIcon name="chatbubble-outline" size={13} color={colors.textSecondary}/><Text style={[styles.meta,{color:colors.textSecondary}]}>ملاحظة</Text></View>:null}
   </View>
  </Pressable>
  {expanded?<View style={[styles.details,{borderTopColor:colors.border}]}>
   <Text style={[styles.section,{color:colors.text}]}>المنتجات</Text>
   {groups.map(group=><View key={group.id} style={[styles.productGroup,{borderBottomColor:colors.border}]}>
    {group.offerTitle?<Text style={[styles.strong,{color:colors.text}]}>{group.offerTitle}</Text>:null}
    {group.offerDescription?<Text style={[styles.body,{color:colors.textSecondary}]}>{group.offerDescription}</Text>:null}
    {group.items.map(item=><View key={item.id} style={styles.product}>
     <Text style={[styles.body,{color:colors.text}]}>{item.product_title_snapshot}</Text>
     <Text style={[styles.meta,{color:colors.textSecondary}]}>{item.quantity} {item.selling_unit_snapshot} × {formatSyp(item.unit_price_snapshot,item.currency)}</Text>
    </View>)}
    <View style={styles.row}>
     {group.originalTotal>group.finalTotal?<Text style={[styles.meta,{color:colors.textSecondary,textDecorationLine:"line-through"}]}>{formatSyp(group.originalTotal,group.currency)}</Text>:null}
     <Text style={[styles.strong,{color:colors.text}]}>{formatSyp(group.finalTotal,group.currency)}</Text>
    </View>
   </View>)}
   <View style={styles.delivery}>
    <Text style={[styles.section,{color:colors.text}]}>التوصيل</Text>
    <View style={styles.row}><Text style={[styles.body,{color:colors.text}]}>{parent.recipient_name}</Text><Text selectable style={[styles.body,{color:colors.textSecondary,writingDirection:"ltr"}]}>{parent.contact_phone}</Text></View>
    <Text style={[styles.body,{color:colors.textSecondary}]}>{parent.delivery_address}</Text>
   </View>
   <View style={styles.row}><Text style={[styles.meta,{color:colors.textSecondary}]}>طلب العميل {parent.order_number.toLocaleString("ar-SY",{useGrouping:false})}</Text>{order.parentReference?<DocumentReference value={order.parentReference}/>:null}</View>
   {order.customer_note?<View style={[styles.note,{backgroundColor:colors.surfaceSecondary}]}><Text style={[styles.strong,{color:colors.text}]}>ملاحظة العميل</Text><Text style={[styles.body,{color:colors.text}]}>{order.customer_note}</Text></View>:null}
   {order.rejection_reason?<View style={styles.note}><Text style={[styles.strong,{color:colors.errorForeground}]}>سبب الاعتذار</Text><Text style={[styles.body,{color:colors.text}]}>{order.rejection_reason}</Text></View>:null}
   {order.status==="awaiting_review"?<View style={styles.actions}>
    <AppButton title="قبول وبدء التجهيز" onPress={onStart} loading={busy}/>
    <AppButton title="الاعتذار عن طلب المتجر" variant="outline" onPress={onReject} disabled={busy}/>
   </View>:order.status==="preparing"?<AppButton title="الطلب جاهز للاستلام" onPress={onReady} loading={busy}/>:null}
  </View>:null}
 </View>;
}
const styles=StyleSheet.create({
 card:{borderWidth:1,borderRadius:Radius.md,overflow:"hidden"},
 summary:{padding:Spacing.three,gap:Spacing.two,minHeight:44},
 row:{flexDirection:"row-reverse",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:Spacing.two},
 reference:{flexShrink:1},status:{paddingHorizontal:Spacing.two,paddingVertical:Spacing.one,borderRadius:Radius.full,flexShrink:1},statusText:{...Typography.caption,textAlign:"right"},
 metadata:{flexGrow:1,flexShrink:1,flexBasis:110,gap:Spacing.half},amount:{flexGrow:1,flexShrink:1,flexBasis:110,gap:Spacing.half},
 meta:{...Typography.caption,textAlign:"right"},body:{...Typography.body,textAlign:"right"},strong:{...Typography.bodyStrong,textAlign:"right"},
 link:{flexDirection:"row-reverse",alignItems:"center",gap:Spacing.one},
 details:{borderTopWidth:1,padding:Spacing.three,gap:Spacing.three},section:{...Typography.cardTitle,textAlign:"right"},
 productGroup:{borderBottomWidth:1,paddingBottom:Spacing.two,gap:Spacing.two},product:{gap:Spacing.half},
 delivery:{gap:Spacing.one},note:{padding:Spacing.two,borderRadius:Radius.sm,gap:Spacing.one},actions:{gap:Spacing.two},
});

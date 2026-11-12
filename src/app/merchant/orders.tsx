import { useLongWait } from "@/components/ui/LoadingState";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, AppState, FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MerchantOrderCard } from "@/components/orders/MerchantOrderCard";
import { MerchantOrdersToolbar } from "@/components/orders/MerchantOrdersToolbar";
import { AppIcon } from "@/components/ui/AppIcon";
import { useDriverTaskRefresh as useScreenRefresh } from "@/hooks/useDriverTaskRefresh";
import { useAppDialog } from "@/context/AppDialogContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { createMerchantOrdersController, initialOrdersState, orderFilters, orderTotal, rejectionError, type MerchantOrder, type OrderFilter, type OrdersState } from "@/lib/merchant-orders";

export default function MerchantOrdersScreen() {
  const { user } = useAuth();
  const {storeOrderId,filter:rawFilter}=useLocalSearchParams<{storeOrderId?:string;filter?:string}>();
  const initialFilter=orderFilters.find(value=>value===rawFilter)??"all";
  const targetId=storeOrderId&&/^[0-9a-f-]{36}$/i.test(storeOrderId)?storeOrderId:undefined;
  return user ? <MerchantOrders key={`${user.id}:${targetId}:${initialFilter}`} ownerId={user.id} targetId={targetId} initialFilter={initialFilter} /> : null;
}
function MerchantOrders({ ownerId,targetId,initialFilter }: { ownerId: string;targetId?:string;initialFilter:OrderFilter }) {
  const router=useRouter();
  const dialog=useAppDialog();
  const {fontScale,height}=useWindowDimensions();
  const cardGap=fontScale>1.25||height<740?Spacing.two:Spacing.three;
  const intent=useRef(new Set<string>());
  const { colors } = useTheme();
  const [state, setState] = useState<OrdersState>({...initialOrdersState,filter:initialFilter});
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(targetId??null);
  const [search,setSearch]=useState("");
  const [manualRefreshing,setManualRefreshing]=useState(false);
  const [target, setTarget] = useState<MerchantOrder | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const controller = useMemo(() => createMerchantOrdersController(ownerId, setState,undefined,targetId,initialFilter), [ownerId,targetId,initialFilter]);
  useFocusEffect(useCallback(() => {
    controller.activate(); setFocused(true);
    if(AppState.currentState!==null && AppState.currentState!=="active")controller.suspend();
    const listener=AppState.addEventListener("change",value=>value==="active"?controller.resume():controller.suspend());
    return () => { listener.remove(); controller.deactivate(); setFocused(false); setTarget(null); };
  }, [controller]));
  const load=useCallback(async(signal:AbortSignal)=>{await controller.refresh(signal);},[controller]);
  const requestRefresh=useScreenRefresh(load,true);
  const subscriptions = useMemo(() => state.storeId ? [{ table: "store_orders" as const, filter: `store_id=eq.${state.storeId}` }] : [], [state.storeId]);
  const realtime = useCallback(() => requestRefresh("change"), [requestRefresh]);
  const live = useOrderRealtime({ channelName: `merchant-orders:${state.storeId ?? "none"}`, enabled: focused && Boolean(state.storeId), subscriptions, onChange: realtime });
  const reject = async () => {
    const error = rejectionError(reason); setReasonError(error);
    if (error || !target) return;
    if (await controller.action(target, "rejected", reason)) { setTarget(null); setReason(""); }
  };
  const delayedRead=useLongWait(state.loading);
  const delayedMore=useLongWait(state.moreLoading);
  const clearSearch=()=>{setSearch("");setExpanded(null);setTarget(null);void controller.search("");};
  const showConnection=()=>void dialog.alert("حالة التحديث",`${live==="live"?"التحديث المباشر متصل.":live==="disconnected"?"التحديث المباشر غير متصل؛ يمكنك تحديث القائمة يدويًا.":"جارٍ استعادة الاتصال المباشر."} ${state.error?"تعذر تأكيد آخر قراءة.":state.loadedAt?`آخر قراءة ناجحة ${new Date(state.loadedAt).toLocaleTimeString("ar-SY",{hour:"2-digit",minute:"2-digit"})}.`:"لم تكتمل القراءة الأولى بعد."}`);
  const refresh = async () => {setManualRefreshing(true);try{await requestRefresh("manual");}finally{setManualRefreshing(false);}};
  const confirmAction=async(order:MerchantOrder,next:"preparing"|"ready_for_pickup")=>{
    if(intent.current.has(order.id))return;
    intent.current.add(order.id);
    try{
      const accepted=await dialog.confirm({title:next==="preparing"?"قبول طلب المتجر":"تأكيد جاهزية طلب المتجر",message:`${order.reference??`رقم الطلب ${order.customer_orders.order_number}`}\n${order.store_order_items.length} بنود · ${orderTotal(order.store_order_totals)??"الإجمالي غير متاح"}\n${next==="preparing"?"سيبدأ تجهيز طلب متجرك فقط.":"أكد أن جميع منتجات طلب متجرك جاهزة ليستلمها السائق."}`,confirmText:next==="preparing"?"قبول وبدء التجهيز":"تأكيد الجاهزية",cancelText:"رجوع"});
      if(accepted)await controller.action(order,next);
    }finally{intent.current.delete(order.id);}
  };
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <FlatList maintainVisibleContentPosition={{minIndexForVisible:0}}
      key={`${ownerId}:${state.storeId}:${state.filter}`}
      data={state.rows} keyExtractor={item => item.id}
      contentContainerStyle={[styles.content,{gap:cardGap}]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
      initialNumToRender={5} onEndReachedThreshold={0.4} onEndReached={() => { void controller.more(); }}
      refreshing={manualRefreshing&&!delayedRead} onRefresh={refresh}
      ListHeaderComponent={<View style={styles.header}>
        {/* The merchant layout supplies the single page title. */}
        <MerchantOrdersToolbar value={search} onChange={value=>{setSearch(value);if(!value.trim()&&state.search)void controller.search("");}}
          onSubmit={()=>{setExpanded(null);setTarget(null);void controller.search(search);}} onClear={clearSearch}
          filter={state.filter} onFilter={filter=>{setExpanded(null);setTarget(null);void controller.select(filter);}}
          counts={state.counts} connection={live} onConnection={showConnection} updating={state.loading&&state.rows.length>0&&(!manualRefreshing||delayedRead)} delayed={delayedRead} targeted={Boolean(targetId)}/>
        {targetId?<AppButton title="عرض كل الطلبات" variant="outline" onPress={()=>router.replace("/merchant/orders")}/>:null}
        {state.notice ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.infoForeground, backgroundColor: colors.surfaceSecondary }]}>{state.notice}</Text> : null}
        {state.error && state.rows.length>0 ? <View style={[styles.message, { backgroundColor: colors.surfaceSecondary }]}>
          <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.errorForeground }]}>{state.error}</Text>
          <AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={refresh} disabled={state.loading} />
        </View> : null}
      </View>}
      ListEmptyComponent={<View style={styles.empty}>
        {state.loading?<>
          {delayedRead?<AppIcon name="time-outline" size={24} color={colors.textSecondary}/>:<ActivityIndicator size="small" color={colors.primary}/>}
          <Text style={[styles.body,{color:colors.textSecondary}]}>{delayedRead?"التحميل يستغرق وقتًا أطول؛ تحقق من الاتصال.":"تحميل الطلبات…"}</Text>
        </>:state.error?<>
          <AppIcon name="cloud-offline-outline" size={26} color={colors.textSecondary}/>
          <Text style={[styles.strong,{color:colors.text}]}>تعذر تحميل الطلبات</Text>
          <Text style={[styles.body,{color:colors.textSecondary}]}>تحقق من الاتصال ثم أعد المحاولة.</Text>
          <AppButton title="إعادة المحاولة" variant="outline" onPress={refresh}/>
        </>:<>
          <AppIcon name={state.search?"search-outline":"receipt-outline"} size={26} color={colors.textSecondary}/>
          <Text style={[styles.strong,{color:colors.text}]}>{state.search?"لا توجد نتائج":state.filter==="all"?"لا توجد طلبات بعد":"لا توجد طلبات بهذه الحالة"}</Text>
          <Text style={[styles.body,{color:colors.textSecondary}]}>{state.search?"جرّب رمزًا آخر أو غيّر الحالة.":state.filter==="all"?"ستظهر الطلبات الجديدة هنا.":"يمكنك اختيار حالة أخرى."}</Text>
        </>}
      </View>}
      ListFooterComponent={<View style={styles.footer}>
        {state.moreLoading?<View style={styles.loadingRow}>
          {!delayedMore?<ActivityIndicator size="small" color={colors.primary}/>:null}
          <Text style={[styles.caption,{color:colors.textSecondary}]}>{delayedMore?"التحميل يستغرق وقتًا أطول":"تحميل المزيد…"}</Text>
        </View>:state.moreError?<>
          <Text style={[styles.body,{color:colors.textSecondary}]}>تعذر تحميل المزيد؛ الطلبات الحالية محفوظة.</Text>
          <AppButton title="إعادة المحاولة" variant="outline" onPress={()=>{controller.retryMore();void controller.more();}}/>
        </>:state.hasMore?<AppButton title="تحميل المزيد" variant="secondary" disabled={state.loading} onPress={()=>{void controller.more();}}/>:state.rows.length>0&&!state.error?<Text style={[styles.caption,{color:colors.textSecondary,textAlign:"center"}]}>نهاية القائمة</Text>:null}
      </View>}
      renderItem={({ item }) => <MerchantOrderCard order={item} expanded={expanded===item.id}
        toggle={() => setExpanded(id=>id===item.id?null:item.id)}
        busy={state.busyIds.includes(item.id)}
        onStart={() => { void confirmAction(item, "preparing"); }} onReady={() => { void confirmAction(item, "ready_for_pickup"); }}
        onReject={() => { setTarget(item); setReason(""); setReasonError(""); }} />}
    />
    <AppModal design="refined" visible={Boolean(target)} title="الاعتذار عن طلب المتجر" message="يخص الاعتذار طلب متجرك فقط. اكتب السبب ليصل للعميل ويُحفظ مع الطلب."
      destructive confirmText="إرسال الاعتذار" cancelText="رجوع" busy={Boolean(target && state.busyIds.includes(target.id))}
      onCancel={() => setTarget(null)} onConfirm={() => { void reject(); }}>
      <AppTextField label="سبب الاعتذار" value={reason} onChangeText={value => { setReason(value); setReasonError(""); }} multiline maxLength={500} placeholder="مثال: أحد المنتجات غير متوفر" />
      {reasonError ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.errorForeground }]}>{reasonError}</Text> : null}
      {state.notice && target ? <Text style={[styles.body, { color: colors.infoForeground }]}>{state.notice}</Text> : null}
    </AppModal>
  </View>;
}
const styles=StyleSheet.create({
 screen:{flex:1},content:{padding:Spacing.four,paddingBottom:Spacing.three,maxWidth:MaxContentWidth,width:"100%",alignSelf:"center",gap:Spacing.two,flexGrow:1},
 header:{gap:Spacing.two},caption:{...Typography.caption,textAlign:"right"},body:{...Typography.body,textAlign:"right"},strong:{...Typography.bodyStrong,textAlign:"right"},
 message:{...Typography.body,textAlign:"right",padding:Spacing.two,borderRadius:Radius.sm,gap:Spacing.two},
 empty:{paddingVertical:Spacing.seven,gap:Spacing.two,alignItems:"center"},
 footer:{minHeight:48,gap:Spacing.two,paddingVertical:Spacing.two},loadingRow:{flexDirection:"row-reverse",justifyContent:"center",alignItems:"center",gap:Spacing.two},
});

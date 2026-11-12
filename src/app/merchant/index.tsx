import { useDriverTaskRefresh as useScreenRefresh } from "@/hooks/useDriverTaskRefresh";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { HomeSummary } from "@/components/home/HomeSummary";
import { dashboardSectionGap } from "@/lib/dashboard-spacing";
import { eligibilityReasons } from "@/lib/operational-home";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { AppIcon } from "@/components/ui/AppIcon";
import { LayoutSpacing, MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppDialog } from "@/context/AppDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  createMerchantHomeController, initialMerchantHomeState, merchantHomeActions,
  merchantStoreStatusLabels, type MerchantHomeState,
} from "@/lib/merchant-home";

export default function MerchantHomeScreen() {
  const { user } = useAuth();
  // A changed account gets fresh state before any previous data renders.
  return user ? <MerchantHomeContent key={user.id} ownerId={user.id} /> : null;
}

function MerchantHomeContent({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const dialog = useAppDialog();
  const { fontScale, width } = useWindowDimensions();
  const { colors } = useTheme();
  const [state, setState] = useState<MerchantHomeState>(initialMerchantHomeState);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [sectionHeights, setSectionHeights] = useState<Record<string,number>>({});
  const measureSection = (name: string) => (event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setSectionHeights(previous => previous[name] === height ? previous : { ...previous, [name]: height });
  };
  const controller = useMemo(() => createMerchantHomeController(ownerId, setState), [ownerId]);
  useFocusEffect(useCallback(() => {
    controller.activate();
    return () => controller.deactivate();
  }, [controller]));

  const load = useCallback((signal: AbortSignal) => controller.refresh(true, signal), [controller]);
  const refresh = useScreenRefresh(load, true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const refreshManually = async () => {
    setManualRefreshing(true);
    try { await refresh("manual"); } finally { setManualRefreshing(false); }
  };
  const { identity, snapshot, busy, error } = state;
  const eligibility = error ? undefined : snapshot?.eligibility;
  const merchantId=identity?.merchantId, storeId=identity?.store.id;
  const subscriptions = useMemo(() => [
    {table:"merchants" as const,filter:`owner_user_id=eq.${ownerId}`},
    {table:"money_invoices" as const,filter:`owner_id=eq.${ownerId}`},
    ...(merchantId && storeId ? [{table:"stores" as const,filter:`merchant_id=eq.${merchantId}`},
      {table:"merchant_terms" as const,filter:`merchant_id=eq.${merchantId}`},
      ...(["store_orders","products","store_offers"] as const).map(table=>({table,filter:`store_id=eq.${storeId}`}))] : [])
  ], [ownerId,merchantId,storeId]);
  const live=useOrderRealtime({channelName:`merchant-home:${ownerId}`,enabled:true,subscriptions,onChange:()=>refresh("change")});
  useEffect(()=>{
    const delay=snapshot?.eligibility.recheckDelay;
    if(delay==null)return;
    const timer=setTimeout(()=>void refresh("change"),delay);
    return ()=>clearTimeout(timer);
  },[snapshot?.loadedAt,snapshot?.eligibility.recheckDelay,refresh]);
  const counts = snapshot?.counts;
  const actions = merchantHomeActions(state);
  const approved = identity?.store.status === "accepted" && identity.merchantStatus === "accepted";
  const needsCompletion = identity?.store.status === "changes_requested" || identity?.merchantStatus === "changes_requested";
  const noStore = !identity && !busy && !error;
  const subscriptionIssue = eligibility?.reason.startsWith("subscription_") === true;
  const reviewStore = eligibility?.reason === "approval" || needsCompletion;
  const unavailableLabels = {
    ready: "يستقبل الطلبات", approval: needsCompletion ? "بيانات المتجر تحتاج استكمالًا" : "الاعتماد غير مكتمل",
    subscription_unavailable: "اشتراك المتجر غير متوفر", subscription_unpaid: "فاتورة الاشتراك غير مسددة",
    subscription_not_started: "الاشتراك لم يبدأ بعد", subscription_expired: "الاشتراك منتهٍ",
    unavailable: "استقبال الطلبات غير متاح",
  };
  const cellBasis = Math.max(84, 84 * fontScale);
  const sectionNames = noStore ? ["identity", "empty"] : ["identity", "orders", "finance", "catalog"];
  const allMeasured = sectionNames.every(name => sectionHeights[name] > 0);
  const naturalHeight = allMeasured ? sectionNames.reduce((sum, name) => sum + sectionHeights[name], 0) : 0;
  const sectionGap = dashboardSectionGap(viewportHeight, naturalHeight, sectionNames.length, fontScale);
  const financeWidth = Math.min(width, MaxContentWidth) - LayoutSpacing.pageGutter * 2 - Spacing.three * 2;
  const longestAmount = Math.max(snapshot?.finance?.payable.length ?? 0, snapshot?.finance?.receivable.length ?? 0);
  const twoMoneyColumns = financeWidth >= 260 * fontScale && longestAmount <= 12;


  return <View onLayout={event => setViewportHeight(Math.ceil(event.nativeEvent.layout.height))} style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={[styles.content,{gap:sectionGap}]} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={() => void refreshManually()}
        tintColor={colors.primary} colors={[colors.primary]} />}>
      <View onLayout={measureSection("identity")} style={styles.identity}>
        <View style={styles.nameRow}>
          <View style={[styles.storeIdentity,{flexBasis:140*fontScale}]}>
            <Text style={[styles.name, { color: colors.text }]}>{identity?.store.name ?? (busy ? "جارٍ تحميل المتجر…" : "متجرك")}</Text>
            <LiveStatus state={live} compact hideTimestamp updatedAt={snapshot?.loadedAt} busy={busy} textScale={fontScale}/>
          </View>
          <View style={[styles.storeStates,{flexBasis:140*fontScale}]}>
            {identity ? <View accessible accessibilityLabel={`اعتماد المتجر: ${merchantStoreStatusLabels[identity.store.status]}`} style={[styles.approval,{backgroundColor:identity.store.status==="accepted"?colors.successSurface:colors.surfaceSecondary}]}>
              <Text style={[styles.approvalText,{color:identity.store.status==="accepted"?colors.successForeground:colors.textSecondary}]}>{merchantStoreStatusLabels[identity.store.status]}</Text>
            </View> : null}
        <View style={styles.availability}>
          <View style={styles.availabilityText}>
            <Text style={[styles.statusTitle, { color: eligibility?.eligible ? colors.successForeground : eligibility ? colors.warningForeground : colors.textSecondary }]}>
              {eligibility ? unavailableLabels[eligibility.reason] : busy ? "جارٍ التحقق من المتجر…" : "حالة المتجر غير مؤكدة"}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="تفاصيل حالة استقبال الطلبات" onPress={() => void dialog.alert("استقبال الطلبات", eligibility ? eligibilityReasons[eligibility.reason] : "لم نتمكن من تأكيد أهلية المتجر. حدّث البيانات وأعد المحاولة.")}
            style={styles.detailButton}><AppIcon name="information-circle-outline" size={20} color={colors.textSecondary}/></Pressable>

        </View>

          </View>
        </View>
          {eligibility && !eligibility.eligible && (reviewStore || subscriptionIssue) ? <View style={styles.fullWidth}><AppButton title={reviewStore ? "مراجعة معلومات المتجر" : "مراجعة فواتير الاشتراك"} variant="outline"
            onPress={() => reviewStore ? router.push("/merchant/store-info") : router.push({ pathname: "/merchant/finance", params: { search: "SUB-" } })}/></View> : null}
      {error ? <View style={[styles.message, { backgroundColor: colors.errorSurface, borderColor: colors.errorBorder }]}>
        <Text style={[styles.body, { color: colors.errorForeground }]}>
          {snapshot ? "تعذر تحديث الملخص. الأرقام المعروضة من آخر تحميل ناجح." : "تعذر تحميل ملخص المتجر. لم نتمكن من تأكيد الأعداد."}
        </Text>
        <AppButton design="refined" title="إعادة المحاولة" variant="outline" loading={busy} onPress={() => void refreshManually()} />
      </View> : null}

      </View>

      {noStore ? <View onLayout={measureSection("empty")} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <AppIcon name="storefront-outline" size={28} color={colors.textSecondary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>لا يوجد متجر مرتبط بهذا الحساب</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>لن تظهر أدوات الإضافة قبل توفر متجر معتمد. اسحب لتحديث حالة المتجر.</Text>
      </View> : <>
        <View onLayout={measureSection("orders")} style={styles.orderSection}>
        <View style={styles.sectionHead}>
          <Text accessibilityRole="header" style={[styles.sectionTitle,{color:colors.text}]}>طلبات متجرك</Text>
          <Pressable accessibilityRole="button" onPress={()=>router.push("/merchant/orders")} style={styles.textAction}><Text style={[styles.body,{color:colors.primary}]}>عرض الكل</Text></Pressable>
        </View>
        <View style={styles.orderGrid}>
          <View style={[styles.orderCell,{flexBasis:cellBasis}]}><HomeSummary compact title="جديدة" count={counts?.awaitingReview} description="مراجعة الطلبات الجديدة" tone="warning" disabled={!identity} onPress={()=>router.push({pathname:"/merchant/orders",params:{filter:"awaiting_review"}})}/></View>
          <View style={[styles.orderCell,{flexBasis:cellBasis}]}><HomeSummary compact title="قيد التجهيز" count={counts?.preparing} description="متابعة تجهيز الطلبات" disabled={!identity} onPress={()=>router.push({pathname:"/merchant/orders",params:{filter:"preparing"}})}/></View>
          <View style={[styles.orderCell,{flexBasis:cellBasis}]}><HomeSummary compact title="جاهزة للاستلام" count={counts?.readyForPickup} description="طلبات جاهزة ليستلمها السائق" tone="success" disabled={!identity} onPress={()=>router.push({pathname:"/merchant/orders",params:{filter:"ready_for_pickup"}})}/></View>
        </View>
        </View>
        <Pressable onLayout={measureSection("finance")} accessibilityRole="button" accessibilityHint="يفتح حسابك وفواتيرك المالية دون تنفيذ عملية" onPress={()=>router.push("/merchant/finance")} style={({pressed})=>[styles.finance,{backgroundColor:pressed?colors.surfacePressed:colors.surface,borderColor:colors.border}]}>
          <View style={styles.financeHeading}>
            <AppIcon name="wallet-outline" size={20} color={colors.primary}/>
            <Text style={[styles.sectionTitle,{color:colors.text,flexGrow:1}]}>الحساب المالي</Text>
          <View style={styles.financeLink}><Text style={[styles.body,{color:colors.primary}]}>فتح المالية</Text><AppIcon name="chevron-back-outline" size={18} color={colors.primary}/></View>
          </View>
          <View style={[styles.financeValues,{flexDirection:twoMoneyColumns?"row-reverse":"column"}]}>
            <View style={[styles.financeValue,{flexBasis:twoMoneyColumns?0:"auto"}]}>
              <Text style={[styles.financeLabel,{color:colors.textSecondary}]}>مستحق لك من المنصة</Text>
              {snapshot?.finance ? <FinancialAmount amount={snapshot.finance.payable}/> : <Text style={[styles.body,{color:colors.textSecondary}]}>—</Text>}
            </View>
            <View accessible={false} style={{backgroundColor:colors.border,alignSelf:"stretch",width:twoMoneyColumns?1:"100%",height:twoMoneyColumns?undefined:1}}/>
            <View style={[styles.financeValue,{flexBasis:twoMoneyColumns?0:"auto"}]}>
              <Text style={[styles.financeLabel,{color:colors.textSecondary}]}>مطلوب منك دفعه للمنصة</Text>
              {snapshot?.finance ? <FinancialAmount amount={snapshot.finance.receivable}/> : <Text style={[styles.body,{color:colors.textSecondary}]}>—</Text>}
            </View>
          </View>
          {snapshot?.financeError || error ? <Text style={[styles.body,{color:colors.warningForeground}]}>{snapshot?.finance ? "تعذر تحديث المالية؛ المبالغ من آخر قراءة ناجحة." : "تعذر تحميل المبالغ. افتح المالية أو أعد التحديث."}</Text> : null}
        </Pressable>

        <View onLayout={measureSection("catalog")} style={styles.catalog}>
          <View style={styles.catalogHeading}>
            <Text accessibilityRole="header" style={[styles.sectionTitle,{color:colors.text,flexGrow:1}]}>المنتجات والعروض</Text>
            <Text style={[styles.catalogMeta,{color:colors.textSecondary}]}>{counts ? `${counts.products.toLocaleString("ar-SY")} منتج · ${counts.activeOffers.toLocaleString("ar-SY")} عرض نشط` : "جارٍ تحميل الكتالوج…"}</Text>
          </View>
          <View style={styles.actionRow}>
            <View style={[styles.action,{flexBasis:Math.max(140,140*fontScale)}]}><AppButton title="إضافة منتج" icon="add-outline" variant="secondary" disabled={!actions.addProduct} onPress={()=>router.push("/merchant/product-editor")}/></View>
            <View style={[styles.action,{flexBasis:Math.max(140,140*fontScale)}]}><AppButton title="إضافة عرض" icon="pricetag-outline" variant="outline" disabled={!actions.addOffer} onPress={()=>router.push("/merchant/offer-editor")}/></View>
          </View>
          {identity && !approved ? <Text style={[styles.body,{color:colors.textSecondary}]}>تتاح الإضافة بعد اعتماد التاجر والمتجر.</Text> : error ? <Text style={[styles.body,{color:colors.textSecondary}]}>حدّث البيانات للتحقق من إتاحة الإضافة.</Text> : counts?.availableProducts===0 ? <Text style={[styles.body,{color:colors.textSecondary}]}>أضف منتجًا معروضًا لإنشاء عرض.</Text> : null}
        </View>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Role layout owns safe areas and bottom-nav clearance.
  content: { width:"100%", maxWidth:MaxContentWidth, alignSelf:"center", padding:LayoutSpacing.pageGutter, paddingBottom:Spacing.four, gap:Spacing.two },
  identity: { gap:Spacing.one },
  nameRow: { flexDirection:"row-reverse", flexWrap:"wrap", alignItems:"flex-start", gap:Spacing.two },
  storeIdentity: { flexGrow:1, flexShrink:1, minWidth:0 },
  storeStates: { flexGrow:1, flexShrink:1, minWidth:0, alignItems:"flex-end", gap:Spacing.one },
  name: { ...Typography.sectionTitle, textAlign:"right", flexShrink:1 },
  approval: { borderRadius:Radius.full, paddingHorizontal:Spacing.two, paddingVertical:Spacing.one },
  approvalText: { ...Typography.caption, textAlign:"right" },
  finance: { borderWidth:1, borderRadius:Radius.md, padding:Spacing.three, gap:Spacing.two, minHeight:44 },
  availability: { alignSelf:"stretch", flexDirection:"row-reverse", alignItems:"center", gap:Spacing.one },
  availabilityText: { flexGrow:1, flexShrink:1, flexBasis:0, paddingVertical:Spacing.one },
  statusTitle: { ...Typography.bodyStrong, textAlign:"right" },
  detailButton: { minWidth:44, minHeight:44, alignItems:"center", justifyContent:"center" },
  fullWidth: { width:"100%", paddingBottom:Spacing.two },
  orderSection: { gap:Spacing.two },
  financeHeading: { flexDirection:"row-reverse", flexWrap:"wrap", alignItems:"center", gap:Spacing.two },
  financeValues: { gap:Spacing.three },
  financeValue: { flexGrow:1, flexShrink:1, minWidth:0, gap:Spacing.one },
  financeLabel: { ...Typography.label, textAlign:"right" },
  financeLink: { flexDirection:"row-reverse", alignItems:"center", justifyContent:"flex-start", gap:Spacing.one, minHeight:44 },
  sectionHead: { flexDirection:"row-reverse", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:Spacing.two },
  textAction: { minHeight:44, minWidth:64, justifyContent:"center", alignItems:"center" },
  sectionTitle: { ...Typography.cardTitle, textAlign:"right" },
  body: { ...Typography.body, textAlign:"right" },
  orderGrid: { flexDirection:"row-reverse", flexWrap:"wrap", gap:Spacing.two, alignItems:"stretch" },
  orderCell: { flexGrow:1, flexShrink:1 },
  catalog: { gap:Spacing.two },
  catalogHeading: { flexDirection:"row-reverse", flexWrap:"wrap", alignItems:"center", gap:Spacing.two },
  catalogMeta: { ...Typography.caption, textAlign:"right", flexShrink:1 },
  actionRow: { flexDirection:"row-reverse", flexWrap:"wrap", gap:Spacing.two },
  action: { flexGrow:1, flexBasis:140 },
  message: { borderWidth:1, borderRadius:Radius.md, padding:Spacing.three, gap:Spacing.two },
  card: { borderWidth:1, borderRadius:Radius.lg, padding:Spacing.three, gap:Spacing.two },
});

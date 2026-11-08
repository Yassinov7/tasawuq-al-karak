import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { LayoutSpacing, MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
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
  const { colors } = useTheme();
  const [state, setState] = useState<MerchantHomeState>(initialMerchantHomeState);
  const controller = useMemo(() => createMerchantHomeController(ownerId, setState), [ownerId]);
  useFocusEffect(useCallback(() => {
    controller.activate();
    void controller.refresh();
    return () => controller.deactivate();
  }, [controller]));

  const { identity, snapshot, busy, error } = state;
  const counts = snapshot?.counts;
  const actions = merchantHomeActions(state);
  const approved = identity?.store.status === "accepted" && identity.merchantStatus === "accepted";
  const needsCompletion = identity?.store.status === "changes_requested" || identity?.merchantStatus === "changes_requested";
  const noStore = !identity && !busy && !error;
  const noOrders = counts && counts.awaitingReview + counts.preparing + counts.readyForPickup === 0;
  const number = (value: number | undefined) => value === undefined ? "—" : new Intl.NumberFormat("ar-SY").format(value);

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={busy && Boolean(snapshot)} onRefresh={() => void controller.refresh(true)}
        tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={styles.identity}>
        <View style={styles.storeName}>
          <Text style={[styles.name, { color: colors.text }]}>{identity?.store.name ?? (busy ? "جارٍ تحميل المتجر…" : "متجرك")}</Text>
        </View>
        {identity ? <View style={[styles.badge, { backgroundColor: approved ? colors.successSurface : colors.mutedSurface }]}>
          <Text style={[styles.badgeText, { color: approved ? colors.successForeground : colors.textSecondary }]}>
            {merchantStoreStatusLabels[identity.store.status]}
          </Text>
        </View> : null}
      </View>

      {needsCompletion ? <View style={[styles.message, { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder }]}>
        <Text style={[styles.body, { color: colors.warningForeground }]}>طلب متجرك يحتاج إلى استكمال. راجع ملاحظات الإدارة في حالة طلب الانضمام.</Text>
      </View> : null}

      <View style={styles.updateLine} accessibilityLiveRegion="polite">
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {busy ? snapshot ? "جارٍ التحديث، الأرقام السابقة محفوظة" : "جارٍ تحميل ملخص المتجر" : snapshot
            ? "آخر تحديث " + new Date(snapshot.loadedAt).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" }) : ""}
        </Text>
      </View>

      {error ? <View style={[styles.message, { backgroundColor: colors.errorSurface, borderColor: colors.errorBorder }]}>
        <Text style={[styles.body, { color: colors.errorForeground }]}>
          {snapshot ? "تعذر تحديث الملخص. الأرقام المعروضة من آخر تحميل ناجح." : "تعذر تحميل ملخص المتجر. لم نتمكن من تأكيد الأعداد."}
        </Text>
        <AppButton design="refined" title="إعادة المحاولة" variant="outline" loading={busy} onPress={() => void controller.refresh(true)} />
      </View> : null}

      {noStore ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <AppIcon name="storefront-outline" size={28} color={colors.textSecondary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>لا يوجد متجر مرتبط بهذا الحساب</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>لن تظهر أدوات الإضافة قبل توفر متجر معتمد. اسحب لتحديث حالة المتجر.</Text>
      </View> : <>
        <Pressable accessibilityRole="button" accessibilityLabel="متابعة طلبات المتجر" disabled={!identity}
          onPress={() => router.push("/merchant/orders")}
          style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>متابعة الطلبات</Text>
            <AppIcon name="chevron-back-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.metrics}>
            <Metric label="طلبات جديدة" value={number(counts?.awaitingReview)} tone="warning" />
            <Metric label="قيد التحضير" value={number(counts?.preparing)} tone="info" />
            <Metric label="جاهزة للاستلام" value={number(counts?.readyForPickup)} tone="success" />
          </View>
          {noOrders ? <Text style={[styles.body, { color: colors.textSecondary }]}>لا توجد طلبات تحتاج متابعة الآن.</Text> : null}
        </Pressable>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>ملخص الكتالوج</Text>
          <View style={styles.metrics}>
            <Metric label="إجمالي المنتجات" value={number(counts?.products)} icon="cube-outline" />
            <Metric label="عروض نشطة الآن" value={number(counts?.activeOffers)} icon="pricetags-outline" />
          </View>
          {counts?.products === 0 ? <Text style={[styles.body, { color: colors.textSecondary }]}>كتالوجك فارغ. ابدأ بإضافة أول منتج ليظهر ضمن متجرك.</Text> : null}
        </View>

        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>إجراءات سريعة</Text>
          <View style={styles.actionRow}>
            <View style={styles.action}><AppButton design="refined" title="إضافة منتج" icon="add-outline" disabled={!actions.addProduct}
              onPress={() => router.push("/merchant/product-editor")} /></View>
            <View style={styles.action}><AppButton design="refined" title="إضافة عرض" icon="pricetag-outline" variant="outline" disabled={!actions.addOffer}
              onPress={() => router.push("/merchant/offer-editor")} /></View>
          </View>
          {identity && !approved ? <Text style={[styles.body, { color: colors.textSecondary }]}>تتاح الإضافة بعد اعتماد حساب التاجر والمتجر.</Text>
            : counts?.availableProducts === 0 ? <Text style={[styles.body, { color: colors.textSecondary }]}>إنشاء عرض يحتاج إلى منتج معروض واحد على الأقل.</Text> : null}
        </View>
      </>}
    </ScrollView>
  </View>;
}

function Metric({ label, value, tone, icon }: {
  label: string; value: string; tone?: "warning" | "info" | "success";
  icon?: React.ComponentProps<typeof AppIcon>["name"];
}) {
  const { colors } = useTheme();
  const background = tone === "warning" ? colors.warningSurface : tone === "info" ? colors.infoSurface : tone === "success" ? colors.successSurface : colors.surfaceSecondary;
  const foreground = tone === "warning" ? colors.warningForeground : tone === "info" ? colors.infoForeground : tone === "success" ? colors.successForeground : colors.text;
  return <View style={[styles.metric, { backgroundColor: background }]}>
    {icon ? <AppIcon name={icon} size={20} color={colors.primary} /> : null}
    <Text style={[styles.metricValue, { color: foreground }]}>{value}</Text>
    <Text style={[styles.metricLabel, { color: foreground }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Layout owns Header, SafeArea and BottomNav clearance; only visual spacing here.
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: LayoutSpacing.pageGutter, paddingBottom: Spacing.six, gap: LayoutSpacing.sectionGap },
  identity: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: Spacing.two },
  storeName: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  name: { ...Typography.sectionTitle, textAlign: "right" },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  badgeText: { ...Typography.label, textAlign: "right" },
  updateLine: { minHeight: 24, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two },
  caption: { ...Typography.caption, textAlign: "right", flexShrink: 1 },
  message: { borderWidth: 1, borderRadius: Radius.md, padding: LayoutSpacing.compactCardPadding, gap: Spacing.two },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: LayoutSpacing.cardPadding, gap: Spacing.three },
  sectionHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  sectionTitle: { ...Typography.cardTitle, textAlign: "right", flexShrink: 1 },
  body: { ...Typography.body, textAlign: "right" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  metric: { flexGrow: 1, flexBasis: 80, minWidth: 80, minHeight: 98, borderRadius: Radius.md, paddingHorizontal: Spacing.two, paddingVertical: Spacing.three, gap: Spacing.one, alignItems: "center", justifyContent: "center" },
  metricValue: { ...Typography.metric, textAlign: "center" },
  metricLabel: { ...Typography.body, textAlign: "center" },
  quickActions: { gap: Spacing.three },
  actionRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: 140 },
});

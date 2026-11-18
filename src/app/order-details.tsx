import { userErrorMessage } from "@/lib/user-error-message";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { useReadScope } from "@/hooks/useReadScope";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { DeliveryTracking, OrderSuborderTracking } from "@/components/orders/OrderTracking";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cancelCustomerOrder, formatCurrency, getCustomerOrder, type CustomerOrderView } from "@/lib/customer-orders";
import { customerDeliveryCompleted } from "@/lib/order-progress";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";

const customerStatusLabels: Record<CustomerOrderView["status"], string> = {
  submitted: "أُرسل الطلب للمتاجر",
  in_progress: "قيد التجهيز",
  ready_for_delivery: "جاهز لاستلام السائق",
  out_for_delivery: "قيد التوصيل",
  delivered: "تم التسليم",
  partially_cancelled: "إلغاء جزئي",
  cancelled: "أُلغي الطلب",
};

const customerStatusIcons: Record<CustomerOrderView["status"], React.ComponentProps<typeof AppIcon>["name"]> = {
  submitted: "receipt-outline",
  in_progress: "time-outline",
  ready_for_delivery: "checkmark-circle-outline",
  out_for_delivery: "bicycle-outline",
  delivered: "checkmark-done-outline",
  partially_cancelled: "alert-circle-outline",
  cancelled: "close-circle-outline",
};

function customerStatusTone(status: CustomerOrderView["status"], colors: ReturnType<typeof useTheme>["colors"]) {
  if (status === "cancelled" || status === "partially_cancelled") {
    return { foreground: colors.error, background: `${colors.error}18` };
  }
  if (status === "submitted" || status === "in_progress" || status === "out_for_delivery") {
    return { foreground: colors.accent, background: colors.accentLight };
  }
  return { foreground: colors.primary, background: colors.primaryLight };
}

type OrderDetailsSnapshot = { order: CustomerOrderView; selectedStoreOrderId: string | null; scrollOffset: number };
const orderDetailsSnapshots = new Map<string, OrderDetailsSnapshot>();

export default function OrderDetailsScreen() {
  const {user}=useAuth();
  const {id}=useLocalSearchParams<{id?:string}>();
  return <OrderDetailsContent key={`${user?.id ?? "guest"}:${id}`}/>;
}
function OrderDetailsContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
  }>();

  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user } = useAuth();

  const orderId = typeof params.id === "string" ? params.id : "";
  const snapshotKey = `${user?.id ?? "guest"}:${orderId}`;
  const initialSnapshot = orderDetailsSnapshots.get(snapshotKey);
  const [order, setOrder] = useState<CustomerOrderView | null>(initialSnapshot?.order ?? null);
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStoreOrderId, setSelectedStoreOrderId] = useState<string | null | undefined>(initialSnapshot ? initialSnapshot.selectedStoreOrderId : undefined);
  const orderStatusTone = order ? customerStatusTone(order.status, colors) : null;
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(initialSnapshot?.scrollOffset ?? 0);
  const restoredScrollRef = useRef(false);

  const storeIds = useMemo(() => order?.stores.map(({ storeOrder }) => storeOrder.store_id) ?? [], [order]);
  const { logos } = useCustomerStoreLogos(storeIds, true, true);
  const effectiveSelectedStoreOrderId = useMemo(() => {
    const first = order?.stores[0]?.storeOrder.id ?? null;
    if (selectedStoreOrderId === undefined) return first;
    if (selectedStoreOrderId && !order?.stores.some(({ storeOrder }) => storeOrder.id === selectedStoreOrderId)) return first;
    return selectedStoreOrderId;
  }, [order, selectedStoreOrderId]);

  const reads=useReadScope(`${user?.id}:${orderId}`);
  const refresh = useCallback(async () => {
    if (!orderId) {
      setError("معرّف الطلب غير صالح.");
      setLoading(false);
      return;
    }
    const epoch=reads.begin();
    try {
      const next=await getCustomerOrder(orderId);if(reads.current(epoch)){setOrder(next);setError(null);}
    } catch (cause) {
      if(!reads.current(epoch))return;
      setError(userErrorMessage(cause, "تعذر تحميل تفاصيل الطلب."));
    } finally {
      if (reads.current(epoch)) { setLoading(false); setRefreshing(false); }
    }
  }, [orderId,reads]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!order) return;
    orderDetailsSnapshots.set(snapshotKey, { order, selectedStoreOrderId: effectiveSelectedStoreOrderId, scrollOffset: scrollOffsetRef.current });
  }, [effectiveSelectedStoreOrderId, order, snapshotKey]);

  const realtimeSubscriptions = useMemo(
    () => orderId ? [
      { table: "customer_orders" as const, filter: `id=eq.${orderId}` },
      { table: "store_orders" as const, filter: `customer_order_id=eq.${orderId}` },
      { table: "delivery_tasks" as const, filter: `customer_order_id=eq.${orderId}` },
    ] : [],
    [orderId],
  );
  const refreshFromRealtime = useCallback(() => {
    return refresh();
  }, [refresh]);
  useOrderRealtime({
    channelName: `customer-order:${orderId}`,
    enabled: Boolean(user && orderId),
    subscriptions: realtimeSubscriptions,
    onChange: refreshFromRealtime,
  });

  const displayOrderId = order ? (order.c3?.references[`ORD:${order.id}`] ?? "مرجع الطلب غير متاح") : "";
  const canCancel = Boolean(
    order &&
    order.stores.length > 0 &&
    order.stores.every(({ storeOrder }) =>
      ["awaiting_review", "rejected", "cancelled"].includes(storeOrder.status),
    ),
  );
  const shouldShowDeliveryStatus = Boolean(
    order?.deliveryTask,
  );

  const handleCancelOrder = async () => {
    if (cancelling) return;

    setCancelling(true);
    setError(null);
    try {
      await cancelCustomerOrder(orderId);
      setCancelModalVisible(false);
      await refresh();
    } catch (cause) {
      setError(userErrorMessage(cause, "تعذر إلغاء الطلب."));
    } finally {
      setCancelling(false);
    }
  };

  if ((loading || refreshing) && !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} mode="customer" />
        <LoadingSkeleton label="جارٍ تحميل تفاصيل الطلب"/>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} mode="customer" />
        <View style={{ padding: Spacing.four, gap: Spacing.three }}>
          <Text style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }}>
            {error ?? "لم يتم العثور على الطلب أو لا تملك صلاحية عرضه."}
          </Text>
          {error ? <AppButton title="إعادة المحاولة" variant="outline" onPress={() => {setRefreshing(true);void refresh();}} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} mode="customer" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={120}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          const snapshot = orderDetailsSnapshots.get(snapshotKey);
          if (snapshot) snapshot.scrollOffset = scrollOffsetRef.current;
        }}
        onContentSizeChange={() => {
          if (restoredScrollRef.current || scrollOffsetRef.current <= 0) return;
          restoredScrollRef.current = true;
          scrollRef.current?.scrollTo({ y: scrollOffsetRef.current, animated: false });
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handlePullRefresh()} tintColor={colors.primary} />}
      >
        <View style={[styles.orderHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumber}>
            <Text
              style={[
                styles.orderLabel,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              رقم الطلب
            </Text>

            <Text
              style={[
                styles.orderId,
                {
                  color: colors.text,
                },
              ]}
            >
              {displayOrderId}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Text
              style={[
                styles.orderLabel,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              تاريخ الطلب
            </Text>

            <Text
              style={[
                styles.date,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {new Date(order.created_at).toLocaleString("ar")}
            </Text>
          </View>
        </View>
        <View style={styles.heroFooter}>
          <View style={[styles.orderHeroStatus, { backgroundColor: orderStatusTone?.background }]}>
            <AppIcon name={customerStatusIcons[order.status]} size={17} color={orderStatusTone?.foreground ?? colors.primary} />
            <Text style={[styles.orderHeroStatusText, { color: orderStatusTone?.foreground ?? colors.primary }]}>{customerStatusLabels[order.status]}</Text>
          </View>
          <Text style={[styles.heroScope, { color: colors.textMuted }]}>{order.stores.length} {order.stores.length === 1 ? "متجر" : "متاجر"}</Text>
        </View>

        {(order.delivery_zone_name_snapshot || order.delivery_address || order.recipient_name || order.contact_phone || shouldShowDeliveryStatus) ? (
          <View style={[styles.heroDelivery, { borderTopColor: colors.border }]}>
            <View style={styles.heroDeliveryHeading}>
              <AppIcon name="location-outline" size={18} color={colors.primary} />
              <Text style={[styles.heroDeliveryTitle, { color: colors.text }]}>معلومات التوصيل</Text>
            </View>
            {order.delivery_zone_name_snapshot ? <Text style={[styles.addressPrimary, { color: colors.text }]}>{order.delivery_zone_name_snapshot}</Text> : null}
            {order.delivery_address ? <Text style={[styles.addressSecondary, { color: colors.textSecondary }]}>{order.delivery_address}</Text> : null}
            {(order.recipient_name || order.contact_phone) ? <Text style={[styles.addressSecondary, { color: colors.textMuted }]}>{[order.recipient_name, order.contact_phone].filter(Boolean).join(" · ")}</Text> : null}
            {shouldShowDeliveryStatus ? <DeliveryTracking task={order.deliveryTask} /> : null}
            {order.status === "partially_cancelled" && customerDeliveryCompleted(order) ? <Text style={[styles.addressSecondary, {color:colors.textSecondary}]}>تم تسليم المنتجات المتبقية بعد إلغاء بعض طلبات المتاجر.</Text> : null}
          </View>
        ) : null}

        <View style={[styles.heroActions, { borderTopColor: colors.border }]}>
          <AppButton title="الفاتورة" accessibilityLabel="عرض فاتورة الطلب" icon="receipt-outline" variant="outline" compact fullWidth={false} onPress={() => router.push({ pathname: "/invoice", params: { id: order.id } })} />
          {canCancel ? <AppButton title="إلغاء الطلب" icon="close-circle-outline" variant="danger" compact fullWidth={false} disabled={cancelling} loading={cancelling} onPress={() => setCancelModalVisible(true)} /> : null}
        </View>
        </View>

        <View style={styles.trackingBlock}>
          <OrderSuborderTracking
            stores={order.stores}
            selectedId={effectiveSelectedStoreOrderId}
            onSelect={setSelectedStoreOrderId}
            logos={logos}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void refresh(); }}
          />
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            ملخص الطلب
          </Text>

          {order.c3?.pricing?.current.review_required ? <Text style={{ color: colors.error, fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" }}>توجد مراجعة مطلوبة لاختلاف مبلغ الطلب؛ لم تُطبق زيادة غير مؤكدة.</Text> : null}
          {order.totals.map((total) => (
            <SummaryRow
              key={total.currency}
              label="المنتجات"
              value={formatCurrency(total.items_subtotal, total.currency)}
            />
          ))}
          <SummaryRow
            label="التوصيل"
            value={formatCurrency(order.delivery_fee, order.delivery_currency)}
          />

          <View
            style={[
              styles.summaryDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          {order.totals.map((total) => (
            <SummaryRow
              key={`total-${total.currency}`}
              label="الإجمالي"
              value={formatCurrency(total.total, total.currency)}
              total
            />
          ))}
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <AppModal
        visible={cancelModalVisible}
        title="إلغاء الطلب؟"
        message="سيُلغى الطلب إذا كانت حالته الحالية تسمح بذلك."
        icon="close-circle-outline"
        confirmText="تأكيد الإلغاء"
        cancelText="العودة"
        destructive
        busy={cancelling}
        onConfirm={() => void handleCancelOrder()}
        onCancel={() => setCancelModalVisible(false)}
      />
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  total?: boolean;
};

function SummaryRow({ label, value, total = false }: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color: colors.textSecondary,
          },
          total && {
            color: colors.text,
            fontFamily: Fonts.bold,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          {
            color: colors.text,
          },
          total && {
            color: colors.primary,
            fontFamily: Fonts.bold,
            fontSize: FontSizes.lg,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },

  orderHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  orderHero: { borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.two, padding: Spacing.three },

  orderHeroStatus: { alignSelf: "flex-end", alignItems: "center", borderRadius: Radius.full, flexDirection: "row-reverse", gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  orderHeroStatusText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
  heroFooter: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  heroScope: { fontFamily: Fonts.regular, fontSize: FontSizes.xs },
  heroDelivery: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.one, paddingTop: Spacing.two },
  heroDeliveryHeading: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one },
  heroDeliveryTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  heroActions: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, paddingTop: Spacing.two },

  orderNumber: {
    alignItems: "flex-end",
  },

  dateContainer: {
    alignItems: "flex-start",
  },

  orderLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  orderId: {
    marginTop: Spacing.one,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  date: {
    marginTop: Spacing.one,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  trackingBlock: { marginTop: Spacing.four },

  timelineCard: {
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  section: {
    marginTop: Spacing.six,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  timeline: {
    marginTop: Spacing.four,
  },

  timelineStep: {
    flexDirection: "row-reverse",
    minHeight: 42,
  },

  timelineLineContainer: {
    width: 24,
    alignItems: "center",
  },

  timelineDot: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: Radius.full,
  },

  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },

  timelineText: {
    flex: 1,
    marginRight: Spacing.three,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  stores: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },

  storeCard: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.four },

  storeHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  storeIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  storeInfo: {
    flex: 1,
    marginRight: Spacing.three,
    alignItems: "flex-end",
  },

  storeName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  storeStatus: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },

  storeStatusText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  items: {
    marginTop: Spacing.three,
  },

  item: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },

  itemQuantity: {
    width: 34,
    alignItems: "center",
  },

  quantityText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  itemName: {
    flex: 1,
    marginHorizontal: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  itemPrice: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "left",
  },
  itemPriceColumn: { alignItems: "flex-start", flexShrink: 0, marginStart: Spacing.three },
  itemOriginalPrice: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "left", textDecorationLine: "line-through" },

  summaryCard: { borderRadius: Radius.lg, borderWidth: 1, marginTop: Spacing.four, padding: Spacing.three },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
  },

  summaryLabel: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  summaryValue: {
    marginStart: Spacing.three,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "left",
  },

  summaryDivider: {
    height: 1,
    marginTop: Spacing.three,
  },

  addressPrimary: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  addressSecondary: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" },

  pressed: {
    opacity: 0.8,
  },
});

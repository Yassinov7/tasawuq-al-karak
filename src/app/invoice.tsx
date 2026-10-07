import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency, getCustomerOrder, getCustomerOrders, type CustomerOrderView } from "@/lib/customer-orders";
import { groupOrderItems } from "@/lib/order-item-groups";

export default function InvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof params.id === "string" ? params.id : null;
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const [order, setOrder] = useState<CustomerOrderView | null>(null);
  const [orders, setOrders] = useState<CustomerOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (orderId) {
        const result = await getCustomerOrder(orderId);
        if (!result) throw new Error("لم يتم العثور على الفاتورة لهذا الطلب.");
        setOrder(result);
      } else {
        setOrders(await getCustomerOrders());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات الفاتورة.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={orderId ? "الفاتورة" : "فواتيري"} showBack cartCount={itemCount} mode="customer" />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.six }} />
      ) : error ? (
        <View style={styles.feedback}>
          <Text accessibilityRole="alert" style={[styles.feedbackText, { color: colors.error }]}>{error}</Text>
          <AppButton title="إعادة المحاولة" variant="outline" onPress={() => void load()} />
        </View>
      ) : order ? (
        <InvoiceDetails order={order} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.heading, { color: colors.text }]}>فواتير طلباتك</Text>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>
            اختر طلبًا لعرض تفاصيل فاتورته.
          </Text>
          {orders.length === 0 ? (
            <View style={styles.feedback}>
              <AppIcon name="document-text-outline" size={34} color={colors.textMuted} />
              <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>لا توجد طلبات لها فواتير بعد.</Text>
            </View>
          ) : orders.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push({ pathname: "/invoice", params: { id: item.id } })}
              style={({ pressed }) => [
                styles.orderCard,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`عرض فاتورة الطلب ${item.order_number}`}
            >
              <View style={styles.orderText}>
                <Text style={[styles.orderNumber, { color: colors.text }]}>طلب رقم TW-{item.order_number}</Text>
                <Text style={[styles.orderDate, { color: colors.textMuted }]}>
                  {new Date(item.created_at).toLocaleDateString("ar-SY")}
                </Text>
              </View>
              <Text style={[styles.orderTotal, { color: colors.primary }]}>
                {item.totals.map((total) => formatCurrency(total.total, total.currency)).join(" + ")}
              </Text>
              <AppIcon name="chevron-back-outline" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function InvoiceDetails({ order }: { order: CustomerOrderView }) {
  const { colors } = useTheme();
  const groupsByStore = order.stores.map((store) => ({
    ...store,
    groups: groupOrderItems(store.items),
  }));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.invoiceHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.invoiceIcon, { backgroundColor: colors.primaryLight }]}>
          <AppIcon name="document-text-outline" size={27} color={colors.primary} />
        </View>
        <Text style={[styles.heading, { color: colors.text }]}>فاتورة الطلب</Text>
        <Text style={[styles.invoiceNumber, { color: colors.primary }]}>TW-{order.order_number}</Text>
        <Text style={[styles.orderDate, { color: colors.textMuted }]}>
          {new Date(order.created_at).toLocaleString("ar-SY")}
        </Text>
      </View>

      {groupsByStore.map((store) => (
        <View key={store.storeOrder.id} style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.storeHeader}>
            <AppIcon name="storefront-outline" size={20} color={colors.primary} />
            <Text style={[styles.storeName, { color: colors.text }]}>{store.storeName}</Text>
          </View>
          {store.groups.map((group) => (
            <View key={group.id} style={[styles.itemGroup, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={styles.groupTop}>
                <View style={styles.groupName}>
                  <Text style={[styles.itemName, { color: colors.text }]}>
                    {group.offerTitle ?? group.items[0].product_title_snapshot}
                  </Text>
                  {group.offerDescription ? (
                    <Text style={[styles.offerDescription, { color: colors.accent }]}>{group.offerDescription}</Text>
                  ) : (
                    <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                      {group.items[0].quantity} {group.items[0].selling_unit_snapshot}
                    </Text>
                  )}
                </View>
                <Text style={[styles.groupTotal, { color: colors.primary }]}>
                  {formatCurrency(group.finalTotal, group.currency)}
                </Text>
              </View>
              {group.offerTitle ? group.items.map((item) => (
                <Text key={item.id} style={[styles.bundleItem, { color: colors.textSecondary }]}>
                  {item.product_title_snapshot} · {item.quantity} {item.selling_unit_snapshot}
                </Text>
              )) : null}
              {group.originalTotal > group.finalTotal ? (
                <Text style={[styles.savings, { color: colors.textMuted }]}>
                  قبل العرض: {formatCurrency(group.originalTotal, group.currency)}
                </Text>
              ) : null}
            </View>
          ))}
          {store.storeOrder.status === "cancelled" || store.storeOrder.status === "rejected" ? (
            <Text style={[styles.storeStatus, { color: colors.error }]}>تم إلغاء هذا الجزء من الطلب</Text>
          ) : null}
        </View>
      ))}

      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>ملخص الفاتورة</Text>
        {order.totals.map((total) => (
          <SummaryRow key={total.currency} label={`المنتجات · ${total.currency}`} value={formatCurrency(total.items_subtotal, total.currency)} />
        ))}
        <SummaryRow label="رسوم التوصيل" value={formatCurrency(order.delivery_fee, order.delivery_currency)} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {order.totals.map((total) => (
          <SummaryRow key={`total-${total.currency}`} label={`الإجمالي · ${total.currency}`} value={formatCurrency(total.total, total.currency)} total />
        ))}
      </View>

      <View style={[styles.deliveryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppIcon name="location-outline" size={20} color={colors.primary} />
        <View style={styles.deliveryText}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>عنوان التوصيل</Text>
          <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
            {order.recipient_name} · {order.contact_phone}
          </Text>
          <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
            {order.delivery_address} · {order.delivery_zone_name_snapshot}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function SummaryRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: total ? colors.text : colors.textSecondary, fontFamily: total ? Fonts.bold : Fonts.regular }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: total ? colors.primary : colors.text, fontFamily: total ? Fonts.bold : Fonts.medium }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.ten, gap: Spacing.three },
  heading: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" },
  subheading: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right", marginBottom: Spacing.one },
  feedback: { alignItems: "center", gap: Spacing.three, padding: Spacing.five },
  feedbackText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "center" },
  orderCard: { alignItems: "center", borderWidth: 1, borderRadius: Radius.lg, flexDirection: "row-reverse", gap: Spacing.three, minHeight: 74, padding: Spacing.three },
  orderText: { flex: 1, gap: Spacing.one },
  orderNumber: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  orderDate: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  orderTotal: { fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  invoiceHeader: { alignItems: "center", borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.one, padding: Spacing.five },
  invoiceIcon: { alignItems: "center", borderRadius: Radius.full, height: 56, justifyContent: "center", marginBottom: Spacing.two, width: 56 },
  invoiceNumber: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md },
  storeCard: { borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.two, padding: Spacing.three },
  storeHeader: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, paddingBottom: Spacing.one },
  storeName: { fontFamily: Fonts.bold, fontSize: FontSizes.md },
  itemGroup: { borderRadius: Radius.md, gap: Spacing.one, padding: Spacing.three },
  groupTop: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two, justifyContent: "space-between" },
  groupName: { flex: 1, gap: Spacing.one },
  itemName: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  offerDescription: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" },
  itemMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 20, textAlign: "right" },
  groupTotal: { fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  bundleItem: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  savings: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", textDecorationLine: "line-through" },
  storeStatus: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" },
  summaryCard: { borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.two, padding: Spacing.four },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  summaryRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  summaryLabel: { fontSize: FontSizes.sm },
  summaryValue: { fontSize: FontSizes.sm },
  divider: { height: 1, marginVertical: Spacing.one },
  deliveryCard: { alignItems: "flex-start", borderRadius: Radius.xl, borderWidth: 1, flexDirection: "row-reverse", gap: Spacing.three, padding: Spacing.four },
  deliveryText: { flex: 1, gap: Spacing.one },
});

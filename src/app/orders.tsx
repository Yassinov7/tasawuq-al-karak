import { LoadingSkeleton, RefreshStatus } from "@/components/ui/LoadingState";
import { useReadScope } from "@/hooks/useReadScope";
import { userErrorMessage } from "@/lib/user-error-message";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import {
  formatCurrency,
  getCustomerOrdersPage,
  type CustomerOrderView,
} from "@/lib/customer-orders";
import { groupOrderItems } from "@/lib/order-item-groups";

type OrderStatus = CustomerOrderView["status"];

type OrderFilter = "all" | "active" | "completed" | "cancelled";

type Order = {
  id: string;
  displayId: string;
  storeNames: string;
  itemCount: number;
  total: string;
  date: string;
  status: OrderStatus;
};

type OrdersSnapshot = {
  orders: Order[];
  hasMore: boolean;
  filter: OrderFilter;
  searchText: string;
  query: string;
  scrollOffset: number;
};

const ORDERS_PAGE_SIZE = 12;
const orderSnapshots = new Map<string, OrdersSnapshot>();

function toOrder(row: CustomerOrderView): Order {
  return {
    id: row.id,
    displayId: row.c3?.references[`ORD:${row.id}`] ?? "مرجع الطلب غير متاح",
    storeNames: row.stores.map((store) => store.storeName).join("، "),
    itemCount: row.stores.reduce(
      (count, store) => count + groupOrderItems(store.items).length,
      0,
    ),
    total: row.totals[0]
      ? formatCurrency(row.totals[0].total, row.totals[0].currency)
      : "غير متاح",
    date: new Intl.DateTimeFormat("ar-SY", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(row.created_at)),
    status: row.status,
  };
}

const statusIcons: Record<
  OrderStatus,
  React.ComponentProps<typeof AppIcon>["name"]
> = {
  submitted: "time-outline",
  in_progress: "time-outline",
  ready_for_delivery: "checkmark-circle-outline",
  out_for_delivery: "bicycle-outline",
  delivered: "checkmark-done-outline",
  partially_cancelled: "alert-circle-outline",
  cancelled: "close-circle-outline",
};

const statusLabels: Record<OrderStatus, string> = {
  submitted: "أُرسل الطلب للمتاجر",
  in_progress: "قيد التجهيز",
  ready_for_delivery: "جاهز لاستلام السائق",
  out_for_delivery: "قيد التوصيل",
  delivered: "تم التسليم",
  partially_cancelled: "إلغاء جزئي",
  cancelled: "أُلغي الطلب",
};

export default function OrdersScreen() {
  const { user } = useAuth();
  return <OrdersContent key={user?.id ?? "guest"} />;
}
function OrdersContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user } = useAuth();
  const scope = user?.id ?? "guest";
  const initialSnapshot = orderSnapshots.get(scope);

  const [orders, setOrders] = useState<Order[]>(initialSnapshot?.orders ?? []);
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>(
    initialSnapshot?.filter ?? "all",
  );
  const [searchText, setSearchText] = useState(initialSnapshot?.searchText ?? "");
  const [query, setQuery] = useState(initialSnapshot?.query ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialSnapshot?.hasMore ?? true);
  const ordersRef = useRef(orders);
  const readRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const criteriaRef = useRef({ query: initialSnapshot?.query ?? "", filter: initialSnapshot?.filter ?? "all" as OrderFilter });
  const scrollRef = useRef<FlatList<Order>>(null);
  const scrollOffsetRef = useRef(initialSnapshot?.scrollOffset ?? 0);
  const restoredScrollRef = useRef(false);
  const initialReadStartedRef = useRef(false);

  const reads = useReadScope(user?.id ?? "guest");
  const readOrders = useCallback(
    (append = false, criteria = criteriaRef.current) => {
      const requestKey = JSON.stringify([criteria.query, criteria.filter, append ? ordersRef.current.length : 0]);
      if (readRef.current?.key === requestKey) return readRef.current.promise;
      const epoch = reads.begin();
      const offset = append ? ordersRef.current.length : 0;
      const limit = append
        ? ORDERS_PAGE_SIZE
        : Math.max(ORDERS_PAGE_SIZE, ordersRef.current.length);
      const task = (async () => {
        try {
          const rows = await getCustomerOrdersPage(offset, limit, criteria.query, criteria.filter);
          if (!reads.current(epoch)) return;
          const mapped = rows.map(toOrder);
          const next = append
            ? [
                ...ordersRef.current,
                ...mapped.filter(
                  (row) =>
                    !ordersRef.current.some((current) => current.id === row.id),
                ),
              ]
            : mapped;
          ordersRef.current = next;
          setOrders(next);
          setHasMore(rows.length === limit);
          setError(null);
        } catch (cause) {
          if (!reads.current(epoch)) return;
          setError(userErrorMessage(cause, "تعذر تحميل طلباتك."));
        } finally {
          if (reads.current(epoch)) {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
          }
        }
      })().finally(() => {
        if (readRef.current?.promise === task) readRef.current = null;
      });
      readRef.current = { key: requestKey, promise: task };
      return task;
    },
    [reads],
  );

  const refresh = useCallback(() => readOrders(false, criteriaRef.current), [readOrders]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || refreshing || loading) return;
    setLoadingMore(true);
    await readOrders(true, criteriaRef.current);
  }, [hasMore, loading, loadingMore, readOrders, refreshing]);

  useEffect(() => {
    ordersRef.current = orders;
    orderSnapshots.set(scope, {
      orders,
      hasMore,
      filter: activeFilter,
      searchText,
      query,
      scrollOffset: scrollOffsetRef.current,
    });
  }, [activeFilter, hasMore, orders, query, scope, searchText]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const next = { query, filter: activeFilter };
    if (criteriaRef.current.query === next.query && criteriaRef.current.filter === next.filter) return;
    criteriaRef.current = next;
    ordersRef.current = [];
    setOrders([]);
    setHasMore(true);
    setError(null);
    setLoading(true);
    restoredScrollRef.current = true;
    scrollOffsetRef.current = 0;
    scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    void readOrders(false, next);
  }, [activeFilter, query, readOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialReadStartedRef.current) {
        initialReadStartedRef.current = true;
        void refresh();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [refresh]);

  const realtimeSubscriptions = useMemo(
    () =>
      user
        ? [
            {
              table: "customer_orders" as const,
              filter: `customer_id=eq.${user.id}`,
            },
          ]
        : [],
    [user],
  );
  const refreshFromRealtime = useCallback(() => {
    initialReadStartedRef.current = true;
    return refresh();
  }, [refresh]);
  useOrderRealtime({
    channelName: `customer-orders:${user?.id ?? "guest"}`,
    enabled: Boolean(user),
    subscriptions: realtimeSubscriptions,
    onChange: refreshFromRealtime,
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader
        title="طلباتي"
        showBack
        cartCount={itemCount}
        mode="customer"
      />

      <FlatList
        ref={scrollRef}
        style={styles.container}
        data={orders}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => (
          <CustomerOrderCard
            order={item}
            onPress={() =>
              router.push({
                pathname: "/order-details",
                params: { id: item.id },
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={120}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          const snapshot = orderSnapshots.get(scope);
          if (snapshot) snapshot.scrollOffset = scrollOffsetRef.current;
        }}
        onContentSizeChange={() => {
          if (restoredScrollRef.current || scrollOffsetRef.current <= 0) return;
          restoredScrollRef.current = true;
          scrollRef.current?.scrollToOffset({
            offset: scrollOffsetRef.current,
            animated: false,
          });
        }}
        refreshing={refreshing}
        onRefresh={() => void handlePullRefresh()}
        onEndReached={() => void handleLoadMore()}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <AppIcon name="search-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={() => setQuery(searchText.trim())}
                placeholder="ابحث برقم الطلب أو المتجر أو المنتج"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {searchText ? (
                <Pressable accessibilityRole="button" accessibilityLabel="مسح بحث الطلبات" style={styles.clearSearch} onPress={() => setSearchText("")}>
                  <AppIcon name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
              contentContainerStyle={styles.filters}
            >
              <CategoryChip
                label="الكل"
                active={activeFilter === "all"}
                onPress={() => setActiveFilter("all")}
              />
              <CategoryChip
                label="جارية"
                active={activeFilter === "active"}
                onPress={() => setActiveFilter("active")}
              />
              <CategoryChip
                label="مكتملة"
                active={activeFilter === "completed"}
                onPress={() => setActiveFilter("completed")}
              />
              <CategoryChip
                label="ملغاة"
                active={activeFilter === "cancelled"}
                onPress={() => setActiveFilter("cancelled")}
              />
            </ScrollView>
            {refreshing && orders.length > 0 ? (
              <RefreshStatus busy label="جارٍ تحديث الطلبات…" />
            ) : null}
            {error && orders.length ? (
              <View style={styles.inlineError}>
                <Text
                  accessibilityRole="alert"
                  style={[
                    styles.inlineErrorText,
                    { color: colors.errorForeground },
                  ]}
                >
                  تعذر تحديث الطلبات؛ المعروض آخر بيانات متاحة.
                </Text>
                <AppButton
                  compact
                  fullWidth={false}
                  title="إعادة المحاولة"
                  variant="outline"
                  onPress={() => {
                    setRefreshing(true);
                    void refresh();
                  }}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          (loading || refreshing) && !orders.length ? (
            <LoadingSkeleton label="جارٍ تحميل طلباتك" />
          ) : error && !orders.length ? (
            <AppEmptyState
              icon="cloud-offline-outline"
              title="تعذر تحميل الطلبات"
              description={error}
              buttonText="إعادة المحاولة"
              onButtonPress={() => {
                setRefreshing(true);
                void refresh();
              }}
            />
          ) : !query && activeFilter === "all" ? (
            <AppEmptyState
              icon="receipt-outline"
              title="لا توجد طلبات بعد"
              description="ابدأ التسوق وستظهر طلباتك هنا."
              buttonText="ابدأ التسوق"
              onButtonPress={() => router.navigate("/home")}
            />
          ) : query ? (
            <AppEmptyState
              icon="search-outline"
              title="لا توجد نتائج للبحث"
              description="جرّب رقم طلب أو اسم متجر أو منتج آخر."
              buttonText="مسح البحث"
              onButtonPress={() => setSearchText("")}
            />
          ) : (
            <AppEmptyState
              icon="filter-outline"
              title="لا توجد طلبات ضمن هذا الفلتر"
              description="جرّب فلترًا آخر أو اعرض جميع طلباتك."
              buttonText="عرض كل الطلبات"
              onButtonPress={() => setActiveFilter("all")}
            />
          )
        }
        ListFooterComponent={
          orders.length > 0 ? (
            <View style={styles.listFooter}>
              {loadingMore ? (
                <ActivityIndicator accessibilityLabel="جارٍ تحميل طلبات إضافية" size="small" color={colors.primary} />
              ) : !hasMore && orders.length >= ORDERS_PAGE_SIZE ? (
                <Text style={[styles.endText, { color: colors.textMuted }]}>
                  وصلت إلى أقدم طلب محفوظ.
                </Text>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}

function CustomerOrderCard({
  order,
  onPress,
}: {
  order: Order;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const statusColors = (() => {
    switch (order.status) {
      case "submitted":
      case "in_progress":
      case "out_for_delivery":
        return { color: colors.accent, background: colors.accentLight };
      case "ready_for_delivery":
      case "delivered":
        return { color: colors.primary, background: colors.primaryLight };
      case "partially_cancelled":
      case "cancelled":
        return { color: colors.error, background: colors.error + "18" };
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`تفاصيل الطلب ${order.displayId}`}
      style={({ pressed }) => [
        styles.orderCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRightColor: statusColors.color,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.orderTop}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderEyebrow, { color: colors.textMuted }]}>
            طلب
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.orderId, { color: colors.text }]}
          >
            {order.displayId}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.orderDate, { color: colors.textMuted }]}
          >
            {order.date}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusColors.background,
              borderColor: statusColors.color + "55",
            },
          ]}
        >
          <AppIcon
            name={statusIcons[order.status]}
            size={15}
            color={statusColors.color}
          />
          <Text style={[styles.statusText, { color: statusColors.color }]}>
            {statusLabels[order.status]}
          </Text>
        </View>
      </View>

      <View style={[styles.orderDetails, { borderColor: colors.border }]}>
        <View style={styles.storeLine}>
          <AppIcon
            name="storefront-outline"
            size={17}
            color={colors.textMuted}
          />
          <Text
            numberOfLines={2}
            style={[styles.detailText, { color: colors.textSecondary }]}
          >
            {order.storeNames || "متجر"}
          </Text>
        </View>
        <View style={[styles.itemCount, { borderColor: colors.border }]}>
          <AppIcon name="cube-outline" size={15} color={colors.textMuted} />
          <Text style={[styles.itemCountText, { color: colors.textSecondary }]}>
            {order.itemCount} عنصر
          </Text>
        </View>
      </View>

      <View style={styles.orderBottom}>
        <View style={styles.totalContainer}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
            الإجمالي النهائي
          </Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>
            {order.total}
          </Text>
        </View>
        <View style={styles.detailsAction}>
          <Text style={[styles.detailsButtonText, { color: colors.primary }]}>
            تفاصيل الطلب
          </Text>
          <View
            style={[
              styles.detailsButton,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <AppIcon name="arrow-back" size={17} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
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
    flexGrow: 1,
  },

  search: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    minHeight: ControlSizes.input,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: ControlSizes.input,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    ...RtlText,
  },
  clearSearch: {
    minWidth: ControlSizes.touch,
    minHeight: ControlSizes.touch,
    alignItems: "center",
    justifyContent: "center",
  },

  filters: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: 0,
  },

  filtersScroll: { direction: "rtl", marginBottom: 0 },
  listHeader: { paddingBottom: Spacing.three },
  itemSeparator: { height: Spacing.two },
  listFooter: { paddingTop: Spacing.three },
  inlineError: {
    alignItems: "center",
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  inlineErrorText: {
    flex: 1,
    minWidth: 180,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  orderCard: {
    borderRightWidth: 4,
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
    padding: Spacing.three,
  },

  orderTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "space-between",
  },

  orderInfo: {
    alignItems: "flex-end",
    flex: 1,
    minWidth: 0,
  },

  orderId: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  orderEyebrow: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  orderDate: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  statusBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  statusText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  orderDivider: {
    height: 1,
    marginVertical: Spacing.three,
  },

  orderDetails: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
  },

  storeLine: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row-reverse",
    gap: Spacing.one,
    minWidth: 0,
  },
  itemCount: {
    alignItems: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexDirection: "row-reverse",
    gap: Spacing.one,
    paddingLeft: Spacing.two,
  },
  itemCountText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  detailItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    minWidth: 0,
  },

  detailText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 21,
    textAlign: "right",
  },

  orderBottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "space-between",
    marginTop: Spacing.three,
  },

  totalContainer: {
    alignItems: "flex-end",
    flex: 1,
    minWidth: 130,
  },

  totalLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  totalValue: {
    marginTop: Spacing.one,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  detailsButton: {
    alignItems: "center",
    borderRadius: Radius.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },

  detailsAction: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: Spacing.one,
    minHeight: 44,
  },

  detailsButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  endText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    paddingVertical: Spacing.two,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.7,
  },
});

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getMerchantStore } from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";

type StoreOrderStatus =
  | "awaiting_review"
  | "preparing"
  | "ready_for_pickup"
  | "handed_to_driver"
  | "delivered"
  | "rejected"
  | "cancelled";

type StoreOrder = {
  id: string;
  customer_order_id: string;
  status: StoreOrderStatus;
  customer_note: string;
  rejection_reason: string | null;
  created_at: string;
  customer_orders: {
    order_number: number;
    recipient_name: string;
    contact_phone: string;
    delivery_address: string;
    created_at: string;
  };
  store_order_items: {
    product_title_snapshot: string;
    selling_unit_snapshot: string;
    quantity: number;
    unit_price_snapshot: number;
    currency: "SYP" | "USD";
    line_total: number;
  }[];
  store_order_totals: {
    currency: "SYP" | "USD";
    items_subtotal: number;
  }[];
};

const statusText: Record<StoreOrderStatus, string> = {
  awaiting_review: "بانتظار المراجعة",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام",
  handed_to_driver: "استلمه السائق",
  delivered: "تم التسليم",
  rejected: "معتذر عنه",
  cancelled: "ملغى",
};

const money = (value: number, currency: string) =>
  `${Number(value).toLocaleString("ar-SY")} ${
    currency === "USD" ? "دولار" : "ل.س"
  }`;

const formatDate = (value: string) =>
  new Date(value).toLocaleString("ar-SY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default function MerchantOrdersScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const [filter, setFilter] = useState<
    "all" | "awaiting_review" | "preparing" | "ready_for_pickup"
  >("all");

  const [rejectionTarget, setRejectionTarget] = useState<StoreOrder | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const loadOrders = useCallback(
    async (showLoading = false) => {
      if (!user) {
        setLoading(false);
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      try {
        const store = await getMerchantStore(user.id);

        if (!store) {
          setOrders([]);
          setLoadError("لم نعثر على متجر مرتبط بحسابك.");
          return;
        }

        const { data, error } = await supabase
          .from("store_orders")
          .select(
            "id,customer_order_id,status,customer_note,rejection_reason,created_at,customer_orders!inner(order_number,recipient_name,contact_phone,delivery_address,created_at),store_order_items(product_title_snapshot,selling_unit_snapshot,quantity,unit_price_snapshot,currency,line_total),store_order_totals(currency,items_subtotal)",
          )
          .eq("store_id", store.id)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        setOrders((data ?? []) as unknown as StoreOrder[]);
        setLoadError("");
      } catch {
        setLoadError(
          "تعذر تحميل الطلبات الآن. تحقق من الاتصال ثم أعد المحاولة.",
        );
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOrders(true);
    }, 0);

    if (!user) {
      return () => clearTimeout(timer);
    }

    const channel = supabase
      .channel(`merchant-orders:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_orders",
        },
        () => void loadOrders(),
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadOrders, user]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      awaiting_review: orders.filter(
        (order) => order.status === "awaiting_review",
      ).length,
      preparing: orders.filter((order) => order.status === "preparing").length,
      ready_for_pickup: orders.filter(
        (order) => order.status === "ready_for_pickup",
      ).length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    if (filter === "all") {
      return orders;
    }

    return orders.filter((order) => order.status === filter);
  }, [filter, orders]);

  const changeStatus = async (
    order: StoreOrder,
    status: "preparing" | "ready_for_pickup" | "rejected",
    reason?: string,
  ) => {
    setBusyId(order.id);

    const { error } = await supabase.rpc("update_store_order_status", {
      target_store_order: order.id,
      next_status: status,
      reason: reason ?? null,
    });

    setBusyId(null);

    if (error) {
      setFeedback({
        title: "تعذر تحديث الطلب",
        message: error.message || "حاول مرة أخرى بعد قليل.",
      });
      return false;
    }

    setRejectionTarget(null);
    setRejectionReason("");

    await loadOrders();

    setFeedback({
      title: "تم تحديث الطلب",
      message:
        status === "preparing"
          ? "تم قبول الطلب وبدء تجهيزه، وأُرسل إشعار للزبون."
          : status === "ready_for_pickup"
            ? "أصبح الطلب جاهزًا للاستلام والتوزيع على السائقين."
            : "تم تسجيل الاعتذار وإبلاغ الزبون.",
    });

    return true;
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="طلبات المتجر" mode="business" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>الطلبات</Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              تابع الطلبات الجديدة وحدث حالتها حتى تصبح جاهزة للاستلام.
            </Text>
          </View>

          <Pressable
            onPress={() => void loadOrders(true)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="تحديث الطلبات"
            style={[
              styles.refreshButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppIcon name="refresh-outline" size={19} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <OrderStat
            value={counts.awaiting_review}
            label="بانتظارك"
            icon="time-outline"
            active={counts.awaiting_review > 0}
            colors={colors}
          />

          <OrderStat
            value={counts.preparing}
            label="قيد التجهيز"
            icon="cube-outline"
            colors={colors}
          />

          <OrderStat
            value={counts.ready_for_pickup}
            label="جاهز"
            icon="checkmark-circle-outline"
            colors={colors}
          />
        </View>

        <View
          style={[
            styles.filters,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <FilterButton
            label={`الكل ${counts.all}`}
            active={filter === "all"}
            onPress={() => setFilter("all")}
            colors={colors}
          />

          <FilterButton
            label={`جديدة ${counts.awaiting_review}`}
            active={filter === "awaiting_review"}
            onPress={() => setFilter("awaiting_review")}
            colors={colors}
          />

          <FilterButton
            label={`تجهيز ${counts.preparing}`}
            active={filter === "preparing"}
            onPress={() => setFilter("preparing")}
            colors={colors}
          />

          <FilterButton
            label={`جاهزة ${counts.ready_for_pickup}`}
            active={filter === "ready_for_pickup"}
            onPress={() => setFilter("ready_for_pickup")}
            colors={colors}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />

            <Text
              style={[
                styles.centerText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              جارٍ تحميل الطلبات…
            </Text>
          </View>
        ) : loadError ? (
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.stateIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="cloud-offline-outline"
                size={27}
                color={colors.error}
              />
            </View>

            <Text
              style={[
                styles.stateTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              تعذر تحميل الطلبات
            </Text>

            <Text
              style={[
                styles.stateText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {loadError}
            </Text>

            <AppButton
              title="إعادة المحاولة"
              onPress={() => void loadOrders(true)}
            />
          </View>
        ) : filteredOrders.length === 0 ? (
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.stateIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="receipt-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.stateTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              لا توجد طلبات هنا
            </Text>

            <Text
              style={[
                styles.stateText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              ستظهر الطلبات الجديدة هنا، ويمكنك متابعتها وتحديث حالتها مباشرة.
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                colors={colors}
                busy={busyId === order.id}
                onStart={() => void changeStatus(order, "preparing")}
                onReady={() => void changeStatus(order, "ready_for_pickup")}
                onReject={() => {
                  setRejectionTarget(order);
                  setRejectionReason("");
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AppModal
        visible={Boolean(rejectionTarget)}
        title="الاعتذار عن الطلب"
        message="اكتب سببًا واضحًا ليصل للزبون ويُحفظ في سجل الطلب."
        icon="alert-circle-outline"
        confirmText="إرسال الاعتذار"
        cancelText="رجوع"
        destructive
        busy={busyId === rejectionTarget?.id}
        onCancel={() => setRejectionTarget(null)}
        onConfirm={() => {
          if (rejectionTarget && rejectionReason.trim().length >= 2) {
            void changeStatus(
              rejectionTarget,
              "rejected",
              rejectionReason.trim(),
            );
          }
        }}
      >
        <AppTextField
          label="سبب الاعتذار"
          value={rejectionReason}
          onChangeText={setRejectionReason}
          multiline
          maxLength={500}
          placeholder="مثال: أحد المنتجات غير متوفر"
        />
      </AppModal>

      <AppModal
        visible={Boolean(feedback)}
        title={feedback?.title ?? ""}
        message={feedback?.message}
        onCancel={() => setFeedback(null)}
      />
    </View>
  );
}

function OrderStat({
  value,
  label,
  icon,
  active = false,
  colors,
}: {
  value: number;
  label: string;
  icon: "time-outline" | "cube-outline" | "checkmark-circle-outline";
  active?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: active ? colors.primaryLight : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <AppIcon
        name={icon}
        size={19}
        color={active ? colors.primary : colors.textSecondary}
      />

      <Text
        style={[
          styles.statValue,
          {
            color: active ? colors.primary : colors.text,
          },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statLabel,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.filterButton,
        {
          backgroundColor: active ? colors.surface : "transparent",
          borderColor: active ? colors.border : "transparent",
        },
      ]}
    >
      <Text
        style={[
          styles.filterText,
          {
            color: active ? colors.primary : colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function OrderCard({
  order,
  colors,
  busy,
  onStart,
  onReady,
  onReject,
}: {
  order: StoreOrder;
  colors: ReturnType<typeof useTheme>["colors"];
  busy: boolean;
  onStart: () => void;
  onReady: () => void;
  onReject: () => void;
}) {
  const parent = Array.isArray(order.customer_orders)
    ? order.customer_orders[0]
    : order.customer_orders;

  const totals = Array.isArray(order.store_order_totals)
    ? order.store_order_totals
    : [];

  const items = Array.isArray(order.store_order_items)
    ? order.store_order_items
    : [];

  const statusColor =
    order.status === "awaiting_review"
      ? colors.accent
      : order.status === "rejected" || order.status === "cancelled"
        ? colors.error
        : colors.primary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: `${statusColor}18`,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: statusColor,
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color: statusColor,
              },
            ]}
          >
            {statusText[order.status]}
          </Text>
        </View>

        <View style={styles.orderMeta}>
          <Text
            style={[
              styles.orderNumber,
              {
                color: colors.text,
              },
            ]}
          >
            طلب #{parent?.order_number ?? "—"}
          </Text>

          <Text
            style={[
              styles.orderDate,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {formatDate(order.created_at)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.customerBox,
          {
            backgroundColor: colors.surfaceSecondary,
          },
        ]}
      >
        <View style={styles.infoRow}>
          <AppIcon
            name="person-outline"
            size={17}
            color={colors.textSecondary}
          />

          <Text
            style={[
              styles.infoText,
              {
                color: colors.text,
              },
            ]}
          >
            {parent?.recipient_name ?? "—"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <AppIcon name="call-outline" size={17} color={colors.textSecondary} />

          <Text
            style={[
              styles.infoText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {parent?.contact_phone ?? "—"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <AppIcon
            name="location-outline"
            size={17}
            color={colors.textSecondary}
          />

          <Text
            style={[
              styles.infoText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {parent?.delivery_address ?? "—"}
          </Text>
        </View>
      </View>

      {order.customer_note ? (
        <View
          style={[
            styles.note,
            {
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.noteTitle,
              {
                color: colors.text,
              },
            ]}
          >
            ملاحظة الزبون
          </Text>

          <Text
            style={[
              styles.noteText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {order.customer_note}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.text,
            },
          ]}
        >
          محتويات الطلب
        </Text>

        <Text
          style={[
            styles.itemsCount,
            {
              color: colors.textMuted,
            },
          ]}
        >
          {items.length} {items.length === 1 ? "منتج" : "منتجات"}
        </Text>
      </View>

      <View style={styles.items}>
        {items.map((item, index) => (
          <View
            key={`${order.id}-${index}`}
            style={[
              styles.itemRow,
              {
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.itemInfo}>
              <Text
                style={[
                  styles.itemName,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {item.product_title_snapshot}
              </Text>

              <Text
                style={[
                  styles.itemMeta,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                {item.quantity} {item.selling_unit_snapshot} ×{" "}
                {money(Number(item.unit_price_snapshot), item.currency)}
              </Text>
            </View>

            <Text
              style={[
                styles.itemTotal,
                {
                  color: colors.primary,
                },
              ]}
            >
              {money(Number(item.line_total), item.currency)}
            </Text>
          </View>
        ))}
      </View>

      {totals.map((total) => (
        <View key={total.currency} style={styles.totalRow}>
          <Text
            style={[
              styles.totalLabel,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            إجمالي المتجر · {total.currency === "USD" ? "دولار" : "ل.س"}
          </Text>

          <Text
            style={[
              styles.totalValue,
              {
                color: colors.primary,
              },
            ]}
          >
            {money(Number(total.items_subtotal), total.currency)}
          </Text>
        </View>
      ))}

      {order.rejection_reason ? (
        <View
          style={[
            styles.rejectionBox,
            {
              backgroundColor: `${colors.error}10`,
              borderColor: `${colors.error}30`,
            },
          ]}
        >
          <AppIcon name="alert-circle-outline" size={17} color={colors.error} />

          <Text
            style={[
              styles.rejectionText,
              {
                color: colors.error,
              },
            ]}
          >
            {order.rejection_reason}
          </Text>
        </View>
      ) : null}

      {order.status === "awaiting_review" ? (
        <View style={styles.actions}>
          <AppButton
            title="قبول وبدء التجهيز"
            icon="checkmark-circle-outline"
            onPress={onStart}
            loading={busy}
          />

          <AppButton
            title="الاعتذار عن الطلب"
            icon="close-circle-outline"
            variant="danger"
            onPress={onReject}
            disabled={busy}
          />
        </View>
      ) : order.status === "preparing" ? (
        <AppButton
          title="الطلب جاهز للاستلام"
          icon="cube-outline"
          onPress={onReady}
          loading={busy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.ten,
    gap: Spacing.four,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },

  topRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },

  heading: {
    flex: 1,
    alignItems: "flex-end",
    gap: Spacing.one,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "right",
  },

  refreshButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  statsRow: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
  },

  stat: {
    flex: 1,
    minHeight: 82,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: Spacing.one,
  },

  statValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  statLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
  },

  filters: {
    flexDirection: "row-reverse",
    padding: 3,
    borderWidth: 1,
    borderRadius: Radius.md,
    gap: 3,
  },

  filterButton: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.one,
  },

  filterText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },

  ordersList: {
    gap: Spacing.three,
  },

  center: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },

  centerText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  stateCard: {
    minHeight: 230,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },

  stateIcon: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  stateTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  stateText: {
    maxWidth: 460,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },

  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  orderMeta: {
    flex: 1,
    alignItems: "flex-end",
    gap: Spacing.one,
  },

  orderNumber: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  orderDate: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  statusBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },

  statusText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },

  customerBox: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
  },

  infoText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "right",
  },

  note: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },

  noteTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  noteText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "right",
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  itemsCount: {
    fontFamily: Fonts.regular,
    fontSize: 11,
  },

  items: {
    gap: 0,
  },

  itemRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  itemInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: Spacing.one,
  },

  itemName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  itemMeta: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    textAlign: "right",
  },

  itemTotal: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.two,
  },

  totalLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  totalValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  rejectionBox: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },

  rejectionText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "right",
  },

  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});

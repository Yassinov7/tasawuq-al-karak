import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DeliveryTaskCard } from "@/components/driver/DeliveryTaskCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  FontSizes,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getDriverApplication,
  getDriverAssignedTasks,
  updateDeliveryTaskStatus,
  type DriverAssignedTask,
} from "@/lib/driver-deliveries";

type OrdersView = "active" | "completed";

const taskStatusLabels: Record<DriverAssignedTask["status"], string> = {
  accepted: "بانتظار الاستلام",
  picked_up: "قيد التوصيل",
  delivered: "مكتمل",
  pending_stores: "بانتظار المتاجر",
  available: "متاح",
  cancelled: "ملغى",
};

export default function DriverOrdersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<DriverAssignedTask[]>([]);
  const [view, setView] = useState<OrdersView>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadTasks = useCallback(
    async (refresh = false) => {
      if (authLoading) return;
      if (!user) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const application = await getDriverApplication(user.id);
        if (!application || application.status !== "accepted") {
          router.replace("/application-status");
          return;
        }
        setTasks(await getDriverAssignedTasks(user.id));
      } catch {
        setError("تعذر تحميل توصيلاتك. تحقق من الاتصال ثم حاول مرة أخرى.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authLoading, router, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadTasks(), 0);
    return () => clearTimeout(timer);
  }, [loadTasks]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) =>
        view === "completed"
          ? task.status === "delivered"
          : task.status === "accepted" || task.status === "picked_up",
      ),
    [tasks, view],
  );

  const updateStatus = async (task: DriverAssignedTask) => {
    const nextStatus = task.status === "accepted" ? "picked_up" : "delivered";
    setBusyTaskId(task.id);
    setError("");
    try {
      await updateDeliveryTaskStatus(task.customer_order_id, nextStatus);
      await loadTasks(true);
    } catch {
      setError("تعذر تحديث حالة التوصيل. حدّث القائمة ثم حاول مرة أخرى.");
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="توصيلاتي" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTasks(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.container}>
          <View
            style={[
              styles.tabs,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            {(
              [
                ["active", "الجارية"],
                ["completed", "المكتملة"],
              ] as const
            ).map(([value, label]) => {
              const selected = view === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setView(value)}
                  style={[
                    styles.tab,
                    selected && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: selected ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : visibleTasks.length > 0 ? (
            visibleTasks.map((task) => {
              const active = task.status !== "delivered";
              const nextAction =
                task.status === "accepted"
                  ? { title: "تأكيد استلام الطلب", status: "picked_up" as const }
                  : task.status === "picked_up"
                    ? { title: "تأكيد تسليم الطلب", status: "delivered" as const }
                    : null;

              return (
                <DeliveryTaskCard
                  key={task.id}
                  orderNumber={task.customer_orders.order_number}
                  zoneName={task.customer_orders.delivery_zone_name_snapshot}
                  createdAt={task.created_at}
                  assignedOrder={task.customer_orders}
                  taskStatus={task.status}
                  statusLabel={taskStatusLabels[task.status]}
                  actionTitle={nextAction?.title}
                  actionIcon={
                    nextAction?.status === "delivered"
                      ? "checkmark-done-outline"
                      : "bicycle-outline"
                  }
                  actionTone={
                    nextAction?.status === "delivered" ? "success" : "accent"
                  }
                  actionLoading={busyTaskId === task.id}
                  onAction={
                    active && nextAction ? () => void updateStatus(task) : undefined
                  }
                />
              );
            })
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppIcon
                name={view === "active" ? "bicycle-outline" : "checkmark-done-outline"}
                size={28}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {view === "active"
                  ? "لا توجد توصيلات جارية"
                  : "لا توجد توصيلات مكتملة"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {view === "active"
                  ? "المهام التي تقبلها ستظهر هنا."
                  : "ستظهر هنا الطلبات التي أكملت توصيلها."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  container: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    gap: Spacing.four,
  },
  tabs: {
    flexDirection: "row-reverse",
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: Radius.lg,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  tabText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  error: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  emptyCard: {
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.six,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  emptyTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },
});

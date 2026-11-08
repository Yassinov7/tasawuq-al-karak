import { deliveryCollection } from "@/lib/delivery-collection-attempt";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { canProgressDriverCollection, driverCollectionMessage, DriverCollectionError } from "@/lib/driver-collection";
import { confirmStorePickup } from "@/lib/store-pickups";
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
  const [taskOwner, setTaskOwner] = useState<string>();
  const [view, setView] = useState<OrdersView>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyPickupId, setBusyPickupId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const readEpoch = useRef(0), owner = useRef(user?.id), actionLock = useRef(false);
  useLayoutEffect(() => {
    const invalidateReads = () => { readEpoch.current++; };
    owner.current = user?.id;
    invalidateReads();
    return () => { owner.current = undefined; invalidateReads(); };
  }, [user?.id]);

  const loadTasks = useCallback(
    async (refresh = false, background = false) => {
      if (authLoading) return;
      const epoch = ++readEpoch.current;
      const expectedUser = user?.id;
      const current = () => readEpoch.current === epoch && owner.current === expectedUser;
      if (!user) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else if (!background) setLoading(true);
      setError(""); setNotice("");

      try {
        const application = await getDriverApplication(user.id);
        if (!current()) return;
        if (!application || application.status !== "accepted") {
          router.replace("/application-status");
          return;
        }
        const rows = await getDriverAssignedTasks(user.id);
        if (current()) { setTasks(rows); setTaskOwner(expectedUser); }
      } catch {
        if (current()) {
          setTasks(previous => previous.map(task => ({ ...task, collection: { state: "unavailable" } })));
          setError("تعذر تحميل توصيلاتك ومبلغ التحصيل. تحقق من الاتصال ثم حاول مرة أخرى.");
        }
      } finally {
        if (current()) { setLoading(false); setRefreshing(false); }
      }
    },
    [authLoading, router, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadTasks(), 0);
    return () => clearTimeout(timer);
  }, [loadTasks]);

  const realtimeParents = useMemo(() => taskOwner === user?.id ? [...new Set(tasks.map(task => task.customer_order_id))].sort().join(",") : "", [tasks, taskOwner, user?.id]);
  const realtimeSubscriptions = useMemo(
    () => user ? [
      { table: "delivery_tasks" as const, filter: `driver_id=eq.${user.id}` },
      ...(realtimeParents ? realtimeParents.split(",") : []).map(id => ({ table: "store_orders" as const, filter: `customer_order_id=eq.${id}` })),
    ] : [],
    [user, realtimeParents],
  );
  const refreshFromRealtime = useCallback(() => {
    void loadTasks(false, true);
  }, [loadTasks]);
  useOrderRealtime({
    channelName: `driver-assigned-deliveries:${user?.id ?? "guest"}`,
    enabled: Boolean(user && !authLoading),
    subscriptions: realtimeSubscriptions,
    onChange: refreshFromRealtime,
  });

  const visibleTasks = useMemo(
    () =>
      (taskOwner === user?.id ? tasks : []).filter((task) =>
        view === "completed"
          ? task.status === "delivered"
          : task.status === "accepted" || task.status === "picked_up",
      ),
    [tasks, taskOwner, user?.id, view],
  );

  const updateStatus = async (task: DriverAssignedTask) => {
    const expectedUser = user?.id;
    if (!expectedUser || owner.current !== expectedUser || actionLock.current) return;
    if (!canProgressDriverCollection(task.collection)) { setError(driverCollectionMessage(task.collection)); return; }
    actionLock.current = true;
    const nextStatus = task.status === "accepted" ? "picked_up" : "delivered";
    setBusyTaskId(task.id);
    setError("");
    try {
      if (task.pickups?.state === "c4") {
        const result = await deliveryCollection(expectedUser,task.id,task.pickups.pricingVersion);
        if (owner.current !== expectedUser) return;
        if (result.state === "unknown") setError("نتيجة التسليم والتحصيل غير محسومة؛ تحقق من المحاولة السابقة قبل أي قبض آخر.");
        if (result.state === "rejected") setError("لم يُعتمد التسليم والتحصيل لهذه المحاولة؛ حدّث المهمة وراجع الاستلام والتسعير.");
        await loadTasks(true);
        if (owner.current === expectedUser) {
          if (result.state === "completed") setNotice(result.kind === "zero_cash_delivery" ? "تأكد التسليم دون قبض نقدي؛ لا يوجد مبلغ للتحصيل." : "تأكد التسليم وتسجيل قبض المبلغ كاملًا.");
          else setError(result.state === "unknown" ? "النتيجة غير محسومة؛ استخدم التحقق من المحاولة السابقة." : result.code === "zero_cash_economic_conflict" ? "توقف التسليم لوجود تعارض مالي مع المبلغ الصفري. راجع الإدارة." : "رُفضت المحاولة؛ حدّث المهمة وراجع الاستلام والتسعير قبل محاولة جديدة.");
        }
        return;
      } else await updateDeliveryTaskStatus(task.customer_order_id, nextStatus, expectedUser);
      if (owner.current === expectedUser) await loadTasks(true);
    } catch (cause) {
      if (owner.current === expectedUser) {
        const collection = cause instanceof DriverCollectionError ? cause.collection : { state: "unavailable" as const };
        setTasks(previous => previous.map(row => row.id === task.id ? { ...row, collection } : row));
        setError(cause instanceof Error ? cause.message : "تعذر تأكيد حالة التوصيل. حدّث القائمة للتحقق من النتيجة.");
      }
    } finally {
      actionLock.current = false;
      setBusyTaskId(null);
    }
  };
  const pickupStore = async (task: DriverAssignedTask, storeOrderId: string) => {
    const expectedUser = user?.id;
    if (!expectedUser || owner.current !== expectedUser || actionLock.current || task.pickups?.state !== "c4"
      || !canProgressDriverCollection(task.collection)) return;
    actionLock.current = true; setBusyTaskId(task.id); setBusyPickupId(storeOrderId); setError("");
    try {
      const result = await confirmStorePickup(task.id, storeOrderId, expectedUser);
      if (owner.current !== expectedUser) return;
      if (result === "unknown") setError("تعذر حسم الاستلام. حدّث المهمة للتحقق؛ لا نفترض نجاح العملية أو نعيد إرسالها تلقائيًا.");
      await loadTasks(true);
      if (owner.current === expectedUser && result === "unknown") setError("نتيجة الاستلام غير محسومة؛ راجع حالة المتجر بعد التحديث قبل إعادة المحاولة.");
    } catch { if (owner.current === expectedUser) setError("تعذر التحقق من الاستلام. حدّث المهمة ثم تحقق من حالة المتجر."); }
    finally { actionLock.current = false; setBusyTaskId(null); setBusyPickupId(null); }
  };

  const recoverCash = async (task: DriverAssignedTask) => {
    const expectedUser=user?.id;
    if (!expectedUser || task.pickups?.state!=="c4" || actionLock.current) return;
    actionLock.current=true;setBusyTaskId(task.id);
    try {
      const result=await deliveryCollection(expectedUser,task.id,task.pickups.pricingVersion,true);
      if (owner.current!==expectedUser) return;
      await loadTasks(true);
      if (owner.current===expectedUser) {
        if (result.state==="completed") setNotice(result.kind === "zero_cash_delivery" ? "تأكد التسليم دون قبض نقدي؛ لا يوجد مبلغ للتحصيل." : "تأكد التسليم وتسجيل قبض المبلغ كاملًا.");
        else setError(result.state==="rejected" ? result.code === "zero_cash_economic_conflict" ? "توقف التسليم لوجود تعارض مالي مع المبلغ الصفري. راجع الإدارة." : "رُفضت المحاولة المحفوظة؛ راجع المهمة قبل تأكيد جديد." : "النتيجة غير محسومة؛ لم نُعد إرسال عملية التحصيل.");
      }
    } catch { if(owner.current===expectedUser)setError("تعذر التحقق من المحاولة المحفوظة."); }
    finally {actionLock.current=false;setBusyTaskId(null);}
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

          {notice && taskOwner === user?.id ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.successForeground }]}>{notice}</Text> : null}
          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : visibleTasks.length > 0 ? (
            visibleTasks.map((task) => {
              const active = task.status !== "delivered";
              const nextAction =
                task.status === "accepted" && task.pickups?.state !== "c4"
                  ? { title: "تأكيد استلام الطلب", status: "picked_up" as const }
                  : task.status === "picked_up"
                    ? { title: task.pickups?.state === "c4" ? task.collection.state === "ready" && task.collection.amount === 0 ? "تأكيد التسليم — لا يوجد مبلغ للتحصيل" : "تأكيد التسليم وقبض المبلغ كاملًا" : "تأكيد تسليم الطلب", status: "delivered" as const }
                    : null;

              return (
                <View key={task.id} style={{ gap: Spacing.two }}><DeliveryTaskCard
                  orderNumber={task.customer_orders.order_number}
                  reference={task.reference}
                  zoneName={task.customer_orders.delivery_zone_name_snapshot}
                  createdAt={task.created_at}
                  assignedOrder={task.customer_orders}
                  collection={task.collection}
                  pickups={task.pickups}
                  busyPickupId={busyPickupId}
                  onConfirmPickup={id => void pickupStore(task, id)}
                  onRetryCollection={() => void loadTasks(true)}
                  actionDisabled={refreshing || busyTaskId !== null}
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
                {task.pickups?.state === "c4" ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} disabled={busyTaskId!==null} onPress={() => void recoverCash(task)}>
                  <Text style={{fontFamily:Fonts.medium,color:colors.primary,textAlign:"right",padding:Spacing.three}}>التحقق من محاولة التسليم والتحصيل السابقة</Text>
                </Pressable> : null}</View>
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

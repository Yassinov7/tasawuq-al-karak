import { useToast } from "@/context/ToastContext";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import type { DriverReadReason } from "@/lib/driver-read-queue";
import { useReadScope } from "@/hooks/useReadScope";
import { useRouter,useLocalSearchParams,useFocusEffect } from "expo-router";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { DriverPickupPreview, DriverTaskDestination } from "@/components/driver/DriverTaskLocation";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { readMoney } from "@/lib/invoice-finance";
import { AppHeader } from "@/components/navigation/AppHeader";
import {
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import {
  acceptDeliveryTask,
  getAvailableDeliveryTasks,
  getDriverHomeAssignment,
  getDriverApplication,
  setDriverAvailability,
  type AvailableDeliveryTask,
  type DriverHomeTask,
} from "@/lib/driver-deliveries";

export default function DriverHomeScreen() {
  const { user } = useAuth();
  return <DriverHome key={user?.id ?? "guest"}/>;
}

function DriverHome() {
  const router = useRouter();
  const {taskId}=useLocalSearchParams<{taskId?:string}>();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const userId = user?.id;
  const toast = useToast();
  const actionLock = useRef(false);
  const hasLoaded = useRef(false);
  const [tasks, setTasks] = useState<AvailableDeliveryTask[]>([]);
  const [driverName, setDriverName] = useState("");
  const [currentTask, setCurrentTask] = useState<DriverHomeTask | null>(null);
  const [money, setMoney] = useState<{ collection: string; payable: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [activeDeliveryCount, setActiveDeliveryCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");

  const reads=useReadScope(user?.id??"guest");
  const actionReads = useReadScope(`actions:${userId ?? "guest"}`);
  useFocusEffect(useCallback(() => {
    reads.open(); actionReads.open();
    return () => { reads.close(); actionReads.close(); };
  }, [reads, actionReads]));
  const loadData = useCallback(
    async (signal: AbortSignal, reason: DriverReadReason) => {
      const refresh = reason === "manual", background = reason === "change";
      if (authLoading) return;
      const epoch=reads.begin();
      if (!userId) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      if (refresh || (reason === "initial" && hasLoaded.current)) setRefreshing(true);
      else if (!background && !hasLoaded.current) setLoading(true);

      let financeRead: Promise<Awaited<ReturnType<typeof readMoney>> | null> | undefined;
      try {
        const application = await getDriverApplication(userId, signal);
        if(signal.aborted || !reads.current(epoch))return;
        if (!application || application.status !== "accepted") {
          router.replace("/application-status");
          return;
        }

        financeRead = readMoney("", 0, undefined, signal).catch(() => null);
        const [availableTasks, assignment] = await Promise.all([
          application.is_available
            ? getAvailableDeliveryTasks(signal)
            : Promise.resolve([]),
          getDriverHomeAssignment(userId, signal),
        ]);
        if(signal.aborted || !reads.current(epoch))return;
        setReadError("");
        setDriverName(application.full_name);
        setActiveDeliveryCount(assignment.count);
        setCurrentTask(assignment.task);
        setIsAvailable(application.is_available);
        setTasks(availableTasks);
        hasLoaded.current = true;
        setLoading(false);
        setRefreshing(false);
        const finance = await financeRead;
        if(signal.aborted || !reads.current(epoch))return;
        setMoney(finance?.owner === userId && !finance.admin && finance.account_reference
          ? { collection: finance.collection_due, payable: finance.payable } : null);
      } catch {
        if(signal.aborted || !reads.current(epoch))return;
        setReadError("تعذر تحميل المهام أو حالة التوفر. تحقق من اتصالك ثم أعد المحاولة.");
      } finally {
        if(!signal.aborted && reads.current(epoch)){hasLoaded.current = true;setLoading(false);setRefreshing(false);}
        await financeRead;
      }
    },
    [authLoading, router, userId,reads],
  );

  const refreshTasks = useDriverTaskRefresh(loadData, Boolean(userId && !authLoading));

  const hasSnapshot=Boolean(driverName);
  const matchingTasks = taskId ? tasks.filter(task => task.task_id === taskId) : tasks;
  const visibleTasks = showAll ? matchingTasks : matchingTasks.slice(0, 3);
  const refreshFromRealtime = useCallback(() => {
    return refreshTasks("change");
  }, [refreshTasks]);
  useOrderRealtime({
    channelName: `driver-delivery-tasks:${user?.id ?? "guest"}`,
    enabled: Boolean(user && !authLoading),
    subscriptions: userId ? [
      { table: "delivery_tasks" },
      { table: "driver_applications", filter: `user_id=eq.${userId}` },
      { table: "money_invoices", filter: `owner_id=eq.${userId}` },
      { table: "store_orders" },
    ] : [],
    sdkManagedRecovery: true,
    acceptEvent: (table, payload) => table !== "store_orders" || (
      "customer_order_id" in payload.new && (!hasSnapshot || payload.new.customer_order_id === currentTask?.orderId)
    ),
    onChange: refreshFromRealtime,
  });

  const changeAvailability = async (nextValue: boolean) => {
    if (actionLock.current || !userId || readError) return;
    actionLock.current = true;
    const token = actionReads.begin();
    setAvailabilityBusy(true);
    setError("");
    try {
      await setDriverAvailability(nextValue, userId);
      if (!actionReads.current(token)) return;
      setIsAvailable(nextValue);
      setTasks([]);
      toast.show({tone:"success",key:`driver-availability:${nextValue}`,message:nextValue
          ? "أصبحت متاحًا لاستقبال مهام توصيل جديدة."
          : "أوقفت استقبال المهام الجديدة. يمكنك إكمال توصيلاتك الحالية."});
      await refreshTasks("change");
    } catch {
      if (!actionReads.current(token)) return;
      setError("تعذر تحديث حالة التوفر. تحقق من الاتصال ثم حاول مرة أخرى.");
    } finally {
      actionLock.current = false;
      setAvailabilityBusy(false);
    }
  };

  const acceptTask = async (task: AvailableDeliveryTask) => {
    if (actionLock.current || !userId || readError) return;
    actionLock.current = true;
    const token = actionReads.begin();
    setBusyTaskId(task.task_id);
    setError("");
    try {
      await acceptDeliveryTask(task.customer_order_id, userId);
      if (!actionReads.current(token)) return;
      setTasks(previous => previous.filter(item => item.task_id !== task.task_id));
      toast.show({tone:"success",key:`accept:${task.task_id}`,message:`تم قبول مهمة ${task.reference ?? "التوصيل"}.`});
      await refreshTasks("change");
    } catch {
      if (!actionReads.current(token)) return;
      setError("تعذر قبول المهمة؛ ربما قبلها سائق آخر. حدّث قائمة المهام وحاول مجددًا.");
    } finally {
      actionLock.current = false;
      setBusyTaskId(null);
    }
  };

  const actionsDisabled = Boolean(readError || availabilityBusy || busyTaskId || refreshing);
  const openAssigned = (id: string) => router.push({ pathname: "/driver/task-details", params: { taskId: id } });
  const labelColor = isAvailable ? colors.successForeground : colors.textSecondary;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="مساحة السائق" />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl
      refreshing={refreshing} onRefresh={() => void refreshTasks("manual")} tintColor={colors.primary} colors={[colors.primary]}
    />}>
      <View style={styles.container}>
        <View style={[styles.surface, styles.row, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{driverName || "حالة السائق"}</Text>
            <Text style={[styles.caption, { color: labelColor }]}>
              {hasSnapshot ? isAvailable ? "متاح لاستقبال المهام" : "استقبال المهام متوقف" : "حالة التوفر غير مؤكدة"}
            </Text>
          </View>
          <Switch value={isAvailable} onValueChange={value => void changeAvailability(value)}
            disabled={!hasSnapshot || loading || actionsDisabled}
            trackColor={{ false: colors.borderStrong, true: colors.surfaceSelected }}
            thumbColor={isAvailable ? colors.primary : colors.textSecondary}
            accessibilityLabel="استقبال مهام التوصيل الجديدة" />
        </View>
        {error || readError ? <View style={styles.stack}>
          <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>{error || readError}</Text>
          {readError ? <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void refreshTasks("manual")} /> : null}
        </View> : null}

        {loading && !hasSnapshot ? <LoadingSkeleton label="جارٍ تحميل مهام التوصيل" /> : null}
        {hasSnapshot ? <>
          <View style={styles.stack}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>المهمة الحالية</Text>
            {currentTask ? <Pressable accessibilityRole="button" accessibilityHint="يفتح تفاصيل المهمة" onPress={() => openAssigned(currentTask.id)}
              style={({ pressed }) => [styles.surface, styles.stack, { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.borderSubtle, borderWidth: 1 }]}>
              <View style={styles.row}>
                <Text style={[styles.reference, styles.flex, { color: colors.text }]}>{currentTask.reference ?? `طلب رقم ${currentTask.orderNumber}`}</Text>
                <Text style={[styles.badge, {
                  color: currentTask.status === "picked_up" ? colors.infoForeground : colors.warningForeground,
                  backgroundColor: currentTask.status === "picked_up" ? colors.infoSurface : colors.warningSurface,
                }]}>{currentTask.status === "picked_up" ? "في طريق التسليم" : "بانتظار الاستلام"}</Text>
                <AppIcon name="chevron-back-outline" size={16} color={colors.textSecondary} />
              </View>
              {currentTask.status === "accepted" && !readError ? <DriverPickupPreview stores={currentTask.pickupStores} /> : null}
              <DriverTaskDestination destination={currentTask.destination} active stale={Boolean(readError)} />
              {!readError && currentTask.collection.state === "ready" ? <View style={styles.row}>
                <Text style={[styles.caption, styles.flex, { color: colors.textSecondary }]}>المطلوب تحصيله من العميل</Text>
                <FinancialAmount amount={currentTask.collection.amount} />
              </View> : <Text style={[styles.caption, { color: colors.warningForeground }]}>
                {currentTask.collection.state === "blocked" ? "التحصيل متوقف حتى تنتهي مراجعة الطلب." : "مبلغ التحصيل غير مؤكد. راجع تفاصيل المهمة."}
              </Text>}
            </Pressable> : <Text style={[styles.caption, { color: colors.textSecondary }]}>لا توجد مهمة جارية.</Text>}
          </View>

          <View style={[styles.links, { borderColor: colors.borderSubtle }]}>
            <AppButton compact fullWidth={false} title={activeDeliveryCount > 1 ? `توصيلاتي · ${activeDeliveryCount.toLocaleString("ar-SY")} جارية` : "توصيلاتي"}
              icon="bicycle-outline" variant="outline" onPress={() => router.push("/driver/orders")} />
          </View>

          <DriverHomeMoney collection={readError ? undefined : money?.collection} payable={readError ? undefined : money?.payable}
            onOpen={() => router.push("/driver/cash-account")} />

          {taskId ? <AppButton compact fullWidth={false} title="عرض المهام المتاحة" variant="outline" onPress={() => router.replace("/driver")} /> : null}
          {taskId && !readError && !matchingTasks.length ? <Text style={[styles.caption, { color: colors.textSecondary }]}>هذه المهمة لم تعد متاحة للقبول.</Text> : null}
          {isAvailable ? <View style={styles.stack}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>مهام متاحة</Text>
            {!matchingTasks.length && !taskId ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{readError ? "تعذر تأكيد المهام المتاحة." : "لا توجد مهام متاحة الآن."}</Text> : null}
            {visibleTasks.map(task => <View key={task.task_id} style={[styles.available, { borderColor: colors.borderSubtle }]}>
              <View style={styles.flex}>
                <Text style={[styles.reference, { color: colors.text }]}>{task.reference ?? `طلب رقم ${task.order_number}`}</Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>{task.delivery_zone_name_snapshot} · عدد المتاجر {task.store_count.toLocaleString("ar-SY")}</Text>
              </View>
              <AppButton compact fullWidth={false} title="قبول المهمة" icon="checkmark-outline" variant="outline"
                loading={busyTaskId === task.task_id} disabled={actionsDisabled} onPress={() => void acceptTask(task)} />
            </View>)}
            {matchingTasks.length > 3 ? <AppButton compact fullWidth={false} title={showAll ? "عرض أقل" : "عرض بقية المهام"} variant="outline"
              onPress={() => setShowAll(value => !value)} /> : null}
          </View> : null}
        </> : null}
      </View>
    </ScrollView>
  </View>;
}

function DriverHomeMoney({ collection, payable, onOpen }: { collection?: string; payable?: string; onOpen: () => void }) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = Math.min(width, MaxContentWidth) - (Spacing.four + Spacing.three) * 2 >= 260 * fontScale
    && Math.max(collection?.length ?? 0, payable?.length ?? 0) <= 12;
  return <View style={[styles.surface, styles.stack, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1 }]}>
    <View style={styles.row}>
      <Text accessibilityRole="header" style={[styles.title, styles.flex, { color: colors.text }]}>الحساب المالي</Text>
      <AppButton design="refined" compact fullWidth={false} title="فتح المالية" icon="chevron-back-outline" variant="outline" onPress={onOpen} />
    </View>
    <View style={[styles.moneyValues, { flexDirection: columns ? "row-reverse" : "column" }]}>
      {([
        ["النقد الواجب توريده للمنصة", collection],
        ["مستحقات السائق من الأجور", payable],
      ] as const).map(([label, value]) => <View key={label} style={columns ? styles.moneyColumn : styles.stack}>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>{label}</Text>
        {value === undefined ? <Text style={[styles.caption, { color: colors.textSecondary }]}>غير مؤكد</Text> : <FinancialAmount amount={value} />}
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
  container: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", gap: Spacing.three },
  row: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  flex: { flexGrow: 1, flexShrink: 1, flexBasis: 105, minWidth: 0 },
  stack: { gap: Spacing.two },
  moneyValues: { gap: Spacing.three },
  moneyColumn: { flex: 1, minWidth: 0, gap: Spacing.two },
  surface: { borderRadius: Radius.md, padding: Spacing.three },
  title: { ...Typography.cardTitle, textAlign: "right" },
  caption: { ...Typography.caption, textAlign: "right" },
  reference: { ...Typography.bodyStrong, textAlign: "right", writingDirection: "auto" },
  badge: { ...Typography.caption, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.full },
  links: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  available: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.one, borderBottomWidth: StyleSheet.hairlineWidth },
});

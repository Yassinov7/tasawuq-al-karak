import { AppHeader } from "@/components/navigation/AppHeader";
import { DriverTaskDestination } from "@/components/driver/DriverTaskLocation";
import { StorePickupPanel } from "@/components/driver/StorePickupPanel";
import { DriverStoreContents } from "@/components/driver/DriverStoreContents";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { MaxContentWidth, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { deliveryCollection, pendingDeliveryAttempt } from "@/lib/delivery-collection-attempt";
import { canProgressDriverCollection, driverCollectionMessage, DriverCollectionError } from "@/lib/driver-collection";
import { getDriverApplication, getDriverAssignedTasks, type DriverAssignedTask } from "@/lib/driver-deliveries";
import type { DriverReadReason } from "@/lib/driver-read-queue";
import { confirmStorePickup } from "@/lib/store-pickups";
import { arabicRowDirection, arabicTextAlign } from "@/lib/arabic-layout";
import { driverTaskLabels } from "@/lib/driver-task-presentation";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function DriverTaskDetailsScreen() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { user } = useAuth();
  const id = typeof taskId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId) ? taskId : undefined;
  return <DriverTaskDetails key={JSON.stringify([user?.id, id])} taskId={id} />;
}

function DriverTaskDetails({ taskId }: { taskId?: string }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = Math.min(width - Spacing.four * 2, MaxContentWidth) >= 300 * fontScale;
  const router = useRouter();
  const [task, setTask] = useState<DriverAssignedTask | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyPickupId, setBusyPickupId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ version: number; amount: number } | null>(null);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [attemptState, setAttemptState] = useState<"none" | "pending" | "unavailable">("unavailable");
  const [checkedUnknown, setCheckedUnknown] = useState(false);
  const owner = useRef(userId);
  const readEpoch = useRef(0);
  const actionLock = useRef(false);

  useFocusEffect(useCallback(() => {
    owner.current = userId;
    const clearVerification = () => {
      readEpoch.current++;
      setVerified(false);
      setConfirmation(null);
    };
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active") clearVerification();
    });
    return () => {
      listener.remove();
      owner.current = undefined;
      clearVerification();
    };
  }, [userId]));

  const loadTask = useCallback(async (signal: AbortSignal, reason: DriverReadReason) => {
    if (!userId || !taskId || authLoading) return;
    const epoch = ++readEpoch.current;
    const current = () => !signal.aborted && owner.current === userId && epoch === readEpoch.current;
    if (reason === "manual") setRefreshing(true);
    try {
      const application = await getDriverApplication(userId, signal);
      if (!current()) return;
      if (application?.status !== "accepted") {
        setTask(null);
        setVerified(false);
        router.replace("/application-status");
        return;
      }
      const [row] = await getDriverAssignedTasks(userId, undefined, taskId, signal);
      if (!current()) return;
      let pending: "none" | "pending" | "unavailable" = "none";
      if (row?.id === taskId) {
        try { pending = await pendingDeliveryAttempt(userId, taskId) ? "pending" : "none"; }
        catch { pending = "unavailable"; }
      }
      if (!current()) return;
      setAttemptState(pending);
      setCheckedUnknown(false);
      setTask(row?.id === taskId ? row : null);
      setVerified(row?.id === taskId);
      if (!row) setConfirmation(null);
      setReadError("");
    } catch {
      if (!current()) return;
      setVerified(false);
      setConfirmation(null);
      setReadError("تعذر تحديث المهمة. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [authLoading, router, taskId, userId]);
  const enabled = Boolean(taskId && userId && !authLoading);
  const refreshTasks = useDriverTaskRefresh(loadTask, enabled);
  useOrderRealtime({
    channelName: `driver-task-details:${userId}:${taskId}`,
    enabled,
    subscriptions: taskId && userId ? [
      { table: "delivery_tasks", filter: `id=eq.${taskId}` },
      { table: "store_orders" },
      { table: "driver_applications", filter: `user_id=eq.${userId}` },
    ] : [],
    sdkManagedRecovery: true,
    acceptEvent: (table, payload) => {
      const row = payload.new;
      if (table === "store_orders") return "customer_order_id" in row && (!task || row.customer_order_id === task.customer_order_id);
      if (table === "delivery_tasks" && (payload.eventType === "DELETE" || ("status" in row && row.status === "cancelled") ||
        ("driver_id" in row && row.driver_id !== userId))) {
        readEpoch.current++;
        setVerified(false);
        setTask(null);
        setConfirmation(null);
      }
      if (table === "driver_applications" && "status" in row && row.status !== "accepted") {
        readEpoch.current++;
        setVerified(false);
        setTask(null);
        setConfirmation(null);
      }
      return true;
    },
    onChange: () => refreshTasks("change"),
  });

  const updateStatus = async (task: DriverAssignedTask) => {
    const expectedUser = user?.id;
    if (!expectedUser || owner.current !== expectedUser || actionLock.current || !verified || readError || task.status !== "picked_up" || task.pickups?.state !== "c4" || !task.pickups.canCompleteDelivery) return;
    if (!canProgressDriverCollection(task.collection)) { setError(driverCollectionMessage(task.collection)); return; }
    actionLock.current = true;
    setBusyTaskId(task.id);
    setNotice("");
    setError("");
    try {
      const result = await deliveryCollection(expectedUser, task.id, task.pickups.pricingVersion);
      if (owner.current !== expectedUser) return;
      await refreshTasks("change");
      if (owner.current === expectedUser) {
        if (result.state === "completed") setNotice(result.kind === "zero_cash_delivery" ? "تأكد التسليم دون قبض نقدي؛ لا يوجد مبلغ للتحصيل." : "تأكد التسليم وتسجيل قبض المبلغ كاملًا.");
        else setError(result.state === "unknown" ? "لم تتأكد نتيجة التسليم. تحقّق من نتيجة المحاولة السابقة قبل المحاولة مجددًا." : result.code === "zero_cash_economic_conflict" ? "توقف التسليم لوجود تعارض مالي مع المبلغ الصفري. راجع الإدارة." : "لم يتم التسليم بهذه المحاولة؛ حدّث المهمة وراجع الاستلام والمبلغ قبل المحاولة مجددًا.");
      }
    } catch (cause) {
      if (owner.current === expectedUser) {
        const collection = cause instanceof DriverCollectionError ? cause.collection : { state: "unavailable" as const };
        setTask(previous => previous?.id === task.id ? { ...previous, collection } : previous);
        setError(cause instanceof DriverCollectionError ? driverCollectionMessage(collection) : "تعذر التأكد من نتيجة التسليم. حدّث المهمة ثم تحقّق من المحاولة السابقة.");
        setAttemptState("unavailable");
      }
    } finally {
      actionLock.current = false;
      setBusyTaskId(null);
    }
  };
  const pickupStore = async (task: DriverAssignedTask, storeOrderId: string) => {
    const expectedUser = user?.id;
    if (!expectedUser || owner.current !== expectedUser || actionLock.current || !verified || readError || task.pickups?.state !== "c4" || !task.pickups.canConfirmPickup
      || !canProgressDriverCollection(task.collection)) return;
    actionLock.current = true; setBusyTaskId(task.id); setBusyPickupId(storeOrderId); setNotice(""); setError("");
    try {
      const result = await confirmStorePickup(task.id, storeOrderId, expectedUser);
      if (owner.current !== expectedUser) return;
      if (result === "unknown") setError("تعذر حسم الاستلام. حدّث المهمة للتحقق؛ لا نفترض نجاح العملية أو نعيد إرسالها تلقائيًا.");
      await refreshTasks("change");
      if (owner.current === expectedUser && result === "unknown") setError("نتيجة الاستلام غير محسومة؛ راجع حالة المتجر بعد التحديث قبل إعادة المحاولة.");
    } catch { if (owner.current === expectedUser) setError("تعذر التحقق من الاستلام. حدّث المهمة ثم تحقق من حالة المتجر."); }
    finally { actionLock.current = false; setBusyTaskId(null); setBusyPickupId(null); }
  };

  const recoverCash = async (task: DriverAssignedTask) => {
    const expectedUser=user?.id;
    if (!expectedUser || owner.current !== expectedUser || !verified || attemptState !== "pending" || actionLock.current) return;
    actionLock.current=true;setBusyTaskId(task.id);setNotice("");
    try {
      const result=await deliveryCollection(expectedUser,task.id,task.pickups?.state === "c4" ? task.pickups.pricingVersion : 0,true);
      if (owner.current!==expectedUser) return;
      await refreshTasks("change");
      if (owner.current===expectedUser) {
        setCheckedUnknown(result.state === "unknown");
        if (result.state==="completed") setNotice(result.kind === "zero_cash_delivery" ? "تأكد التسليم دون قبض نقدي؛ لا يوجد مبلغ للتحصيل." : "تأكد التسليم وتسجيل قبض المبلغ كاملًا.");
        else setError(result.state==="rejected" ? result.code === "zero_cash_economic_conflict" ? "توقف التسليم لوجود تعارض مالي مع المبلغ الصفري. راجع الإدارة." : "لم يتم التسليم بهذه المحاولة. راجع المهمة قبل المحاولة مجددًا." : "ما زالت نتيجة التسليم غير معروفة. يمكنك التحقق لاحقًا؛ إعادة المحاولة تستخدم المحاولة المحفوظة نفسها.");
      }
    } catch { if(owner.current===expectedUser)setError("تعذر التحقق من نتيجة التسليم. أعد التحقق عند تحسن الاتصال."); }
    finally {actionLock.current=false;setBusyTaskId(null);}
  };

  const active = task?.status === "accepted" || task?.status === "picked_up";
  const stores = task?.customer_orders.store_orders.filter(store => !["rejected", "cancelled"].includes(store.status)) ?? [];
  const milestone = task?.delivered_at ?? task?.picked_up_at ?? task?.accepted_at;
  const workflow = task?.pickups?.state === "c4" ? task.pickups : null;
  const amount = verified && active && task.collection.state === "ready" ? task.collection.amount : undefined;
  const busy = busyTaskId !== null || refreshing;
  const canDeliver = task?.status === "picked_up" && verified && workflow?.canCompleteDelivery && amount !== undefined
    && (attemptState === "none" || attemptState === "pending" && checkedUnknown);
  const confirmDelivery = () => {
    if (!confirmation || !task || actionLock.current) return;
    setConfirmation(null);
    if (!canDeliver || amount !== confirmation.amount || workflow?.pricingVersion !== confirmation.version) {
      setError("تغيّرت المهمة أو مبلغ التحصيل. راجع التفاصيل قبل التأكيد.");
      return;
    }
    void updateStatus(task);
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="تفاصيل التوصيل" showBack />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing}
      onRefresh={() => void refreshTasks("manual")} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={styles.container}>
        {readError || error ? <Text accessibilityRole="alert" style={[styles.text, { color: colors.errorForeground }]}>{readError || error}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.successForeground }]}>{notice}</Text> : null}
        {readError ? <AppButton compact fullWidth={false} variant="outline" title="إعادة المحاولة" onPress={() => void refreshTasks("manual")} /> : null}
        {taskId && (authLoading || loading && enabled) ? <LoadingSkeleton cards={1} label="جارٍ تحميل المهمة" /> : null}
        {(!taskId || !loading && !task && !readError) ? <Text style={[styles.text, { color: colors.textSecondary }]}>المهمة غير متاحة لهذا الحساب.</Text> : null}
        {task ? <>
          <View style={styles.section}>
            <Text style={[styles.text, { color: !verified ? colors.textSecondary : active ? colors.infoForeground : colors.successForeground }]}>
              {!verified ? "حالة المهمة غير مؤكدة" : driverTaskLabels[task.status]}
            </Text>
            <View style={twoColumns ? styles.gridRow : styles.section}>
              <View style={twoColumns ? styles.gridCell : styles.section}>
                <Text style={[styles.text, { color: colors.textSecondary }]}>مرجع المهمة</Text>
                <Text selectable accessibilityRole="header" style={[styles.title, styles.reference, { color: colors.text }]}>{task.reference ?? "مرجع المهمة غير متاح"}</Text>
              </View>
              {verified && milestone ? <View style={twoColumns ? styles.gridCell : styles.section}>
                <Text style={[styles.text, { color: colors.textSecondary }]}>آخر مرحلة</Text>
                <Text style={[styles.text, { color: colors.text }]}>{new Date(milestone).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" })}</Text>
              </View> : null}
            </View>
            {verified && active ? <View style={twoColumns ? styles.gridRow : styles.section}>
              <View style={twoColumns ? styles.gridCell : styles.section}>
                <Text style={[styles.text, { color: colors.textSecondary }]}>المستلم</Text>
                <Text style={[styles.text, { color: colors.text }]}>{task.customer_orders.recipient_name?.trim() || "اسم المستلم غير مسجل"}</Text>
              </View>
              {amount !== undefined ? <View style={twoColumns ? styles.gridCell : styles.section}>
                <Text style={[styles.text, { color: colors.textSecondary }]}>المطلوب من العميل</Text>
                <FinancialAmount amount={amount} />
              </View> : null}
            </View> : null}
          </View>
          {verified ? <View style={[styles.section, styles.divider, { borderColor: colors.borderSubtle }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>الطلبات والمنتجات</Text>
            <Text selectable style={[styles.text, { color: colors.textSecondary }]}>طلب العميل · <Text style={styles.reference}>{task.orderReference ?? "المرجع غير متاح"}</Text></Text>
            {!stores.length ? <Text style={[styles.text, { color: colors.textSecondary }]}>لا توجد نقاط استلام متاحة للعرض.</Text> : null}
            {active && !workflow ? <Text style={[styles.text, { color: colors.warningForeground }]}>تعذر تأكيد حالة الاستلام. حدّث المهمة قبل المتابعة.</Text> : null}
            {active && workflow ? <StorePickupPanel compact stores={task.customer_orders.store_orders} workflow={workflow}
              busy={busyPickupId} disabled={busy || confirmation !== null || amount === undefined}
              renderContents={store => <DriverStoreContents store={store} />}
              onConfirm={id => void pickupStore(task, id)} /> :
              stores.map(store =>
                <View key={store.id} style={styles.section}>
                  <Text style={[styles.text, { color: colors.text }]}>{store.stores?.name ?? "متجر"}</Text>
                  <Text style={[styles.text, { color: colors.textSecondary }]}>{store.stores?.address || "عنوان نقطة الاستلام غير متاح"}</Text>
                  <Text style={[styles.text, { color: colors.textSecondary }]}>{store.status === "delivered" ? "تم التسليم للعميل" : store.status === "handed_to_driver" ? "استلمه السائق" : "لم يُؤكد الاستلام من المتجر"}</Text>
                  <DriverStoreContents store={store} />
                </View>)}
          </View> : null}
          <View style={[styles.section, styles.divider, { borderColor: colors.borderSubtle }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>وجهة التسليم</Text>
            <DriverTaskDestination destination={task.customer_orders} active={active} stale={!verified} expanded contact showRecipient={false}
              onCallError={() => setError("تعذر فتح تطبيق الهاتف. حاول مرة أخرى.")} />
          </View>
          {active && (amount === undefined || canDeliver) ? <View style={[styles.section, styles.divider, { borderColor: colors.borderSubtle }]}>
            {amount !== undefined ? null :
              <Text style={[styles.text, { color: colors.warningForeground }]}>{verified ? driverCollectionMessage(task.collection) : "تعذر تأكيد مبلغ التحصيل."}</Text>}
            {canDeliver ? <AppButton design="refined" compact fullWidth={false} title={attemptState === "pending" ? "إعادة المحاولة نفسها" : "تأكيد التسليم"} icon="checkmark-done-outline"
              disabled={busy} loading={busyTaskId === task.id && !busyPickupId}
              onPress={() => { if (!actionLock.current && workflow) setConfirmation({ amount, version: workflow.pricingVersion }); }} /> : null}
          </View> : null}
          {verified && attemptState === "unavailable" ? <Text accessibilityRole="alert" style={[styles.text, {color:colors.warningForeground}]}>تعذر قراءة حالة محاولة التسليم المحفوظة. حدّث المهمة قبل تأكيد التسليم.</Text> : null}
          {verified && attemptState === "pending" ? <View style={styles.section}>
            <Text style={[styles.text, {color:colors.warningForeground}]}>تعذر التأكد من نجاح محاولة التسليم السابقة. تحقّق من نتيجتها قبل المحاولة مجددًا.</Text>
            <AppButton compact fullWidth={false} variant="outline" title="التحقق من نتيجة التسليم"
              disabled={busy || confirmation !== null} loading={busyTaskId === task.id && !busyPickupId} onPress={() => void recoverCash(task)} />
          </View> : null}
        </> : null}
      </View>
    </ScrollView>
    <AppModal compact visible={confirmation !== null && verified} icon="checkmark-done-outline" title="تأكيد التسليم؟"
      message={confirmation?.amount === 0 ? "تأكد من تسليم الطلب. لا يوجد مبلغ للتحصيل." : "أكد بعد تسليم الطلب واستلام المبلغ كاملًا."}
      cancelText="إلغاء" confirmText="تأكيد التسليم" onCancel={() => setConfirmation(null)} onConfirm={confirmDelivery}>
      {confirmation && confirmation.amount > 0 ? <FinancialAmount label="المبلغ المحصّل من العميل" amount={confirmation.amount} /> : null}
    </AppModal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
  container: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", gap: Spacing.three },
  section: { gap: Spacing.two },
  gridRow: { flexDirection: arabicRowDirection, alignItems: "flex-start", gap: Spacing.three },
  gridCell: { flex: 1, minWidth: 0, gap: Spacing.one },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  title: { ...Typography.cardTitle, textAlign: arabicTextAlign },
  text: { ...Typography.caption, textAlign: arabicTextAlign },
  reference: { writingDirection: "ltr" },
});

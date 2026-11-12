import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import type { DriverReadReason } from "@/lib/driver-read-queue";
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  DriverPickupPreview,
  DriverTaskDestination,
} from "@/components/driver/DriverTaskLocation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import {
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { driverCollectionMessage } from "@/lib/driver-collection";
import {
  getDriverApplication,
  getDriverAssignedTasks,
  type DriverAssignedTask,
} from "@/lib/driver-deliveries";

type OrdersView = "active" | "completed";
const pageSize = 10;

const taskStatusLabels: Record<DriverAssignedTask["status"], string> = {
  accepted: "بانتظار الاستلام",
  picked_up: "قيد التوصيل",
  delivered: "مكتمل",
  pending_stores: "بانتظار المتاجر",
  available: "متاح",
  cancelled: "ملغى",
};

export default function DriverOrdersScreen() {
  const { user } = useAuth();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  if (typeof taskId === "string" && taskId) {
    return (
      <Redirect
        href={{ pathname: "/driver/task-details", params: { taskId } }}
      />
    );
  }
  return <DriverOrders key={user?.id ?? "guest"} />;
}

function DriverOrders() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const userId = user?.id;
  const [tasks, setTasks] = useState<DriverAssignedTask[]>([]);
  const [taskOwner, setTaskOwner] = useState<string>();
  const [view, setView] = useState<OrdersView>("active");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const readKey = JSON.stringify([view, page, query]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readError, setReadError] = useState("");
  const hasLoaded = useRef(false);
  const readEpoch = useRef(0),
    owner = useRef(user?.id);
  useLayoutEffect(() => {
    const invalidateReads = () => {
      readEpoch.current++;
    };
    owner.current = user?.id;
    invalidateReads();
    return () => {
      owner.current = undefined;
      invalidateReads();
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      owner.current = userId;
      return () => {
        owner.current = undefined;
        readEpoch.current++;
      };
    }, [userId]),
  );

  const loadTasks = useCallback(
    async (signal: AbortSignal, reason: DriverReadReason) => {
      const refresh = reason === "manual",
        background = reason === "change";
      if (authLoading) return;
      const epoch = ++readEpoch.current;
      const expectedUser = userId;
      const current = () =>
        !signal.aborted &&
        readEpoch.current === epoch &&
        owner.current === expectedUser;
      if (!userId) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      if (refresh || (reason === "initial" && hasLoaded.current))
        setRefreshing(true);
      else if (!background && !hasLoaded.current) setLoading(true);

      try {
        const application = await getDriverApplication(userId, signal);
        if (!current()) return;
        if (!application || application.status !== "accepted") {
          router.replace("/application-status");
          return;
        }
        const rows = await getDriverAssignedTasks(
          userId,
          undefined,
          undefined,
          signal,
          { view, offset: page * pageSize, size: pageSize, search: query },
        );
        if (current()) {
          setReadError("");
          setTasks(rows);
          setTaskOwner(expectedUser);
          setLoadedKey(readKey);
        }
      } catch {
        if (current()) {
          setTasks((previous) =>
            previous.map((task) => ({
              ...task,
              collection: { state: "unavailable" },
            })),
          );
          setReadError(
            "تعذر تحديث توصيلاتك ومبلغ التحصيل. المعروض آخر بيانات متاحة إن وجدت؛ حدّث قبل متابعة التحصيل.",
          );
        }
      } finally {
        if (current()) {
          hasLoaded.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [authLoading, router, userId, view, page, query, readKey],
  );

  const refreshTasks = useDriverTaskRefresh(
    loadTasks,
    Boolean(userId && !authLoading),
  );

  const refreshFromRealtime = useCallback(() => {
    return refreshTasks("change");
  }, [refreshTasks]);
  useOrderRealtime({
    channelName: `driver-assigned-deliveries:${user?.id ?? "guest"}`,
    enabled: Boolean(user && !authLoading),
    subscriptions: userId
      ? [
          { table: "delivery_tasks", filter: `driver_id=eq.${userId}` },
          { table: "store_orders" },
        ]
      : [],
    sdkManagedRecovery: true,
    acceptEvent: (table, { new: row }) => {
      if (table !== "store_orders") return true;
      if (!("customer_order_id" in row) || view !== "active") return false;
      const orderId = row.customer_order_id;
      return (
        loadedKey !== readKey ||
        (taskOwner === userId &&
          tasks.some(
            (task) =>
              task.customer_order_id === orderId &&
              (task.status === "accepted" || task.status === "picked_up"),
          ))
      );
    },
    onChange: refreshFromRealtime,
  });

  const visibleTasks = useMemo(
    () =>
      (taskOwner === user?.id && loadedKey === readKey ? tasks : [])
        .slice(0, pageSize)
        .filter((task) =>
          view === "completed"
            ? task.status === "delivered"
            : task.status === "accepted" || task.status === "picked_up",
        ),
    [tasks, taskOwner, user?.id, view, loadedKey, readKey],
  );

  const scopeReady = taskOwner === userId && loadedKey === readKey;
  const waiting = loading || (!scopeReady && !readError);
  const goToPage = (nextPage: number) => {
    readEpoch.current++;
    setReadError("");
    setPage(nextPage);
  };
  const searchFor = (value: string) => {
    Keyboard.dismiss();
    const next = value.trim();
    setSearch(next);
    if (page === 0 && query === next) {
      void refreshTasks("manual");
      return;
    }
    goToPage(0);
    setQuery(next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="توصيلاتي" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshTasks("manual")}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.container}>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <AppTextField
                label="ابحث باستخدام رمز المهمة TSK-"
                placeholder="TSK-…"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
                returnKeyType="search"
                onSubmitEditing={() => searchFor(search)}
              />
            </View>
            <AppButton
              compact
              fullWidth={false}
              title="بحث"
              variant="outline"
              icon="search-outline"
              onPress={() => searchFor(search)}
            />
          </View>
          {search || query ? (
            <AppButton
              compact
              fullWidth={false}
              title="مسح البحث"
              variant="outline"
              onPress={() => searchFor("")}
            />
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {(
              [
                ["active", "الجارية"],
                ["completed", "المكتملة"],
              ] as const
            ).map(([key, label]) => {
              const selected = view === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected, disabled: refreshing }}
                  disabled={refreshing}
                  onPress={() => {
                    if (!selected) {
                      setView(key);
                      goToPage(0);
                    }
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? colors.surfaceSelected
                        : colors.surface,
                      borderColor: selected
                        ? colors.primary
                        : colors.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.caption,
                      {
                        color: selected ? colors.primary : colors.textSecondary,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {readError ? (
            <Text
              accessibilityRole="alert"
              style={[styles.caption, { color: colors.errorForeground }]}
            >
              {readError}
            </Text>
          ) : null}
          {readError ? (
            <AppButton
              compact
              fullWidth={false}
              title="إعادة المحاولة"
              variant="outline"
              onPress={() => void refreshTasks("manual")}
            />
          ) : null}
          {waiting ? (
            <LoadingSkeleton cards={1} label="جارٍ تحميل توصيلاتك" />
          ) : null}
          {!waiting && !readError && scopeReady && !visibleTasks.length ? (
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              {query
                ? "لا توجد مهام تطابق الرمز في الحالة المختارة."
                : page > 0
                  ? "لا توجد مهام في هذه الصفحة."
                  : view === "active"
                    ? "لا توجد توصيلات جارية."
                    : "لا توجد توصيلات مكتملة."}
            </Text>
          ) : null}
          {visibleTasks.map((task) => {
            const active = task.status !== "delivered";
            const picked = task.status === "picked_up";
            const statusColor = !active
              ? colors.successForeground
              : picked
                ? colors.infoForeground
                : colors.warningForeground;
            const statusSurface = !active
              ? colors.successSurface
              : picked
                ? colors.infoSurface
                : colors.warningSurface;
            return (
              <Pressable
                key={task.id}
                accessibilityRole="button"
                accessibilityHint="يفتح تفاصيل المهمة"
                onPress={() =>
                  router.push({
                    pathname: "/driver/task-details",
                    params: { taskId: task.id },
                  })
                }
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed
                      ? colors.surfacePressed
                      : colors.surface,
                    borderColor: active ? statusColor : colors.borderSubtle,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Text
                    style={[
                      styles.reference,
                      styles.flex,
                      { color: colors.text },
                    ]}
                  >
                    {task.reference ??
                      `طلب رقم ${task.customer_orders.order_number}`}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      { backgroundColor: statusSurface, color: statusColor },
                    ]}
                  >
                    {taskStatusLabels[task.status]}
                  </Text>
                  <AppIcon
                    name="chevron-back-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
                {task.status === "accepted" && !readError ? (
                  <DriverPickupPreview
                    stores={task.customer_orders.store_orders}
                  />
                ) : null}
                <DriverTaskDestination
                  destination={task.customer_orders}
                  active={active}
                  stale={Boolean(readError)}
                />
                {active && !readError ? (
                  task.collection.state === "ready" ? (
                    <FinancialAmount
                      label="المطلوب من العميل"
                      amount={task.collection.amount}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.caption,
                        { color: colors.warningForeground },
                      ]}
                    >
                      {driverCollectionMessage(task.collection)}
                    </Text>
                  )
                ) : null}
              </Pressable>
            );
          })}
          {page > 0 || (scopeReady && tasks.length > pageSize) ? (
            <View style={styles.row}>
              <AppButton
                compact
                fullWidth={false}
                title="السابق"
                variant="outline"
                disabled={refreshing || page === 0}
                onPress={() => goToPage(page - 1)}
              />
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                صفحة {(page + 1).toLocaleString("ar-SY")}
              </Text>
              <AppButton
                compact
                fullWidth={false}
                title="التالي"
                variant="outline"
                disabled={refreshing || !scopeReady || tasks.length <= pageSize}
                onPress={() => goToPage(page + 1)}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
  container: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    gap: Spacing.two,
  },
  chips: { flexDirection: "row-reverse", gap: Spacing.two },
  chip: {
    minHeight: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    justifyContent: "center",
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: Spacing.two,
  },
  searchField: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  flex: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  reference: {
    ...Typography.bodyStrong,
    textAlign: "right",
    writingDirection: "auto",
  },
  caption: { ...Typography.caption, textAlign: "right" },
  badge: {
    ...Typography.caption,
    borderRadius: Radius.full,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});

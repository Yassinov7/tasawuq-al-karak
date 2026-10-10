import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { DeliveryTaskCard, toAvailableTaskCard } from "@/components/driver/DeliveryTaskCard";
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
  acceptDeliveryTask,
  getAvailableDeliveryTasks,
  getDriverAssignedTasks,
  getDriverApplication,
  setDriverAvailability,
  type AvailableDeliveryTask,
} from "@/lib/driver-deliveries";

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<AvailableDeliveryTask[]>([]);
  const [driverName, setDriverName] = useState("");
  const [activeDeliveryCount, setActiveDeliveryCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(
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

        const [availableTasks, assignedTasks] = await Promise.all([
          application.is_available
            ? getAvailableDeliveryTasks()
            : Promise.resolve([]),
          getDriverAssignedTasks(user.id),
        ]);
        setDriverName(application.full_name);
        setActiveDeliveryCount(
          assignedTasks.filter(
            (task) => task.status === "accepted" || task.status === "picked_up",
          ).length,
        );
        setIsAvailable(application.is_available);
        setTasks(availableTasks);
      } catch {
        setError("تعذر تحميل المهام أو حالة التوفر. تحقق من اتصالك ثم أعد المحاولة.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authLoading, router, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const changeAvailability = async (nextValue: boolean) => {
    setAvailabilityBusy(true);
    setError("");
    setNotice("");
    try {
      await setDriverAvailability(nextValue);
      setIsAvailable(nextValue);
      setTasks([]);
      setNotice(
        nextValue
          ? "أصبحت متاحًا لاستقبال مهام توصيل جديدة."
          : "أوقفت استقبال المهام الجديدة. يمكنك إكمال توصيلاتك الحالية.",
      );
      if (nextValue) {
        try {
          setTasks(await getAvailableDeliveryTasks());
        } catch {
          setError("تم حفظ حالة التوفر، لكن تعذر تحميل المهام. حاول تحديث القائمة.");
        }
      }
    } catch {
      setError("تعذر تحديث حالة التوفر. تحقق من الاتصال ثم حاول مرة أخرى.");
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const acceptTask = async (task: AvailableDeliveryTask) => {
    setBusyTaskId(task.task_id);
    setError("");
    setNotice("");
    try {
      await acceptDeliveryTask(task.customer_order_id);
      setNotice(`تم قبول مهمة الطلب TW-${task.order_number}.`);
      await loadData(true);
    } catch {
      setError("تعذر قبول المهمة؛ ربما قبلها سائق آخر. حدّث قائمة المهام وحاول مجددًا.");
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="مساحة السائق" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.container}>
          <View
            style={[
              styles.welcomeCard,
              { backgroundColor: colors.primaryLight, borderColor: colors.border },
            ]}
          >
            <View style={styles.welcomeTop}>
              <View style={styles.welcomeText}>
                <Text style={[styles.welcomeEyebrow, { color: colors.primary }]}>
                  مساحة السائق
                </Text>
                <Text style={[styles.welcomeTitle, { color: colors.text }]}>
                  أهلًا {driverName || "بك"} 👋
                </Text>
                <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                  جاهز لتوصيل جديد اليوم؟
                </Text>
              </View>
              <View
                style={[
                  styles.welcomeIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <AppIcon name="bicycle-outline" size={30} color={colors.primary} />
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="عرض توصيلاتي"
              onPress={() => router.push("/driver/orders")}
              style={({ pressed }) => [
                styles.welcomeAction,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text style={[styles.welcomeActionText, { color: colors.surface }]}>
                متابعة توصيلاتي
              </Text>
              <AppIcon
                name="chevron-back-outline"
                size={18}
                color={colors.surface}
              />
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.summaryIcon,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <AppIcon
                  name="bicycle-outline"
                  size={20}
                  color={colors.accentText}
                />
              </View>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {loading ? "—" : activeDeliveryCount}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                توصيلات جارية
              </Text>
            </View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.summaryIcon,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <AppIcon
                  name="receipt-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {loading || !isAvailable ? "—" : tasks.length}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                مهام متاحة
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.availabilityCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.availabilityInfo}>
              <View
                style={[
                  styles.availabilityIcon,
                  {
                    backgroundColor: isAvailable
                      ? colors.primaryLight
                      : colors.surfaceSecondary,
                  },
                ]}
              >
                <AppIcon
                  name={isAvailable ? "radio-button-on" : "pause-circle-outline"}
                  size={23}
                  color={isAvailable ? colors.primary : colors.textMuted}
                />
              </View>
              <View style={styles.availabilityText}>
                <Text style={[styles.availabilityTitle, { color: colors.text }]}>
                  {isAvailable ? "متاح لاستقبال المهام" : "غير متاح حاليًا"}
                </Text>
                <Text style={[styles.availabilityHint, { color: colors.textSecondary }]}>
                  {isAvailable
                    ? "ستظهر لك المهام الجديدة المؤهلة."
                    : "لن تصلك مهام جديدة، ويمكنك إكمال توصيلاتك الحالية."}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={(value) => void changeAvailability(value)}
              disabled={loading || availabilityBusy}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isAvailable ? colors.primary : colors.textMuted}
              accessibilityLabel="حالة التوفر لاستقبال مهام التوصيل"
            />
          </View>

          {notice ? (
            <Text style={[styles.feedback, { color: colors.primary }]}>
              {notice}
            </Text>
          ) : null}
          {error ? (
            <Text style={[styles.feedback, { color: colors.error }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              مهام توصيل متاحة
            </Text>
            <Text style={[styles.taskCount, { color: colors.textSecondary }]}>
              {isAvailable ? `${tasks.length} مهمة` : "فعّل التوفر لرؤية المهام"}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : isAvailable && tasks.length > 0 ? (
            tasks.map((task) => (
              <DeliveryTaskCard
                key={task.task_id}
                {...toAvailableTaskCard(task)}
                taskStatus="available"
                statusLabel="متاح"
                actionTitle="قبول مهمة التوصيل"
                actionIcon="checkmark-circle-outline"
                actionTone="primary"
                actionLoading={busyTaskId === task.task_id}
                onAction={() => void acceptTask(task)}
              />
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppIcon
                name={isAvailable ? "bicycle-outline" : "time-outline"}
                size={28}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {isAvailable ? "لا توجد مهام متاحة الآن" : "أنت غير متاح"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {isAvailable
                  ? "ستظهر المهام هنا عندما تصبح جاهزة للتوصيل."
                  : "غيّر حالتك إلى متاح عندما ترغب باستقبال مهام جديدة."}
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
  welcomeCard: {
    gap: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  welcomeTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  welcomeText: {
    flex: 1,
    gap: Spacing.one,
  },
  welcomeEyebrow: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },
  welcomeTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },
  welcomeSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  welcomeIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  welcomeAction: {
    minHeight: 46,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: Radius.md,
  },
  welcomeActionText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  summaryRow: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  summaryValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },
  summaryLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },
  availabilityCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  availabilityInfo: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },
  availabilityIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  availabilityText: {
    flex: 1,
    gap: Spacing.one,
  },
  availabilityTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },
  availabilityHint: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },
  feedback: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  sectionHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },
  taskCount: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "left",
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

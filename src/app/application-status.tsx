import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Status = {
  status: string;
  review_note: string | null;
  submitted_at: string;
  plan_price_snapshot?: number;
  plan_currency_snapshot?: string;
};

type StatusConfig = {
  title: string;
  note: string;
  icon:
    | "time-outline"
    | "checkmark-circle-outline"
    | "close-circle-outline"
    | "information-circle-outline";
  tone: "pending" | "accepted" | "rejected" | "changes";
};

const statusText: Record<string, StatusConfig> = {
  pending: {
    title: "طلبك قيد المراجعة",
    note: "ستراجع الإدارة المعلومات التي قدمتها، وسيتم تحديث حالة الطلب بعد انتهاء المراجعة.",
    icon: "time-outline",
    tone: "pending",
  },

  accepted: {
    title: "تمت الموافقة على طلبك",
    note: "تم اعتماد طلبك وأصبح حسابك جاهزاً للانتقال إلى المرحلة التالية.",
    icon: "checkmark-circle-outline",
    tone: "accepted",
  },

  rejected: {
    title: "تعذر قبول الطلب حالياً",
    note: "راجع ملاحظة الإدارة لمعرفة سبب عدم قبول الطلب والخطوة التالية المتاحة لك.",
    icon: "close-circle-outline",
    tone: "rejected",
  },

  changes_requested: {
    title: "نحتاج معلومات إضافية",
    note: "راجِع ملاحظة الإدارة واستكمل المعلومات المطلوبة عند إعادة فتح الطلب.",
    icon: "information-circle-outline",
    tone: "changes",
  },
};

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return date.toLocaleDateString("ar-SY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatMoney = (
  value: number | undefined,
  currency: string | undefined,
) => {
  const amount = Number(value ?? 0);

  return `${amount.toLocaleString("ar-SY")} ${
    currency === "USD" ? "دولار" : "ل.س"
  }`;
};

export default function ApplicationStatusScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [status, setStatus] = useState<Status | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const currentRole = profile?.role ?? "";

        if (currentRole !== "merchant" && currentRole !== "driver") {
          setRole(currentRole);
          setStatus(null);
          return;
        }

        setRole(currentRole);

        const table =
          currentRole === "merchant"
            ? "merchant_applications"
            : "driver_applications";

        const select =
          currentRole === "merchant"
            ? "status,review_note,submitted_at,plan_price_snapshot,plan_currency_snapshot"
            : "status,review_note,submitted_at";

        const { data: application, error: applicationError } = await supabase
          .from(table)
          .select(select)
          .eq("user_id", user.id)
          .maybeSingle();

        if (applicationError) {
          throw applicationError;
        }

        setStatus(application as Status | null);
      } catch {
        setError(
          "تعذر تحميل حالة الطلب. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          جاري تحميل حالة الطلب...
        </Text>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <AppIcon
            name="document-text-outline"
            size={28}
            color={colors.textSecondary}
          />
        </View>

        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          لا يوجد طلب مسجل
        </Text>

        <Text
          style={[styles.emptyDescription, { color: colors.textSecondary }]}
        >
          لا يوجد طلب انتساب مرتبط بهذا الحساب حالياً.
        </Text>

        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        ) : null}

        <AppButton title="إعادة المحاولة" onPress={() => void loadStatus()} />

        <AppButton
          title="تسجيل الخروج"
          variant="outline"
          onPress={() => void handleLogout()}
        />
      </View>
    );
  }

  const content = statusText[status.status] ?? statusText.pending;

  const toneColor =
    content.tone === "accepted"
      ? colors.primary
      : content.tone === "rejected"
        ? colors.error
        : content.tone === "changes"
          ? colors.primary
          : colors.accent;

  const toneBackground =
    content.tone === "accepted"
      ? colors.primaryLight
      : content.tone === "rejected"
        ? colors.surfaceSecondary
        : content.tone === "changes"
          ? colors.primaryLight
          : colors.accentLight;

  const isMerchant = role === "merchant";
  const isAccepted = status.status === "accepted";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.headerButton}
        >
          <AppIcon name="arrow-forward" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            حالة الطلب
          </Text>

          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            متابعة حالة طلب الانتساب
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تحديث حالة الطلب"
          onPress={() => void loadStatus(true)}
          disabled={refreshing}
          hitSlop={10}
          style={styles.headerButton}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <AppIcon name="refresh-outline" size={21} color={colors.text} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadStatus(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[styles.statusIcon, { backgroundColor: toneBackground }]}
          >
            <AppIcon name={content.icon} size={32} color={toneColor} />
          </View>

          <Text style={[styles.statusTitle, { color: colors.text }]}>
            {content.title}
          </Text>

          <Text
            style={[styles.statusDescription, { color: colors.textSecondary }]}
          >
            {content.note}
          </Text>

          <View
            style={[styles.statusBadge, { backgroundColor: toneBackground }]}
          >
            <View style={[styles.statusDot, { backgroundColor: toneColor }]} />

            <Text style={[styles.statusBadgeText, { color: toneColor }]}>
              {status.status === "pending"
                ? "قيد المراجعة"
                : status.status === "accepted"
                  ? "تمت الموافقة"
                  : status.status === "rejected"
                    ? "مرفوض"
                    : "بحاجة إلى تعديل"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.detailsTitle, { color: colors.text }]}>
            تفاصيل الطلب
          </Text>

          <View
            style={[styles.detailRow, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(status.submitted_at)}
            </Text>

            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              تاريخ الإرسال
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {isMerchant ? "تاجر" : "سائق"}
            </Text>

            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              نوع الحساب
            </Text>
          </View>

          {isMerchant ? (
            <View style={styles.planBox}>
              <View
                style={[
                  styles.planIcon,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <AppIcon name="card-outline" size={20} color={colors.primary} />
              </View>

              <View style={styles.planContent}>
                <Text style={[styles.planTitle, { color: colors.text }]}>
                  خطة الاشتراك
                </Text>

                <Text
                  style={[
                    styles.planDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  قيمة الخطة المختارة عند تقديم الطلب
                </Text>

                <Text style={[styles.planPrice, { color: colors.primary }]}>
                  {formatMoney(
                    status.plan_price_snapshot,
                    status.plan_currency_snapshot,
                  )}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {status.review_note ? (
          <View
            style={[
              styles.reviewCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.reviewHeader}>
              <View
                style={[
                  styles.reviewIcon,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <AppIcon
                  name="chatbubble-ellipses-outline"
                  size={19}
                  color={colors.primary}
                />
              </View>

              <Text style={[styles.reviewTitle, { color: colors.text }]}>
                ملاحظة الإدارة
              </Text>
            </View>

            <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
              {status.review_note}
            </Text>
          </View>
        ) : null}

        {isAccepted ? (
          <View
            style={[
              styles.nextStepCard,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
          >
            <View
              style={[styles.nextStepIcon, { backgroundColor: colors.surface }]}
            >
              <AppIcon
                name="checkmark-circle-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.nextStepContent}>
              <Text style={[styles.nextStepTitle, { color: colors.text }]}>
                تم اعتماد حسابك
              </Text>

              <Text
                style={[
                  styles.nextStepDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {isMerchant
                  ? "يمكنك الآن الانتقال إلى لوحة التاجر وإدارة متجرك."
                  : "يمكنك الآن متابعة محفظتك والعمليات المرتبطة بحسابك."}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {isAccepted && isMerchant ? (
            <AppButton
              title="إدارة المتجر"
              onPress={() => router.replace("/merchant" as Href)}
            />
          ) : null}

          {isAccepted && !isMerchant ? (
            <AppButton
              title="عرض المحفظة والعمليات"
              onPress={() => router.push("/wallet" as Href)}
            />
          ) : null}

          <AppButton
            title="تحديث الحالة"
            variant="outline"
            onPress={() => void loadStatus(true)}
            loading={refreshing}
          />

          <AppButton
            title="تسجيل الخروج"
            variant="outline"
            onPress={() => void handleLogout()}
          />
        </View>

        <Text style={[styles.footerHint, { color: colors.textSecondary }]}>
          يمكنك سحب الصفحة إلى الأسفل لتحديث حالة الطلب.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },

  loadingText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 420,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
    textAlign: "center",
  },

  errorText: {
    maxWidth: 420,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "center",
  },

  header: {
    minHeight: 72,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  container: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
    gap: Spacing.three,
  },

  statusCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.five,
    alignItems: "center",
    gap: Spacing.three,
  },

  statusIcon: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  statusTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "center",
  },

  statusDescription: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
    textAlign: "center",
  },

  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },

  statusBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  detailsCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
  },

  detailsTitle: {
    marginBottom: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  detailRow: {
    minHeight: 54,
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },

  detailLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  detailValue: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "left",
  },

  planBox: {
    marginTop: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  planIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  planContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  planTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  planDescription: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  planPrice: {
    marginTop: Spacing.one,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  reviewCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
  },

  reviewHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },

  reviewIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  reviewText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
    textAlign: "right",
  },

  nextStepCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  nextStepIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  nextStepContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  nextStepTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  nextStepDescription: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "right",
  },

  actions: {
    gap: Spacing.two,
  },

  footerHint: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "center",
  },
});

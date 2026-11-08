import { OnboardingFrame } from "@/components/auth/OnboardingFrame";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { ApplicationStatusEmptyState } from "@/components/application-status/ApplicationStatusEmptyState";
import {
  formatDate,
  formatMoney,
  statusText,
  type Status,
} from "@/components/application-status/model";
import { styles } from "@/components/application-status/styles";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  AccountRoutingError,
  getAccountRoute,
  getAccountRoutingErrorMessage,
} from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

export default function ApplicationStatusScreen() {
  const { user } = useAuth();
  return <ApplicationStatusContent key={user?.id ?? "guest"} />;
}
function ApplicationStatusContent() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    initializationError,
    retrySession,
  } = useAuth();
  const { colors } = useTheme();

  const [status, setStatus] = useState<Status | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(
    async (isRefresh = false) => {
      if (authLoading) return;
      if (initializationError) {
        setError("تعذر التحقق من جلسة الدخول. حاول مرة أخرى.");
        setLoading(false);
        return;
      }
      if (!user) {
        setRedirecting(true);
        router.replace("/login");
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const destination = await getAccountRoute(user.id);
        if (destination !== "/application-status") {
          setRedirecting(true);
          router.replace(destination as Href);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profile) {
          throw new AccountRoutingError("profile-missing");
        }

        const currentRole = profile.role;

        if (currentRole !== "merchant" && currentRole !== "driver") {
          const currentDestination = await getAccountRoute(user.id);
          if (currentDestination === "/application-status") {
            throw new AccountRoutingError("invalid-role");
          }
          setRedirecting(true);
          router.replace(currentDestination as Href);
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

        const applicationStatus = application as Status | null;
        if (!applicationStatus) {
          const latestDestination = await getAccountRoute(user.id);
          if (latestDestination !== "/application-status") {
            setRedirecting(true);
            router.replace(latestDestination as Href);
            return;
          }
          throw new Error("Application status was not available.");
        }
        if (applicationStatus?.status === "accepted") {
          setRedirecting(true);
          router.replace(
            currentRole === "merchant" ? "/merchant" : "/driver",
          );
          return;
        }

        setStatus(applicationStatus);
      } catch (loadError) {
        setError(
          loadError instanceof AccountRoutingError
            ? getAccountRoutingErrorMessage(loadError)
            : "تعذر تحميل حالة الطلب. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authLoading, initializationError, router, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadStatus(), 0);
    return () => clearTimeout(timer);
  }, [loadStatus]);

  const handleLogout = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("تعذر تسجيل الخروج. تحقق من الاتصال ثم حاول مرة أخرى.");
        return;
      }
      router.replace("/login");
    } catch {
      setError("تعذر تسجيل الخروج. تحقق من الاتصال ثم حاول مرة أخرى.");
    }
  };

  if (authLoading || loading || redirecting) {
    return (<OnboardingFrame title="حالة طلب الانضمام" >{(
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          جاري تحميل حالة الطلب...
        </Text>
      </View>
    )}</OnboardingFrame>);
  }

  if (!status) {
    return (<OnboardingFrame title="حالة طلب الانضمام" >{(
      <ApplicationStatusEmptyState
        error={error}
        onRetry={() => {
          if (initializationError) void retrySession();
          else void loadStatus();
        }}
        onLogout={() => void handleLogout()}
      />
    )}</OnboardingFrame>);
  }

  const content = statusText[status.status] ?? statusText.pending;

  const toneColor = content.tone === 'rejected' ? colors.errorForeground : content.tone === 'changes' ? colors.infoForeground : content.tone === 'accepted' ? colors.successForeground : colors.warningForeground;
  const toneBackground = content.tone === 'rejected' ? colors.errorSurface : content.tone === 'changes' ? colors.infoSurface : content.tone === 'accepted' ? colors.successSurface : colors.warningSurface;

  const isMerchant = role === "merchant";
  const isAccepted = status.status === "accepted";

  return (
    <OnboardingFrame title="حالة طلب الانضمام">
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
                  : "يمكنك الآن الانتقال إلى مساحة السائق ومتابعة توصيلاتك."}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {["changes_requested", "rejected"].includes(status.status) ? <AppButton design="refined" title="تعديل الطلب وإعادة تقديمه" onPress={() => router.push((isMerchant ? "/merchant-application?edit=1" : "/driver-application?edit=1") as Href)} /> : null}
          {isAccepted && isMerchant ? (
            <AppButton design="refined"
              title="إدارة المتجر"
              onPress={() => router.replace("/merchant" as Href)}
            />
          ) : null}

          {isAccepted && !isMerchant ? (
            <AppButton design="refined"
              title="فتح مساحة السائق"
              onPress={() => router.replace("/driver" as Href)}
            />
          ) : null}

          <AppButton design="refined"
            title="تحديث الحالة"
            variant="outline"
            onPress={() => void loadStatus(true)}
            loading={refreshing}
          />

          <AppButton design="refined"
            title="تسجيل الخروج"
            variant="outline"
            onPress={() => void handleLogout()}
          />
        </View>

        <Text style={[styles.footerHint, { color: colors.textSecondary }]}>
          يمكنك سحب الصفحة إلى الأسفل لتحديث حالة الطلب.
        </Text>
      </ScrollView>
    </OnboardingFrame>
  );
}

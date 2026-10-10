import { useRouter } from "expo-router";
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

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppConfirmModal, AppModal } from "@/components/ui/AppModal";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  FontSizes,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";
import { getDriverApplication, type DriverApplication } from "@/lib/driver-deliveries";
import { supabase } from "@/lib/supabase";

type DriverAccountAction = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
  onPress: () => void;
  badge?: string;
};

export default function DriverAccountScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const { unreadCount } = useNotifications();
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<"support" | "about" | null>(null);
  const [error, setError] = useState("");

  const loadAccount = useCallback(
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
        const result = await getDriverApplication(user.id);
        if (!result || result.status !== "accepted") {
          router.replace("/application-status");
          return;
        }
        setApplication(result);
      } catch {
        setError("تعذر تحميل بيانات حسابك. تحقق من الاتصال ثم حاول مرة أخرى.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authLoading, router, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadAccount(), 0);
    return () => clearTimeout(timer);
  }, [loadAccount]);

  const signOut = async () => {
    setSigningOut(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (signOutError) {
      setError("تعذر تسجيل الخروج. حاول مرة أخرى.");
      return;
    }
    router.replace("/login");
  };

  const accountSections: { title: string; actions: DriverAccountAction[] }[] = [
    {
      title: "الحساب والأمان",
      actions: [
        {
          title: "الأمان وكلمة المرور",
          subtitle: "تحديث كلمة المرور وحماية الحساب",
          icon: "lock-closed-outline",
          onPress: () => router.push("/security"),
        },
        {
          title: "الإعدادات",
          subtitle: "المظهر والإشعارات وتفضيلات التطبيق",
          icon: "settings-outline",
          onPress: () => router.push("/settings"),
        },
      ],
    },
    {
      title: "المساعدة",
      actions: [
        {
          title: "الإشعارات",
          subtitle: "تنبيهات مهام التوصيل وتحديثات الطلبات",
          icon: "notifications-outline",
          badge: unreadCount > 0 ? String(unreadCount) : undefined,
          onPress: () => router.push("/notifications"),
        },
        {
          title: "الدعم والمساعدة",
          subtitle: "معلومات مفيدة حول مهام التوصيل",
          icon: "help-circle-outline",
          onPress: () => setInfoModal("support"),
        },
        {
          title: "عن تسوق",
          subtitle: "تسوق | الكرك الشرقي",
          icon: "information-circle-outline",
          onPress: () => setInfoModal("about"),
        },
      ],
    },
  ];

  const scheduleValue = application?.available_hours;
  const schedule =
    scheduleValue &&
    typeof scheduleValue === "object" &&
    !Array.isArray(scheduleValue) &&
    "schedule" in scheduleValue &&
    typeof scheduleValue.schedule === "string"
      ? scheduleValue.schedule
      : "غير محدد";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="حساب السائق" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadAccount(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.container}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : application ? (
            <>
              <View
                style={[
                  styles.profileCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <AppIcon name="person-outline" size={30} color={colors.primary} />
                </View>
                <Text style={[styles.name, { color: colors.text }]}>
                  {application.full_name}
                </Text>
                <View
                  style={[
                    styles.approvalBadge,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Text style={[styles.approvalText, { color: colors.primary }]}>
                    سائق معتمد
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.detailsCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <AccountRow label="البريد الإلكتروني" value={user?.email ?? "—"} />
                <AccountRow label="رقم الهاتف" value={application.contact_phone} />
                <AccountRow label="نوع المركبة" value={application.vehicle_type} />
                <AccountRow label="أوقات التوفر المسجلة" value={schedule} last />
              </View>

              {accountSections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {section.title}
                  </Text>
                  <View
                    style={[
                      styles.menuCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {section.actions.map((action, index) => (
                      <Pressable
                        key={action.title}
                        accessibilityRole="button"
                        accessibilityLabel={action.title}
                        onPress={action.onPress}
                        style={({ pressed }) => [
                          styles.menuRow,
                          index < section.actions.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.menuIcon,
                            { backgroundColor: colors.primaryLight },
                          ]}
                        >
                          <AppIcon
                            name={action.icon}
                            size={20}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.menuText}>
                          <Text style={[styles.menuTitle, { color: colors.text }]}>
                            {action.title}
                          </Text>
                          <Text
                            style={[
                              styles.menuSubtitle,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {action.subtitle}
                          </Text>
                        </View>
                        {action.badge ? (
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: colors.primary },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                { color: colors.surface },
                              ]}
                            >
                              {action.badge}
                            </Text>
                          </View>
                        ) : null}
                        <AppIcon
                          name="chevron-back-outline"
                          size={18}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              <View
                style={[
                  styles.hintCard,
                  {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppIcon
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.hint, { color: colors.primary }]}>
                  غيّر حالة استقبال المهام من «الرئيسية». إيقاف التوفر لا يمنعك من إكمال توصيلاتك المقبولة.
                </Text>
              </View>
            </>
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تسجيل الخروج"
            onPress={() => setLogoutConfirmationOpen(true)}
            style={({ pressed }) => [
              styles.logoutButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <AppIcon name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>
              تسجيل الخروج
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <AppConfirmModal
        visible={logoutConfirmationOpen}
        title="تسجيل الخروج"
        message="هل تريد تسجيل الخروج من حساب السائق؟"
        confirmText="تسجيل الخروج"
        cancelText="البقاء"
        destructive
        busy={signingOut}
        onCancel={() => setLogoutConfirmationOpen(false)}
        onConfirm={() => void signOut()}
      />
      <AppModal
        visible={infoModal !== null}
        title={infoModal === "support" ? "الدعم والمساعدة" : "عن تسوق"}
        message={
          infoModal === "support"
            ? "تظهر المهام بعد جاهزية طلبات المتاجر. عند قبول مهمة، استخدم «توصيلاتي» لتأكيد استلام الطلب ثم تأكيد تسليمه."
            : "تسوق تطبيق محلي يربط العملاء والمتاجر والسائقين في الكرك الشرقي."
        }
        onCancel={() => setInfoModal(null)}
      />
    </View>
  );
}

function AccountRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.accountRow,
        !last && { borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
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
  profileCard: {
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.six,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },
  menuCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  menuRow: {
    minHeight: 72,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  menuIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  menuText: {
    flex: 1,
    gap: Spacing.one,
  },
  menuTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  menuSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },
  badge: {
    minWidth: 24,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  name: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },
  approvalBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },
  approvalText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },
  detailsCard: {
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  accountRow: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  rowLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },
  rowValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  hint: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
    textAlign: "right",
  },
  hintCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  logoutButton: {
    minHeight: 52,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  logoutText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  error: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
});

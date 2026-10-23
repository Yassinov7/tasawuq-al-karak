import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountProfileHeader } from "@/components/account/AccountProfileHeader";
import { AccountSection } from "@/components/account/AccountSection";
import { AccountShell } from "@/components/account/AccountShell";
import { AppConfirmModal } from "@/components/ui/AppModal";
import { FontSizes, Fonts, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type PlatformItem = {
  title: string;
  subtitle: string;
  icon: "storefront-outline" | "bicycle-outline" | "pricetags-outline" | "wallet-outline" | "cash-outline";
  route: "/admin/stores" | "/admin/drivers" | "/admin/plans?from=more" | "/admin/finance" | "/admin/driver-custody";
};

const platformItems: PlatformItem[] = [
  { title: "المتاجر القائمة", subtitle: "إدارة المتاجر المعتمدة وبياناتها", icon: "storefront-outline", route: "/admin/stores" },
  { title: "السائقون المعتمدون", subtitle: "متابعة السائقين والتوصيلات الحالية", icon: "bicycle-outline", route: "/admin/drivers" },
  { title: "خطط الاشتراك", subtitle: "إدارة الخطط المتاحة للمتقدمين الجدد", icon: "pricetags-outline", route: "/admin/plans?from=more" },
  { title: "المالية والاشتراكات", subtitle: "الحسابات والفواتير والمدفوعات حسب العملة", icon: "wallet-outline", route: "/admin/finance" },
  { title: "عهد السائقين", subtitle: "استلام النقد المؤكد ومتابعة العهدة حسب العملة", icon: "cash-outline", route: "/admin/driver-custody" },
];

export default function AdminMoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!user?.id) {
        if (active) setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const { data, error } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        if (error) throw error;
        if (active) setName(data?.full_name?.trim() ?? "");
      } catch {
        // The session email remains a useful, real identity fallback.
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [user?.id]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch {
      setSignOutError("تعذر تسجيل الخروج. تحقق من الاتصال ثم حاول مجددًا.");
      setConfirmSignOut(false);
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = name || user?.email || "حساب مسؤول النظام";
  const details = user?.email ? [{ icon: "mail-outline" as const, value: user.email }] : [];

  return <AccountShell header={null}>
    <View style={styles.container}>
      <AccountProfileHeader
        name={displayName}
        details={details}
        roleBadge="مسؤول النظام"
        showStatusIndicator={!profileLoading}
      />
      {profileLoading ? <Text style={[styles.loading, { color: colors.textMuted }]}>جارٍ تحميل بيانات الحساب…</Text> : null}

      <AccountSection title="إدارة المنصة" subtitle="الانضمام ومراجعة الطلبات في التبويب المخصص لهما." icon="grid-outline">
        {platformItems.map((item, index) => <AccountMenuItem
          key={item.route}
          title={item.title}
          subtitle={item.subtitle}
          icon={item.icon}
          isLast={index === platformItems.length - 1}
          onPress={() => router.push(item.route)}
        />)}
      </AccountSection>

      <AccountSection title="حسابي" icon="person-outline">
        <View style={styles.accountInfo}>
          <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>الحساب المستخدم للإدارة</Text>
          <Text numberOfLines={1} style={[styles.accountValue, { color: colors.text }]}>{user?.email ?? "لا تتوفر بيانات اتصال في الجلسة الحالية."}</Text>
        </View>
        <AccountMenuItem
          title="تسجيل الخروج"
          subtitle="إنهاء جلسة الإدارة على هذا الجهاز"
          icon="log-out-outline"
          isLast
          loading={signingOut}
          onPress={() => setConfirmSignOut(true)}
        />
      </AccountSection>
      {signOutError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{signOutError}</Text> : null}
    </View>
    <AppConfirmModal
      visible={confirmSignOut}
      title="تسجيل الخروج"
      message="هل تريد إنهاء جلسة مسؤول النظام على هذا الجهاز؟"
      confirmText="تسجيل الخروج"
      cancelText="البقاء"
      destructive
      busy={signingOut}
      onCancel={() => !signingOut && setConfirmSignOut(false)}
      onConfirm={() => void signOut()}
    />
  </AccountShell>;
}

const styles = StyleSheet.create({
  container: { alignSelf: "center", gap: Spacing.two, maxWidth: 800, width: "100%" },
  loading: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  accountInfo: { gap: Spacing.one, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  accountLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  accountValue: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  error: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, marginTop: Spacing.three, textAlign: "right" },
});

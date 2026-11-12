import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AccountSection } from "@/components/account/AccountSection";
import { AppButton } from "@/components/ui/AppButton";
import { MaxContentWidth, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { getDriverApplication, type DriverApplication } from "@/lib/driver-deliveries";
import { assertAccount, deadline } from "@/lib/personal-account";

type Snapshot = { owner: string; data: DriverApplication | null; error: string };

export function DriverProfessionalInfo({ summary = false }: { summary?: boolean } = {}) {
  const { user } = useAuth();
  const owner = user?.id;
  const router = useRouter();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = Math.min(width - 2 * Spacing.four, MaxContentWidth) - 2 * Spacing.three >= 260 * fontScale;
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const current = snapshot?.owner === owner ? snapshot : undefined;
  const data = current?.data;
  const error = current?.error;

  const load = useCallback(async (signal: AbortSignal) => {
    if (!owner) return;
    try {
      const next = await deadline((async () => {
        await assertAccount(owner);
        if (signal.aborted) return null;
        const result = await getDriverApplication(owner, signal);
        if (!signal.aborted) await assertAccount(owner);
        return result;
      })());
      if (signal.aborted) return;
      if (next?.status !== "accepted") {
        setSnapshot({ owner, data: null, error: "لا يتوفر اعتماد سائق فعّال لهذا الحساب." });
        router.replace("/application-status");
        return;
      }
      setSnapshot({ owner, data: next, error: "" });
    } catch {
      if (!signal.aborted) setSnapshot(previous => ({
        owner, data: previous?.owner === owner ? previous.data : null,
        error: "تعذر تحميل بيانات الاعتماد.",
      }));
    }
  }, [owner, router]);

  const refresh = useDriverTaskRefresh(load, Boolean(owner));
  useOrderRealtime({
    channelName: `driver-account:${owner ?? "guest"}`,
    enabled: Boolean(owner),
    subscriptions: owner ? [{ table: "driver_applications", filter: `user_id=eq.${owner}` }] : [],
    sdkManagedRecovery: true,
    onChange: () => refresh("change"),
  });

  if (summary) return owner ? <View style={styles.summary}>
    {error ? <>
      <Text accessibilityRole="alert" style={[styles.badge, { color: colors.warningForeground, backgroundColor: colors.warningSurface }]}>الاعتماد غير مؤكد</Text>
      <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void refresh("manual")} />
    </> : data ? <Text style={[styles.badge, { color: colors.successForeground, backgroundColor: colors.successSurface }]}>سائق معتمد</Text> :
      <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="جارٍ التحقق من الاعتماد" />}
  </View> : null;

  const hours = data?.available_hours;
  const schedule = hours && typeof hours === "object" && !Array.isArray(hours) && typeof hours.schedule === "string"
    ? hours.schedule.trim() : "";
  const fields = data ? [
    { label: "الاسم في طلب الاعتماد", value: data.full_name, wide: true },
    { label: "هاتف العمل", value: data.contact_phone, phone: true },
    { label: "المركبة", value: data.vehicle_type },
    { label: "أوقات التوفر المسجلة", value: schedule, wide: true },
  ] : [];

  return <AccountSection compact title="اعتماد السائق">
    <View style={styles.content}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>للعرض فقط</Text>
      {owner && !current ? <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="جارٍ تحميل بيانات الاعتماد" /> : null}
      {error ? <View style={styles.feedback}>
        <Text accessibilityRole="alert" style={[styles.label, { color: colors.errorForeground }]}>
          {data ? "تعذر تحديث الاعتماد. تظهر آخر بيانات متاحة." : "الاعتماد غير مؤكد. تعذر التحقق من البيانات."}
        </Text>
        <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void refresh("manual")} />
      </View> : null}
      {data ? <>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>حالة الاعتماد</Text>
          <Text style={[styles.badge, {
            color: error ? colors.warningForeground : colors.successForeground,
            backgroundColor: error ? colors.warningSurface : colors.successSurface,
          }]}>{error ? "غير مؤكدة" : "معتمد"}</Text>
        </View>
        <View style={[styles.fields, { borderColor: colors.borderSubtle }]}>
          {fields.map(({ label, value, wide, phone }) => <View key={label}
            style={[styles.field, { flexBasis: wide || !twoColumns ? "100%" : "42%" }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            <Text selectable style={[styles.value, { color: colors.text }, phone && value ? styles.phone : null]}>
              {value?.trim() || "غير مسجل"}
            </Text>
          </View>)}
        </View>
      </> : null}
    </View>
  </AccountSection>;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two },
  summary: { alignItems: "flex-end", gap: Spacing.one, marginTop: Spacing.one, maxWidth: "100%" },
  feedback: { alignItems: "flex-end", gap: Spacing.two },
  statusRow: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  fields: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  field: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: Spacing.half },
  label: { ...Typography.caption, textAlign: "right" },
  value: { ...Typography.bodyStrong, textAlign: "right" },
  phone: { writingDirection: "ltr" },
  badge: { ...Typography.caption, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.three },
});

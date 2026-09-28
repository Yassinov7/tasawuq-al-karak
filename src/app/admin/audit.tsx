import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { WorkspaceEmptyState, WorkspaceFrame, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type AuditActor = { display_name: string; phone: string } | { display_name: string; phone: string }[] | null;
type AuditEntry = {
  id: number;
  actor_user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  created_at: string;
  profiles: AuditActor;
};

const actionLabels: Record<string, string> = {
  INSERT: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
};

const tableLabels: Record<string, string> = {
  "public.merchants": "التجار",
  "public.stores": "المتاجر",
  "public.products": "المنتجات",
  "public.store_products": "منتجات المتاجر",
  "public.orders": "الطلبات",
  "public.sub_orders": "الطلبات الفرعية",
  "public.merchant_subscriptions": "اشتراكات المتاجر",
  "public.subscription_plans": "خطط الاشتراك",
  "public.delivery_zones": "مناطق التوصيل",
  "public.store_settings": "إعدادات المتاجر",
  "public.categories": "التصنيفات",
  "public.drivers": "السائقون",
  "public.payments": "المدفوعات",
};

export default function AdminAudit() {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,actor_user_id,action,table_name,record_id,created_at,profiles(display_name,phone)")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      Alert.alert("تعذر تحميل سجل العمليات", "تحقق من اتصال الإنترنت وصلاحيات الإدارة.");
      return;
    }
    setEntries((data ?? []) as unknown as AuditEntry[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return (
    <WorkspaceFrame title="سجل عمليات الإدارة">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="تحديث سجل العمليات" onPress={() => void refresh()} style={[styles.refresh, { backgroundColor: colors.primaryLight }]}>
            <AppIcon name="refresh-outline" size={19} color={colors.primary} />
          </Pressable>
          <View style={styles.headingCopy}>
            <WorkspaceTitle title="آخر التغييرات" detail="يعرض آخر 100 تغيير مسجل على بيانات المنصة." />
          </View>
        </View>

        {loading ? <Text style={[styles.message, { color: colors.textSecondary }]}>جارٍ تحميل السجل…</Text> : null}
        {!loading && entries.length === 0 ? <WorkspaceEmptyState icon="document-text-outline" title="سجل الإدارة فارغ" detail="ستظهر هنا الإضافات والتعديلات التي تُسجل على بيانات المنصة." /> : null}

        {entries.map((entry) => {
          const actor = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
          const actorLabel = actor?.display_name || actor?.phone || (entry.actor_user_id ? "مستخدم" : "النظام");
          return (
            <View key={entry.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <Text style={[styles.time, { color: colors.textMuted }]}>{new Date(entry.created_at).toLocaleString("ar-SY")}</Text>
                <View style={[styles.actionBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.action, { color: colors.primary }]}>{actionLabels[entry.action] ?? entry.action}</Text>
                </View>
              </View>
              <Text style={[styles.target, { color: colors.text }]}>{tableLabels[entry.table_name] ?? entry.table_name.replace("public.", "")}</Text>
              <Text style={[styles.actor, { color: colors.textSecondary }]}>بواسطة {actorLabel}</Text>
              {entry.record_id ? <Text selectable style={[styles.record, { color: colors.textMuted }]} numberOfLines={1}>معرّف السجل: {entry.record_id}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </WorkspaceFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.two, paddingBottom: Spacing.ten },
  headingRow: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two, marginEnd: Spacing.four },
  headingCopy: { flex: 1 },
  refresh: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.full },
  card: { marginHorizontal: Spacing.four, marginTop: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.lg },
  cardTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  actionBadge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full },
  action: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
  target: { marginTop: Spacing.two, textAlign: "right", fontFamily: Fonts.bold, fontSize: FontSizes.md },
  actor: { marginTop: Spacing.one, textAlign: "right", fontFamily: Fonts.regular, fontSize: FontSizes.sm },
  time: { flex: 1, textAlign: "left", fontFamily: Fonts.regular, fontSize: FontSizes.xs },
  record: { marginTop: Spacing.one, textAlign: "right", fontFamily: Fonts.regular, fontSize: FontSizes.xs },
  message: { marginHorizontal: Spacing.four, marginTop: Spacing.five, textAlign: "center", fontFamily: Fonts.regular },
});

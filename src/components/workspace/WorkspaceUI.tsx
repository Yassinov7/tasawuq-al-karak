import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export function WorkspaceFrame({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme(); const pathname = usePathname(); const router = useRouter(); const { signOut } = useAuth();
  const isAdmin = pathname.startsWith("/admin");
  const showBack = pathname.split("/").filter(Boolean).length > 1;
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); router.replace("/login"); }
    catch { Alert.alert("تعذر تسجيل الخروج", "تحقق من الاتصال وحاول مرة أخرى."); }
    finally { setSigningOut(false); }
  };
  return <View style={[styles.frame, { backgroundColor: colors.background }]}>
    {isAdmin ? <View style={[styles.adminHeader, { backgroundColor: colors.primaryDark }]}>
      <View style={styles.safeTop} />
      <View style={styles.adminHeaderRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={showBack ? "العودة للوحة الإدارة" : "العودة للتسوق"} onPress={() => showBack ? router.replace("/admin" as never) : router.replace("/home")} style={[styles.adminHeaderAction, { backgroundColor: "rgba(255,255,255,0.14)"}]}>
          <AppIcon name={showBack ? "grid-outline" : "cart-outline"} size={19} color="#FFFFFF" />
        </Pressable>
        <View style={styles.adminHeaderCopy}>
          <Text style={styles.adminEyebrow}>تسوق · لوحة الإدارة</Text>
          <Text style={styles.adminTitle} numberOfLines={1}>{title}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="تسجيل الخروج" disabled={signingOut} onPress={() => void handleSignOut()} style={[styles.adminHeaderAction, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
          <AppIcon name="log-out-outline" size={19} color="#FFFFFF" />
        </Pressable>
        <Image source={require("../../../assets/images/branding/taswoq-logo-dark.png")} resizeMode="contain" accessibilityLabel="شعار تسوق" style={styles.adminLogo} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminNav}>
        {[
          ["الرئيسية", "/admin", "home-outline"], ["المراجعة", "/admin/merchants", "checkmark-done-outline"],
          ["الطلبات", "/admin/orders", "receipt-outline"], ["السائقون", "/admin/drivers", "bicycle-outline"],
          ["المالية", "/admin/finance", "wallet-outline"], ["الاشتراكات", "/admin/subscriptions", "card-outline"],
          ["المناطق", "/admin/zones", "map-outline"], ["السجل", "/admin/audit", "document-text-outline"],
        ].map(([label, path, icon]) => {
          const selected = path === "/admin" ? pathname === path : pathname.startsWith(path);
          return <Pressable key={path} onPress={() => router.replace(path as never)} style={[styles.adminNavItem, selected && styles.adminNavItemSelected]}>
            <AppIcon name={icon as React.ComponentProps<typeof AppIcon>["name"]} size={15} color="#FFFFFF" />
            <Text style={styles.adminNavText}>{label}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View> : <AppHeader title={title} showBack={showBack} showMarketplaceActions={false} />}
    {children}
  </View>;
}
export function WorkspaceCard({ title, detail, icon, onPress }: { title: string; detail: string; icon: React.ComponentProps<typeof AppIcon>["name"]; onPress?: () => void }) {
  const { colors } = useTheme(); const Content = <><View style={[styles.icon, { backgroundColor: colors.primaryLight }]}><AppIcon name={icon} size={22} color={colors.primary} /></View><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.cardDetail, { color: colors.textSecondary }]}>{detail}</Text></View>{onPress ? <AppIcon name="chevron-back" size={20} color={colors.textMuted} /> : null}</>;
  return onPress ? <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{Content}</Pressable> : <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{Content}</View>;
}
export function WorkspaceTitle({ title, detail }: { title: string; detail?: string }) { const { colors } = useTheme(); return <View style={styles.sectionTitle}><Text style={[styles.heading, { color: colors.text }]}>{title}</Text>{detail ? <Text style={[styles.cardDetail, { color: colors.textSecondary }]}>{detail}</Text> : null}</View>; }
export function WorkspaceButton({ title, onPress, disabled, danger = false }: { title: string; onPress: () => void; disabled?: boolean; danger?: boolean }) { const { colors } = useTheme(); return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, { backgroundColor: danger ? colors.error : colors.primary }, disabled && styles.disabled]}><Text style={[styles.buttonText, { color: colors.surface }]}>{title}</Text></Pressable>; }
export function WorkspaceField({ label, value, onChangeText, keyboardType = "default", placeholder }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "numeric" | "phone-pad"; placeholder?: string }) { const { colors } = useTheme(); return <View style={styles.field}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder ?? label} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} textAlign="right" /></View>; }
export function WorkspaceStatus({ label, color }: { label: string; color?: string }) { const { colors } = useTheme(); return <View style={[styles.status, { backgroundColor: (color ?? colors.primary) + "20" }]}><Text style={{ color: color ?? colors.primary, fontFamily: Fonts.medium, fontSize: FontSizes.xs }}>{label}</Text></View>; }
export function WorkspaceLoading() { const { colors } = useTheme(); return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>; }
export function WorkspaceConfirmModal({ visible, title, detail, confirmLabel = "تأكيد", cancelLabel = "مراجعة", danger = false, busy = false, onConfirm, onCancel }: { visible: boolean; title: string; detail: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { colors, isDark } = useTheme();
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
    <View style={styles.modalBackdrop}>
      <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.confirmBrand, { backgroundColor: colors.primaryLight }]}>
          <Image source={isDark ? require("../../../assets/images/branding/taswoq-logo-dark.png") : require("../../../assets/images/branding/taswoq-logo-light.png")} resizeMode="contain" accessibilityLabel="شعار تسوق" style={styles.confirmBrandLogo} />
          <Text style={[styles.confirmBrandLabel, { color: colors.primary }]}>منصة تسوق</Text>
        </View>
        <View style={[styles.modalIcon, { backgroundColor: danger ? colors.error + "18" : colors.primaryLight }]}><AppIcon name={danger ? "alert-circle-outline" : "help-circle-outline"} size={26} color={danger ? colors.error : colors.primary} /></View>
        <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.modalDetail, { color: colors.textSecondary }]}>{detail}</Text>
        <View style={styles.modalActions}>
          <Pressable onPress={onCancel} disabled={busy} style={[styles.modalButton, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.modalButtonText, { color: colors.text }]}>{cancelLabel}</Text></Pressable>
          <Pressable onPress={onConfirm} disabled={busy} style={[styles.modalButton, { backgroundColor: danger ? colors.error : colors.primary }, busy && styles.disabled]}><Text style={[styles.modalButtonText, { color: colors.surface }]}>{busy ? "جارٍ التنفيذ…" : confirmLabel}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
export function WorkspaceFormModal({ visible, title, detail, children, onClose }: { visible: boolean; title: string; detail?: string; children: ReactNode; onClose: () => void }) {
  const { colors } = useTheme();
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={[styles.formBackdrop, { backgroundColor: "rgba(15,20,16,0.58)" }]}>
      <View style={[styles.formCard, { backgroundColor: colors.background }]}>
        <View style={[styles.formHandle, { backgroundColor: colors.border }]} />
        <View style={styles.formHeading}>
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={[styles.formClose, { backgroundColor: colors.surfaceSecondary }]}><AppIcon name="close" size={19} color={colors.textSecondary} /></Pressable>
          <View style={{ flex: 1, alignItems: "flex-end" }}><Text style={[styles.modalTitle, { marginTop: 0, color: colors.text }]}>{title}</Text>{detail ? <Text style={[styles.modalDetail, { marginTop: 4, textAlign: "right", fontSize: 12 }]}>{detail}</Text> : null}</View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}
export function WorkspaceEmptyState({ title, detail, icon = "file-tray-outline", actionLabel, onAction }: { title: string; detail: string; icon?: React.ComponentProps<typeof AppIcon>["name"]; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}><AppIcon name={icon} size={23} color={colors.textMuted} /></View>
    <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
    <Text style={[styles.emptyDetail, { color: colors.textSecondary }]}>{detail}</Text>
    {actionLabel && onAction ? <Pressable onPress={onAction} style={[styles.emptyAction, { backgroundColor: colors.primaryLight }]}><Text style={{ color: colors.primary, fontFamily: Fonts.semiBold }}>{actionLabel}</Text></Pressable> : null}
  </View>;
}
export function WorkspaceMetric({ label, value, icon, accent = false, detail }: { label: string; value: string | number; icon: React.ComponentProps<typeof AppIcon>["name"]; accent?: boolean; detail?: string }) {
  const { colors } = useTheme();
  return <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={styles.metricTop}><View style={[styles.metricIcon, { backgroundColor: accent ? colors.accentLight : colors.primaryLight }]}><AppIcon name={icon} size={17} color={accent ? colors.accent : colors.primary} /></View><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text></View>
    <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    {detail ? <Text style={[styles.metricDetail, { color: colors.textMuted }]}>{detail}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ frame: { flex: 1 }, safeTop: { height: 30 }, adminHeader: { paddingBottom: 10 }, adminHeaderRow: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, gap: 11 }, adminHeaderAction: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 14 }, adminLogo: { width: 52, height: 52 }, adminHeaderCopy: { flex: 1, alignItems: "flex-end" }, adminEyebrow: { color: "rgba(255,255,255,0.72)", fontFamily: Fonts.medium, fontSize: 11 }, adminTitle: { marginTop: 2, color: "#FFFFFF", fontFamily: Fonts.bold, fontSize: 20, textAlign: "right" }, adminNav: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 3 }, adminNavItem: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.09)" }, adminNavItemSelected: { backgroundColor: "rgba(255,255,255,0.22)" }, adminNavText: { color: "#FFFFFF", fontFamily: Fonts.medium, fontSize: 11 }, card: { minHeight: 78, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.three, marginHorizontal: Spacing.four, marginTop: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.lg }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.md }, copy: { flex: 1, alignItems: "flex-end" }, cardTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md, textAlign: "right" }, cardDetail: { marginTop: 3, fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 18, textAlign: "right" }, sectionTitle: { marginHorizontal: Spacing.four, marginTop: Spacing.five, marginBottom: 2, alignItems: "flex-end" }, heading: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, button: { minHeight: 48, alignItems: "center", justifyContent: "center", marginHorizontal: Spacing.four, marginTop: Spacing.three, borderRadius: Radius.md }, buttonText: { fontFamily: Fonts.bold, fontSize: FontSizes.sm }, field: { marginHorizontal: Spacing.four, marginTop: Spacing.three }, label: { marginBottom: Spacing.one, fontFamily: Fonts.semiBold, textAlign: "right" }, input: { minHeight: 48, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.md, fontFamily: Fonts.regular }, status: { alignSelf: "flex-end", paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.55 }, modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(15,20,16,0.56)" }, modalCard: { width: "100%", maxWidth: 420, padding: 22, borderRadius: 24, borderWidth: 1, alignItems: "center" }, confirmBrand: { minWidth: 126, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, alignItems: "center", justifyContent: "center" }, confirmBrandLogo: { width: 64, height: 38 }, confirmBrandLabel: { marginTop: 2, fontFamily: Fonts.semiBold, fontSize: 11 }, modalIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 12 }, modalTitle: { marginTop: 14, fontFamily: Fonts.bold, fontSize: 19, textAlign: "center" }, modalDetail: { marginTop: 8, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 23, textAlign: "center" }, modalActions: { flexDirection: "row-reverse", gap: 10, width: "100%", marginTop: 22 }, modalButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 }, modalButtonText: { fontFamily: Fonts.semiBold, fontSize: 14 }, formBackdrop: { flex: 1, justifyContent: "flex-end" }, formCard: { maxHeight: "92%", minHeight: "45%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 9, paddingBottom: 16 }, formHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 4 }, formHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 16 }, formClose: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13 }, empty: { alignItems: "center", marginHorizontal: 16, marginTop: 16, paddingVertical: 24, paddingHorizontal: 20, borderWidth: 1, borderRadius: 18 }, emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" }, emptyTitle: { marginTop: 12, fontFamily: Fonts.bold, fontSize: 15 }, emptyDetail: { maxWidth: 300, marginTop: 6, lineHeight: 21, fontFamily: Fonts.regular, fontSize: 13, textAlign: "center" }, emptyAction: { marginTop: 14, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 }, metric: { flex: 1, minWidth: "46%", padding: 13, borderWidth: 1, borderRadius: 17 }, metricTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, metricIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 11 }, metricLabel: { flex: 1, textAlign: "right", fontFamily: Fonts.medium, fontSize: 11 }, metricValue: { marginTop: 10, textAlign: "right", fontFamily: Fonts.bold, fontSize: 23 }, metricDetail: { marginTop: 2, textAlign: "right", fontFamily: Fonts.regular, fontSize: 10 } });

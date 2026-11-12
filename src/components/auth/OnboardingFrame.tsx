import { Stack } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LayoutSpacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function OnboardingFrame({ title, onCancel, busy = false, children }: { title: string; onCancel?: () => void; busy?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return <SafeAreaView edges={["top", "bottom"]} style={[s.screen, { backgroundColor: colors.background }]}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <View style={[s.header, { borderColor: colors.borderSubtle }]}>
      <Text style={[Typography.sectionTitle, s.title, { color: colors.text }]}>{title}</Text>
      {onCancel ? <Pressable disabled={busy} onPress={onCancel} accessibilityRole="button" style={s.cancel}><Text style={[Typography.bodyStrong, { color: busy ? colors.disabledForeground : colors.primary }]} >إلغاء والعودة</Text></Pressable> : null}
    </View>
    <View style={s.screen}>{children}</View>
  </SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1 }, header: { paddingHorizontal: LayoutSpacing.pageGutter, paddingVertical: 8, flexDirection: "row-reverse", alignItems: "center", gap: 8, borderBottomWidth: 1 }, title: { flex: 1, textAlign: "right" }, cancel: { minHeight: 44, minWidth: 44, justifyContent: "center" } });

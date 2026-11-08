import { Stack } from "expo-router";
import { type ReactNode, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LayoutSpacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function OnboardingFrame({ title, onCancel, busy = false, children }: { title: string; onCancel?: () => void; busy?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  return <SafeAreaView edges={["top", "bottom"]} style={[s.screen, { backgroundColor: colors.background }]}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)} style={[s.header, { borderColor: colors.borderSubtle }]}>
      <Text style={[Typography.sectionTitle, s.title, { color: colors.text }]}>{title}</Text>
      {onCancel ? <Pressable disabled={busy} onPress={onCancel} accessibilityRole="button" style={s.cancel}><Text style={[Typography.bodyStrong, { color: busy ? colors.disabledForeground : colors.primary }]} >إلغاء والعودة</Text></Pressable> : null}
    </View>
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={headerHeight + insets.top}>{children}</KeyboardAvoidingView>
  </SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1 }, header: { paddingHorizontal: LayoutSpacing.pageGutter, paddingVertical: 8, flexDirection: "row-reverse", alignItems: "center", gap: 8, borderBottomWidth: 1 }, title: { flex: 1, textAlign: "right" }, cancel: { minHeight: 44, minWidth: 44, justifyContent: "center" } });

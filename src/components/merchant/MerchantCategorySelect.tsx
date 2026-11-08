import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { LayoutSpacing, Radius, Shadows, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function MerchantCategorySelect({ categories, value, onChange, disabled, label = "تصنيف المتجر" }: {
  categories: { id: string; name: string }[]; value: string; onChange: (id: string) => void; disabled?: boolean; label?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = categories.find((category) => category.id === value);
  const results = categories.filter((category) => category.name.includes(query.trim()));
  return <View style={{ gap: LayoutSpacing.rowGap }}>
    <Pressable accessibilityRole="combobox" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      onPress={() => { setQuery(""); setOpen((previous) => !previous); }}
      style={[styles.trigger, { backgroundColor: colors.surface, borderColor: open ? colors.focusRing : colors.borderStrong }]}>
      <Text style={[Typography.bodyStrong, styles.name, { color: colors.text }]}>{selected?.name ?? (value ? "التصنيف السابق غير متاح — اختر تصنيفًا" : `اختر ${label}`)}</Text>
      <AppIcon name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: colors.overlayScrim }}>
        <Pressable accessibilityLabel="إغلاق قائمة التصنيفات" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", maxWidth: 520, alignSelf: "center", height: Math.min(520, height - insets.top - insets.bottom - 24), maxHeight: "100%" }}>
          <View style={[styles.panel, Shadows.card, { flex: 1, backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Text style={[Typography.cardTitle, styles.name, { color: colors.text }]}>اختر {label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => setOpen(false)} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}><AppIcon name="close" color={colors.primary} size={22} /></Pressable>
            </View>
            <AppTextField design="refined" label="البحث في التصنيفات" value={query} onChangeText={setQuery} autoCorrect={false} />
            <FlatList data={results} keyExtractor={(category) => category.id} extraData={value} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false} overScrollMode="never"
              ListEmptyComponent={<Text style={[Typography.body, { padding: 12, color: colors.textSecondary, textAlign: "right" }]}>لا توجد تصنيفات تطابق البحث.</Text>}
              renderItem={({ item: category }) => <Pressable disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected: category.id === value }}
          onPress={() => { onChange(category.id); setOpen(false); setQuery(""); }}
          style={({ pressed }) => [styles.option, { backgroundColor: pressed ? colors.surfacePressed : category.id === value ? colors.surfaceSelected : colors.surface }]}>
          <Text style={[Typography.body, styles.name, { color: colors.text }]}>{category.name}</Text>
          {category.id === value ? <AppIcon name="checkmark-circle" size={20} color={colors.primary} /> : null}
        </Pressable>} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  trigger: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: Radius.md, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  name: { flex: 1, textAlign: "right", flexShrink: 1 },
  panel: { padding: 8, gap: 8, borderWidth: 1, borderRadius: Radius.md },
  option: { minHeight: 48, padding: 12, gap: 8, flexDirection: "row-reverse", alignItems: "center", borderRadius: Radius.sm },
});

import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { styles } from "@/components/search/searchStyles";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { categoryAncestors } from "@/lib/category-tree";
import type { ProductSort } from "@/lib/customer-search";
import type { Category } from "@/types/catalog";

type Props = {
  categories: Category[];
  categoryId: string | null;
  sort?: ProductSort;
  onApply: (id: string | null, sort: ProductSort) => void;
  onClose: () => void;
  relevanceLabel?: string;
};

export const sortLabels: Record<ProductSort, string> = {
  relevance: "الأنسب",
  "price-ascending": "الأقل سعرًا",
  "price-descending": "الأعلى سعرًا",
};

const sortOptions: ProductSort[] = ["relevance", "price-ascending", "price-descending"];

export function ProductRefinements({ categories, categoryId, sort, onApply, onClose, relevanceLabel = "الأنسب" }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draftCategory, setDraftCategory] = useState(categoryId);
  const [draftSort, setDraftSort] = useState(sort ?? "relevance");
  const [step, setStep] = useState<"summary" | "categories" | "sort">("summary");
  const [parentId, setParentId] = useState<string | null>(null);
  const nodes = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const branchIds = useMemo(() => new Set(categories.map(category => category.parentId)), [categories]);
  const parent = parentId ? nodes.get(parentId) : undefined;
  const selected = draftCategory ? nodes.get(draftCategory) : undefined;
  const path = (category: Category) => categoryAncestors(category, nodes).map(node => node.name).join(" ← ");
  const visible = categories.filter(category => parent ? category.parentId === parent.id : !category.parentId);
  const goUp = () => {
    if (step === "categories" && parent) setParentId(parent.parentId ?? null);
    else if (step !== "summary") setStep("summary");
    else onClose();
  };
  const chooseCategory = (id: string) => {
    setDraftCategory(id);
    setStep("summary");
  };
  const title = step === "categories" ? "اختيار التصنيف" : step === "sort" ? "الترتيب" : "تصفية وترتيب";
  const sortLabel = (value: ProductSort) => value === "relevance" ? relevanceLabel : sortLabels[value];

  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={goUp}>
    <View style={[sheet.overlay, { backgroundColor: colors.overlayScrim, paddingTop: insets.top }]}>
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal style={[sheet.panel, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.two }]}>
        <View style={[styles.row, sheet.heading]}>
          {step !== "summary" ? <Pressable accessibilityRole="button" accessibilityLabel="رجوع داخل الفلاتر"
            onPress={goUp} style={styles.iconButton}>
            <AppIcon name="arrow-forward" size={20} color={colors.text} />
          </Pressable> : null}
          <Text accessibilityRole="header" style={[styles.heading, sheet.label, { color: colors.text }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق الفلاتر" onPress={onClose} style={styles.iconButton}>
            <AppIcon name="close-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView key={step + (parentId ?? "")} style={sheet.body} contentContainerStyle={sheet.bodyContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {step === "summary" ? <>
            {categories.length ? <View style={[sheet.setting, { borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="اختيار التصنيف"
                onPress={() => { setParentId(null); setStep("categories"); }}
                style={[styles.row, sheet.choice]}>
                <AppIcon name="grid-outline" size={19} color={colors.primary} />
                <View style={sheet.label}>
                  <Text style={[styles.selectedText, { color: colors.text }]}>التصنيف</Text>
                  <Text style={[styles.text, { color: colors.textSecondary }]}>{selected ? path(selected) : "كل التصنيفات"}</Text>
                </View>
                <AppIcon name="chevron-back" size={18} color={colors.textMuted} />
              </Pressable>
              {selected ? <Pressable accessibilityRole="button" onPress={() => setDraftCategory(null)}
                style={[styles.row, sheet.choice]}>
                <Text style={[styles.text, { color: colors.primary }]}>مسح التصنيف</Text>
              </Pressable> : null}
            </View> : null}
            {sort !== undefined ? <Pressable accessibilityRole="button" accessibilityLabel="اختيار الترتيب"
              onPress={() => setStep("sort")} style={[styles.row, sheet.setting, sheet.choice, { borderColor: colors.border }]}>
              <AppIcon name="swap-vertical-outline" size={19} color={colors.primary} />
              <View style={sheet.label}>
                <Text style={[styles.selectedText, { color: colors.text }]}>الترتيب</Text>
                <Text style={[styles.text, { color: colors.textSecondary }]}>{sortLabel(draftSort)}</Text>
              </View>
              <AppIcon name="chevron-back" size={18} color={colors.textMuted} />
            </Pressable> : null}
          </> : step === "categories" ? <>
            {parent ? <Text style={[styles.selectedText, { color: colors.primary }]}>{path(parent)}</Text> : null}
            {visible.map(category => {
              const hasChildren = branchIds.has(category.id);
              return <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={category.name}
                onPress={() => hasChildren ? setParentId(category.id) : chooseCategory(category.id)}
                style={[styles.row, sheet.setting, sheet.choice, { borderColor: colors.border }]}>
                <Text style={[styles.text, sheet.label, { color: colors.text }]}>{category.name}</Text>
                {hasChildren || draftCategory === category.id ? <AppIcon
                  name={hasChildren ? "chevron-back" : "checkmark"} size={18} color={colors.primary} /> : null}
              </Pressable>;
            })}
          </> : <View accessibilityRole="radiogroup" accessibilityLabel="الترتيب">
            {sortOptions.map(option => (
              <Pressable key={option} accessibilityRole="radio" accessibilityLabel={sortLabels[option]}
                aria-checked={draftSort === option} accessibilityState={{ checked: draftSort === option }}
                onPress={() => { setDraftSort(option); setStep("summary"); }} style={[styles.row, sheet.choice]}>
                <AppIcon name={draftSort === option ? "radio-button-on" : "radio-button-off"} size={20} color={colors.primary} />
                <Text style={[styles.text, { color: colors.text }]}>{sortLabel(option)}</Text>
              </Pressable>
            ))}
          </View>}
        </ScrollView>
        {step === "summary" ? <View style={[styles.row, sheet.footer, { borderTopColor: colors.border }]}>
          <View style={sheet.label}><AppButton title="تطبيق" onPress={() => onApply(draftCategory, draftSort)} /></View>
          <AppButton fullWidth={false} title="إعادة تعيين" variant="outline"
            onPress={() => { setDraftCategory(null); setDraftSort("relevance"); }} />
        </View> : step === "categories" && parent ? (
          <View style={[sheet.footer, { borderTopColor: colors.border }]}>
            <AppButton title={"اختيار " + parent.name} onPress={() => chooseCategory(parent.id)} />
          </View>
        ) : null}
      </View>
    </View>
  </Modal>;
}

const sheet = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  panel: { width: "100%", maxWidth: 560, maxHeight: "90%", flexShrink: 1, borderTopStartRadius: Radius.xl, borderTopEndRadius: Radius.xl, overflow: "hidden" },
  heading: { paddingHorizontal: Spacing.four, paddingTop: Spacing.one },
  label: { flex: 1, minWidth: 0 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.two },
  setting: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.two },
  choice: { minHeight: ControlSizes.touch, paddingVertical: Spacing.one },
  footer: { borderTopWidth: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, flexWrap: "wrap" },
});

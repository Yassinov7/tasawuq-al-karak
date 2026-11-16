import { useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { styles } from "@/components/search/searchStyles";
import { useTheme } from "@/context/ThemeContext";
import type { SearchFilter } from "@/lib/customer-search";

const filters: { id: SearchFilter; label: string }[] = [
  { id: "products", label: "المنتجات" },
  { id: "stores", label: "المتاجر" },
  { id: "offers", label: "العروض" },
  { id: "categories", label: "التصنيفات" },
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  filter: SearchFilter;
  onFilter: (filter: SearchFilter) => void;
  focusOnEntry: boolean;
  onBack: () => void;
  onOpenRefinements: () => void;
  filterCount: number;
};

export function SearchControls({
  value, onChange, filter, onFilter, focusOnEntry, onBack,
  onOpenRefinements, filterCount,
}: Props) {
  const { colors } = useTheme();
  const [typesOpen, setTypesOpen] = useState(false);
  const activeLabel = filters.find(item => item.id === filter)?.label ?? "المنتجات";
  const canRefine = filter === "products" || filter === "stores";
  const label = filter === "products" ? "ابحث عن منتج" : "ابحث في السوق";
  return <View style={styles.controls}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={onBack} style={styles.iconButton}>
        <AppIcon name="arrow-forward" size={22} color={colors.text} />
      </Pressable>
      <View style={[styles.row, styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppIcon name="search-outline" size={20} color={colors.primary} />
        <TextInput value={value} onChangeText={onChange} onFocus={() => setTypesOpen(false)} accessibilityLabel={label} placeholder={label}
          placeholderTextColor={colors.textMuted} returnKeyType="search" onSubmitEditing={Keyboard.dismiss}
          autoFocus={focusOnEntry} autoCorrect={false} style={[styles.input, { color: colors.text }]} />
        {value ? <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث"
          onPress={() => onChange("")} style={styles.iconButton}>
          <AppIcon name="close-circle" size={20} color={colors.textMuted} />
        </Pressable> : null}
      </View>
    </View>
    <View style={[styles.row, styles.context]}>
      <Pressable accessibilityRole="button" accessibilityLabel={"نوع النتائج · " + activeLabel}
        accessibilityState={{ expanded: typesOpen }} onPress={() => { Keyboard.dismiss(); setTypesOpen(open => !open); }}
        style={[styles.tool, styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.selectedText, { color: colors.text }]}>{activeLabel}</Text>
        <AppIcon name={typesOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {canRefine ? (
        <Pressable accessibilityRole="button" accessibilityLabel="تصفية وترتيب"
          accessibilityHint={filterCount ? "خيارات مفعلة: " + filterCount : undefined}
          onPress={() => { Keyboard.dismiss(); setTypesOpen(false); onOpenRefinements(); }}
          style={[styles.tool, styles.row, { backgroundColor: filterCount ? colors.primaryLight : colors.surface,
            borderColor: filterCount ? colors.primary : colors.border }]}>
          <AppIcon name="options-outline" size={18} color={colors.primary} />
          <Text style={[styles.text, { color: colors.text }]}>تصفية وترتيب</Text>
          {filterCount ? <Text style={[styles.selectedText, { color: colors.primary }]}>{filterCount}</Text> : null}
        </Pressable>
      ) : null}
    </View>
    {typesOpen ? <View accessibilityRole="radiogroup" accessibilityLabel="نوع النتائج"
      style={[styles.typeMenu, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {filters.map(({ id, label: text }) => {
        const selected = id === filter;
        return <Pressable key={id} accessibilityRole="radio" aria-checked={selected}
          accessibilityState={{ checked: selected }} onPress={() => { setTypesOpen(false); onFilter(id); }}
          style={[styles.type, { backgroundColor: selected ? colors.primaryLight : colors.surface }]}>
          <Text style={[selected ? styles.selectedText : styles.text,
            { color: selected ? colors.primary : colors.text }]}>{text}</Text>
        </Pressable>;
      })}
    </View> : null}
  </View>;
}

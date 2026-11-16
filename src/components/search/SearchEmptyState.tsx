import { View } from "react-native";

import { styles } from "@/components/search/searchStyles";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";

type Props = {
  searchText: string;
  onReset?: () => void;
};

export function SearchEmptyState({ searchText, onReset }: Props) {
  return <View style={styles.controls}>
    <AppEmptyState icon="search-outline" title="لم نجد نتائج"
      description={searchText ? "جرّب كلمة مختلفة أو غيّر الفلاتر." : "لا توجد نتائج متاحة ضمن هذا الاختيار."} />
    {onReset ? <AppButton title="إزالة الفلاتر" variant="outline" compact onPress={onReset} /> : null}
  </View>;
}

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Fonts, FontSizes, Spacing } from "@/constants/theme";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

export function CustomerCatalogStatus() {
  const { colors } = useTheme();
  const { loading, error, refresh } = useCustomerCatalog();

  if (!loading && !error) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: error ? colors.error : colors.border,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <>
          <Text style={[styles.message, { color: colors.error }]}>{error}</Text>
          <AppButton
            title="إعادة المحاولة"
            variant="outline"
            onPress={() => void refresh()}
          />
        </>
      ) : (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          جارٍ تحميل بيانات المتاجر والمنتجات...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    gap: Spacing.two,
  },
  message: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },
});

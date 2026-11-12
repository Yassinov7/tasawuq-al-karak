import { useLocalSearchParams, useRouter } from "expo-router";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { MerchantCatalogPanel } from "@/components/merchant/MerchantCatalogPanel";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, MaxContentWidth, Typography, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { catalogTab } from "@/lib/merchant-catalog";

type CatalogTab = "products" | "offers";

const tabs: {
  id: CatalogTab;
  label: string;
  icon: "cube-outline" | "pricetags-outline";
}[] = [
  {
    id: "products",
    label: "المنتجات",
    icon: "cube-outline",
  },
  {
    id: "offers",
    label: "العروض",
    icon: "pricetags-outline",
  },
];

export default function MerchantCatalogScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const activeTab: CatalogTab = catalogTab(params.tab);

  const changeTab = (tab: CatalogTab) => {
    Keyboard.dismiss();
    router.setParams({
      tab,
    });
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
    >

      <View style={styles.tabsWrapper}>
        <View
          style={[
            styles.tabs,
            {
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="tablist"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;

            return (
              <Pressable
                key={tab.id}
                onPress={() => { if (!selected) changeTab(tab.id); }}
                accessibilityRole="tab"
                accessibilityState={{
                  selected,
                }}
                style={({ pressed }) => [
                  styles.tab,
                  {
                    backgroundColor: pressed ? colors.surfacePressed : selected ? colors.surfaceSelected : colors.background,
                    borderBottomColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppIcon
                  name={tab.icon}
                  size={16}
                  color={selected ? colors.primary : colors.textSecondary}
                />

                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: selected ? colors.primary : colors.textSecondary,
                    },
                  ]}
                >
                  {tab.label}
                </Text>

              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        {tabs.map(({ id }) => (
          <View key={id} style={[styles.tabPanel, activeTab !== id && styles.inactivePanel]}
            pointerEvents={activeTab === id ? "auto" : "none"}
            accessibilityElementsHidden={activeTab !== id}
            importantForAccessibility={activeTab === id ? "auto" : "no-hide-descendants"}>
            <MerchantCatalogPanel kind={id} visible={activeTab === id} compact />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabPanel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  inactivePanel: { opacity: 0 },
  screen: {
    flex: 1,
  },

  tabsWrapper: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },

  tabs: {
    direction: "ltr",
    flexDirection: "row-reverse",
    alignSelf: "center",
    width: "100%",
    maxWidth: MaxContentWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },

  tab: {
    flex: 1,
    minHeight: ControlSizes.button,
    paddingVertical: Spacing.two,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    flexWrap: "wrap",
    borderBottomWidth: 2,
  },

  tabLabel: {
    ...Typography.bodyStrong,
  },

  panel: {
    flex: 1,
    minHeight: 0,
  },
});

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MerchantOffersPanel } from "@/app/merchant/offers";
import { MerchantProductsPanel } from "@/app/merchant/products";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type CatalogTab = "products" | "offers";

const tabs: Array<{
  id: CatalogTab;
  label: string;
  icon: "pricetag-outline" | "pricetags-outline";
}> = [
  {
    id: "products",
    label: "المنتجات",
    icon: "pricetag-outline",
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

  const initialTab: CatalogTab =
    params.tab === "offers" ? "offers" : "products";

  const [activeTab, setActiveTab] = useState<CatalogTab>(initialTab);

  useEffect(() => {
    if (params.tab === "offers") {
      setActiveTab("offers");
      return;
    }

    if (params.tab === "products") {
      setActiveTab("products");
    }
  }, [params.tab]);

  const changeTab = (tab: CatalogTab) => {
    setActiveTab(tab);

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
      <AppHeader title="كاتالوج المتجر" mode="business" />

      <View style={styles.tabsWrapper}>
        <View
          style={[
            styles.tabs,
            {
              backgroundColor: colors.surfaceSecondary,
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
                onPress={() => changeTab(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{
                  selected,
                }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: selected ? colors.surface : "transparent",
                    borderColor: selected ? colors.border : "transparent",
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

                {selected ? (
                  <View
                    style={[
                      styles.indicator,
                      {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        {activeTab === "products" ? (
          <MerchantProductsPanel embedded />
        ) : (
          <MerchantOffersPanel embedded />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  tabsWrapper: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },

  tabs: {
    flexDirection: "row-reverse",
    alignSelf: "center",
    width: "100%",
    maxWidth: 500,
    padding: 3,
    borderWidth: 1,
    borderRadius: Radius.md,
    gap: 3,
  },

  tab: {
    position: "relative",
    flex: 1,
    minHeight: 38,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },

  tabLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  indicator: {
    position: "absolute",
    right: 0,
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: Radius.full,
  },

  panel: {
    flex: 1,
    minHeight: 0,
  },
});

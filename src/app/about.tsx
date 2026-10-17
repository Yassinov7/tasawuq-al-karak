import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { AboutContent } from "@/components/about/AboutContent";
import { AboutHeader } from "@/components/about/AboutHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
          >
            <AppIcon name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            معلومات البرنامج
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <AboutHeader />
            <AboutContent />
            <Text style={[styles.footer, { color: colors.textMuted }]}>
              تسوق · الكرك الشرقي
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.five,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.eight,
  },
  contentInner: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  footer: {
    marginTop: Spacing.six,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },
});

import { Link, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { AppIcon } from "@/components/ui/AppIcon";
import {
  Fonts,
  FontSizes,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { LegalRelatedDocument } from "@/components/legal/LegalRelatedDocument";
import { LegalSection } from "@/components/legal/LegalSection";

type LegalPageLayoutProps = {
  title: string;
  intro: {
    title: string;
    description: string;
    updated: string;
  };
  sections: { title: string; paragraphs: string[] }[];
  relatedDocument: {
    title: string;
    description: string;
    href: "/privacy" | "/terms";
    linkLabel: string;
  };
};

export function LegalPageLayout({
  title,
  intro,
  sections,
  relatedDocument,
}: LegalPageLayoutProps) {
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
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View
              style={[
                styles.introCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.introTitle, { color: colors.text }]}>
                {intro.title}
              </Text>
              <Text style={[styles.introText, { color: colors.textSecondary }]}>
                {intro.description}
              </Text>
              <Text style={[styles.updated, { color: colors.textMuted }]}>
                {intro.updated}
              </Text>
            </View>

            {sections.map((section) => (
              <LegalSection key={section.title} {...section} />
            ))}

            <LegalRelatedDocument {...relatedDocument} />

            <Link href="/about" asChild>
              <Pressable
                accessibilityRole="link"
                hitSlop={6}
                style={styles.aboutLinkButton}
              >
                <Text style={[styles.aboutLink, { color: colors.primary }]}>
                  معلومات البرنامج
                </Text>
              </Pressable>
            </Link>
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
    paddingVertical: Spacing.five,
  },
  contentInner: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  introCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginBottom: Spacing.six,
  },
  introTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },
  introText: {
    marginTop: Spacing.two,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
  },
  updated: {
    marginTop: Spacing.three,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },
  aboutLinkButton: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    marginTop: Spacing.four,
  },
  aboutLink: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
});

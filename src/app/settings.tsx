import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { SyriaFlag } from "@/components/ui/SyriaFlag";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { ThemeMode, useSettings } from "@/context/SettingsContext";
import { useTheme } from "@/context/ThemeContext";

type SettingRowProps = {
  icon:
    | "notifications-outline"
    | "moon-outline"
    | "language-outline"
    | "lock-closed-outline"
    | "shield-checkmark-outline"
    | "information-circle-outline";
  title: string;
  subtitle: string;
  rightContent?: React.ReactNode;
  onPress?: () => void;
};

function SettingRow({
  icon,
  title,
  subtitle,
  rightContent,
  onPress,
}: SettingRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingRow,
        {
          borderBottomColor: colors.border,
        },
        pressed && onPress ? styles.pressed : null,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.settingIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={21} color={colors.primary} />
      </View>

      <View style={styles.settingInfo}>
        <Text
          style={[
            styles.settingTitle,
            {
              color: colors.text,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.settingSubtitle,
            {
              color: colors.textMuted,
            },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      {rightContent ?? (
        <AppIcon
          name="chevron-back-outline"
          size={20}
          color={colors.textMuted}
        />
      )}
    </Pressable>
  );
}

type ThemeOptionProps = {
  mode: ThemeMode;
  title: string;
  subtitle: string;
  icon: "phone-portrait-outline" | "sunny-outline" | "moon-outline";
  selected: boolean;
  onPress: () => void;
};

function ThemeOption({
  title,
  subtitle,
  icon,
  selected,
  onPress,
}: ThemeOptionProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeOption,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{
        selected,
      }}
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.themeIcon,
          {
            backgroundColor: selected
              ? colors.primary
              : colors.surfaceSecondary,
          },
        ]}
      >
        <AppIcon
          name={icon}
          size={20}
          color={selected ? colors.surface : colors.textSecondary}
        />
      </View>

      <View style={styles.themeInfo}>
        <Text
          style={[
            styles.themeTitle,
            {
              color: colors.text,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.themeSubtitle,
            {
              color: colors.textMuted,
            },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.radioOuter,
          {
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        {selected ? (
          <View
            style={[
              styles.radioInner,
              {
                backgroundColor: colors.primary,
              },
            ]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    notificationsEnabled,
    themeMode,
    setNotificationsEnabled,
    setThemeMode,
  } = useSettings();

  const { itemCount } = useCart();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="الإعدادات" cartCount={itemCount} mode="shared" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            الإعدادات
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            تحكم بتفضيلات حسابك وتجربة التطبيق
          </Text>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.text,
            },
          ]}
        >
          التطبيق
        </Text>

        <View
          style={[
            styles.section,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <SettingRow
            icon="notifications-outline"
            title="الإشعارات"
            subtitle={
              notificationsEnabled
                ? "استلام تحديثات الطلبات والعروض"
                : "الإشعارات متوقفة"
            }
            rightContent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{
                  false: colors.border,
                  true: colors.primaryLight,
                }}
                thumbColor={
                  notificationsEnabled ? colors.primary : colors.textMuted
                }
                accessibilityLabel="تفعيل الإشعارات"
              />
            }
          />

          <View
            style={[
              styles.themeSection,
              {
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.themeHeader}>
              <View
                style={[
                  styles.settingIcon,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <AppIcon name="moon-outline" size={21} color={colors.primary} />
              </View>

              <View style={styles.themeHeaderInfo}>
                <Text
                  style={[
                    styles.settingTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  المظهر
                </Text>

                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: colors.textMuted,
                    },
                  ]}
                >
                  اختر طريقة ظهور التطبيق
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.themeOptions,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <ThemeOption
                mode="system"
                icon="phone-portrait-outline"
                title="تلقائي حسب الجهاز"
                subtitle="يتبع إعداد مظهر جهازك"
                selected={themeMode === "system"}
                onPress={() => setThemeMode("system")}
              />

              <ThemeOption
                mode="light"
                icon="sunny-outline"
                title="فاتح"
                subtitle="استخدام المظهر الفاتح دائمًا"
                selected={themeMode === "light"}
                onPress={() => setThemeMode("light")}
              />

              <ThemeOption
                mode="dark"
                icon="moon-outline"
                title="داكن"
                subtitle="استخدام المظهر الداكن دائمًا"
                selected={themeMode === "dark"}
                onPress={() => setThemeMode("dark")}
              />
            </View>
          </View>

          <View
            style={[
              styles.languageRow,
              {
                borderTopColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.flag,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <SyriaFlag />
            </View>

            <View style={styles.settingInfo}>
              <Text
                style={[
                  styles.settingTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                اللغة
              </Text>

              <Text
                style={[
                  styles.settingSubtitle,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                العربية
              </Text>
            </View>

            <Text
              style={[
                styles.fixedText,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              حاليًا
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.text,
            },
          ]}
        >
          الخصوصية والأمان
        </Text>

        <View
          style={[
            styles.section,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <SettingRow
            icon="lock-closed-outline"
            title="تغيير كلمة المرور"
            subtitle="تحديث كلمة مرور الحساب"
            onPress={() => router.push("/security")}
          />

          <SettingRow
            icon="shield-checkmark-outline"
            title="الخصوصية"
            subtitle="تعرف على كيفية حماية بياناتك"
            onPress={() => router.push("/privacy")}
          />
        </View>

        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.text,
            },
          ]}
        >
          حول التطبيق
        </Text>

        <View
          style={[
            styles.section,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <SettingRow
            icon="information-circle-outline"
            title="عن تسوق"
            subtitle="معلومات عن التطبيق والمنصة"
            onPress={() => router.push("/about")}
          />
        </View>

        <View style={styles.brandFooter}>
          <Text
            style={[
              styles.brandName,
              {
                color: colors.primary,
              },
            ]}
          >
            تسوق
          </Text>

          <Text
            style={[
              styles.brandRegion,
              {
                color: colors.accent,
              },
            ]}
          >
            الكرك الشرقي
          </Text>

          <Text
            style={[
              styles.version,
              {
                color: colors.textMuted,
              },
            ]}
          >
            الإصدار 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.seven,
  },

  intro: {
    alignItems: "flex-end",
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  sectionTitle: {
    marginTop: Spacing.six,
    marginBottom: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  section: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  settingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 76,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },

  settingIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  settingInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  settingTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  settingSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  themeSection: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
  },

  themeHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  themeHeaderInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  themeOptions: {
    marginTop: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
    borderRadius: Radius.lg,
  },

  themeOption: {
    minHeight: 68,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  themeIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  themeInfo: {
    flex: 1,
    marginHorizontal: Spacing.two,
    alignItems: "flex-end",
  },

  themeTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  themeSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  radioOuter: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: Radius.full,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },

  languageRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 76,
    paddingHorizontal: Spacing.three,
    borderTopWidth: 1,
  },

  flag: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  fixedText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  brandFooter: {
    alignItems: "center",
    marginTop: Spacing.seven,
  },

  brandName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  brandRegion: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  version: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  pressed: {
    opacity: 0.7,
  },
});

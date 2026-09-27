import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

type AccountItem = {
  title: string;
  subtitle: string;
  icon:
    | "receipt-outline"
    | "document-text-outline"
    | "location-outline"
    | "heart-outline"
    | "notifications-outline"
    | "settings-outline";
};

const items: AccountItem[] = [
  {
    title: "طلباتي",
    subtitle: "متابعة الطلبات الحالية والسابقة",
    icon: "receipt-outline",
  },
  {
    title: "الفواتير",
    subtitle: "عرض فواتير مشترياتك",
    icon: "document-text-outline",
  },
  {
    title: "العناوين",
    subtitle: "إدارة عناوين التوصيل",
    icon: "location-outline",
  },
  {
    title: "المفضلة",
    subtitle: "المنتجات والمتاجر المحفوظة",
    icon: "heart-outline",
  },
  {
    title: "الإشعارات",
    subtitle: "إدارة التنبيهات والإشعارات",
    icon: "notifications-outline",
  },
  {
    title: "الإعدادات",
    subtitle: "إعدادات الحساب والتطبيق",
    icon: "settings-outline",
  },
];

export default function AccountTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [savedName, setSavedName] = useState("");
  const [savedPhone, setSavedPhone] = useState("");

  const handleItemPress = (item: AccountItem) => {
    if (item.title === "طلباتي") {
      router.push("/orders");
      return;
    }

    if (item.title === "الفواتير") {
      router.push("/invoice");
      return;
    }

    if (item.title === "العناوين") {
      router.push("/addresses");
      return;
    }

    if (item.title === "المفضلة") {
      router.push("/favorites");
      return;
    }

    if (item.title === "الإشعارات") {
      router.push("/notifications");
      return;
    }

    if (item.title === "الإعدادات") {
      router.push("/settings");
    }
  };

  const handleStartEditing = () => {
    setName(savedName);
    setPhone(savedPhone);
    setIsEditingProfile(true);
  };

  const handleCancelEditing = () => {
    setName(savedName);
    setPhone(savedPhone);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = () => {
    setSavedName(name.trim());
    setSavedPhone(phone.trim());
    setIsEditingProfile(false);
  };

  const displayName = savedName || "أهلاً بك في تسوق";

  const displayPhone = savedPhone || "أضف رقم هاتفك لإدارة حسابك";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="حسابي" cartCount={itemCount} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon name="person-outline" size={30} color={colors.primary} />

              <View
                style={[
                  styles.avatarDot,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.surface,
                  },
                ]}
              />
            </View>

            <View style={styles.profileInfo}>
              <Text
                style={[
                  styles.profileName,
                  {
                    color: colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>

              <View style={styles.phoneRow}>
                <AppIcon
                  name="call-outline"
                  size={13}
                  color={colors.textMuted}
                />

                <Text
                  style={[
                    styles.profileSubtitle,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {displayPhone}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleStartEditing}
              style={({ pressed }) => [
                styles.editButton,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
                pressed && styles.pressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="تعديل الملف الشخصي"
            >
              <AppIcon name="create-outline" size={19} color={colors.primary} />
            </Pressable>
          </View>

          {isEditingProfile ? (
            <View
              style={[
                styles.profileForm,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.formHeader}>
                <View
                  style={[
                    styles.formIcon,
                    {
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                >
                  <AppIcon
                    name="person-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.formTitleArea}>
                  <Text
                    style={[
                      styles.formTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    تعديل الملف الشخصي
                  </Text>

                  <Text
                    style={[
                      styles.formSubtitle,
                      {
                        color: colors.textMuted,
                      },
                    ]}
                  >
                    حدّث معلوماتك الشخصية
                  </Text>
                </View>

                <Pressable
                  onPress={handleCancelEditing}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق تعديل الملف الشخصي"
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon
                    name="close-outline"
                    size={23}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الاسم
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppIcon
                  name="person-outline"
                  size={18}
                  color={colors.textMuted}
                />

                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="مثلاً: أحمد محمد"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                    },
                  ]}
                  textAlign="right"
                  returnKeyType="next"
                />
              </View>

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                رقم الهاتف
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppIcon
                  name="call-outline"
                  size={18}
                  color={colors.textMuted}
                />

                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="مثلاً: 09xxxxxxxx"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                    },
                  ]}
                  textAlign="right"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formActions}>
                <Pressable
                  onPress={handleCancelEditing}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    إلغاء
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveProfile}
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon
                    name="checkmark-outline"
                    size={18}
                    color={colors.surface}
                  />

                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: colors.surface,
                      },
                    ]}
                  >
                    حفظ التغييرات
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.sectionHeader,
              {
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.sectionIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon name="grid-outline" size={18} color={colors.primary} />
            </View>

            <View style={styles.sectionTitleArea}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                حسابك
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                إدارة طلباتك ومعلوماتك
              </Text>
            </View>
          </View>

          <View style={styles.menu}>
            {items.map((item) => (
              <Pressable
                key={item.title}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View
                  style={[
                    styles.menuIcon,
                    {
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                >
                  <AppIcon name={item.icon} size={21} color={colors.primary} />
                </View>

                <View style={styles.menuContent}>
                  <Text
                    style={[
                      styles.menuTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={[
                      styles.menuSubtitle,
                      {
                        color: colors.textMuted,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                </View>

                <View
                  style={[
                    styles.menuArrow,
                    {
                      backgroundColor: colors.surfaceSecondary,
                    },
                  ]}
                >
                  <AppIcon
                    name="chevron-back-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>
            ))}
          </View>

          <View
            style={[
              styles.accountNote,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.accountNoteIcon,
                {
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <AppIcon
                name="shield-checkmark-outline"
                size={17}
                color={colors.primary}
              />
            </View>

            <View style={styles.accountNoteContent}>
              <Text
                style={[
                  styles.accountNoteTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                حسابك تحت سيطرتك
              </Text>

              <Text
                style={[
                  styles.accountNoteText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                يمكنك تعديل معلوماتك وإدارة تفضيلات التطبيق من هذه الصفحة.
              </Text>
            </View>
          </View>

          <View style={styles.version}>
            <Text
              style={[
                styles.versionText,
                {
                  color: colors.primary,
                },
              ]}
            >
              تسوق
            </Text>

            <Text
              style={[
                styles.versionNumber,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              الإصدار 1.0.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },

  profileCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  avatar: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
    position: "relative",
  },

  avatarDot: {
    position: "absolute",
    width: 12,
    height: 12,
    right: 1,
    bottom: 1,
    borderWidth: 2,
    borderRadius: Radius.full,
  },

  profileInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  profileName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  phoneRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
    maxWidth: "100%",
  },

  profileSubtitle: {
    flexShrink: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  editButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  profileForm: {
    marginTop: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  formHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  formIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  formTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  formTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  formSubtitle: {
    marginTop: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  inputLabel: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  inputContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.two,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  formActions: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    marginTop: Spacing.five,
  },

  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  cancelButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  saveButton: {
    flex: 1.4,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 50,
    borderRadius: Radius.md,
  },

  saveButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.six,
    marginBottom: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },

  sectionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  sectionTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  menu: {
    gap: Spacing.two,
  },

  menuItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 76,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  menuIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  menuContent: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  menuTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  menuSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  menuArrow: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  accountNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.five,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  accountNoteIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  accountNoteContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  accountNoteTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  accountNoteText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  version: {
    alignItems: "center",
    marginTop: Spacing.six,
  },

  versionText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  versionNumber: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  pressed: {
    opacity: 0.7,
  },
});

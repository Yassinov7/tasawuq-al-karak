import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountProfileHeader } from "@/components/account/AccountProfileHeader";
import { AccountSection } from "@/components/account/AccountSection";
import { AccountShell } from "@/components/account/AccountShell";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { peekLocalCache, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { supabase } from "@/lib/supabase";

type CachedCustomerProfile = {
  name: string;
  phone: string;
};

const CUSTOMER_PROFILE_CACHE_PREFIX = "customer-profile:";

type AccountItem = {
  title: string;
  subtitle: string;
  icon:
    | "receipt-outline"
    | "document-text-outline"
    | "location-outline"
    | "heart-outline"
    | "notifications-outline"
    | "settings-outline"
    | "lock-closed-outline";
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
    title: "المفضلة",
    subtitle: "المنتجات والمتاجر المحفوظة",
    icon: "heart-outline",
  },
  {
    title: "العناوين",
    subtitle: "إدارة عناوين التوصيل",
    icon: "location-outline",
  },
  {
    title: "الإشعارات",
    subtitle: "التنبيهات والتحديثات المرتبطة بطلباتك",
    icon: "notifications-outline",
  },
  {
    title: "الإعدادات",
    subtitle: "إعدادات الحساب والتطبيق",
    icon: "settings-outline",
  },
  {
    title: "الأمان وكلمة المرور",
    subtitle: "إدارة أمان حسابك",
    icon: "lock-closed-outline",
  },
];

const menuSections = [
  { title: "مشترياتي", items: items.slice(0, 4) },
  { title: "إدارة الحساب", items: items.slice(4) },
];

export default function AccountTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [savedName, setSavedName] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const userId = user?.id;
  const metadataPhone = user?.user_metadata?.phone;

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!userId) {
        setSavedName("");
        setSavedPhone("");
        setProfileLoading(false);
        return;
      }

      const cacheKey = `${CUSTOMER_PROFILE_CACHE_PREFIX}${userId}`;
      const cachedProfile =
        peekLocalCache<CachedCustomerProfile>(cacheKey) ??
        (await readLocalCache<CachedCustomerProfile>(cacheKey));
      if (!active) return;

      if (cachedProfile) {
        setProfileError(null);
        setSavedName(cachedProfile.name);
        setSavedPhone(cachedProfile.phone);
        setName(cachedProfile.name);
        setPhone(cachedProfile.phone);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        const nextName = data?.full_name ?? "";
        const nextPhone = typeof metadataPhone === "string" ? metadataPhone : "";
        setSavedName(nextName);
        setSavedPhone(nextPhone);
        setName(nextName);
        setPhone(nextPhone);
        await writeLocalCache(cacheKey, {
          name: nextName,
          phone: nextPhone,
        } satisfies CachedCustomerProfile);
      } catch (cause) {
        if (active) {
          setProfileError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات الحساب.");
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [metadataPhone, userId]);

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
      return;
    }

    if (item.title === "الأمان وكلمة المرور") {
      router.push("/security");
    }
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: () => {
          void supabase.auth.signOut().then(({ error }) => {
            if (error) throw error;
            router.replace("/login");
          }).catch((cause: unknown) => {
            Alert.alert(
              "تعذر تسجيل الخروج",
              cause instanceof Error ? cause.message : "تحقق من الاتصال وحاول مجددًا.",
            );
          });
        },
      },
    ]);
  };

  const handleStartEditing = () => {
    setName(savedName);
    setPhone(savedPhone);
    setProfileError(null);
    setProfileNotice(null);
    setIsEditingProfile(true);
  };

  const handleCancelEditing = () => {
    setName(savedName);
    setPhone(savedPhone);
    setProfileError(null);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!user) {
      setProfileError("سجّل الدخول لتحديث بيانات حسابك.");
      return;
    }
    if (cleanName.length < 2 || (cleanPhone.length > 0 && cleanPhone.length < 5)) {
      setProfileError("أدخل اسمًا من حرفين على الأقل ورقم هاتف صحيحًا.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ full_name: cleanName })
        .eq("id", user.id);
      if (profileUpdateError) throw profileUpdateError;
      setSavedName(cleanName);
      await writeLocalCache(`${CUSTOMER_PROFILE_CACHE_PREFIX}${user.id}`, {
        name: cleanName,
        phone: savedPhone,
      } satisfies CachedCustomerProfile);

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: { phone: cleanPhone },
      });
      if (authUpdateError) {
        setProfileError(`تم حفظ الاسم، لكن تعذر حفظ الهاتف: ${authUpdateError.message}`);
        return;
      }

      setSavedPhone(cleanPhone);
      setName(cleanName);
      setPhone(cleanPhone);
      await writeLocalCache(`${CUSTOMER_PROFILE_CACHE_PREFIX}${user.id}`, {
        name: cleanName,
        phone: cleanPhone,
      } satisfies CachedCustomerProfile);
      setIsEditingProfile(false);
      setProfileNotice("تم تحديث بيانات حسابك.");
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : "تعذر حفظ بيانات الحساب.");
    } finally {
      setSavingProfile(false);
    }
  };

  const displayName = savedName || user?.email || "أهلاً بك في تسوق";

  const displayPhone = savedPhone || "أضف رقم هاتفك لإدارة حسابك";

  return (
    <AccountShell
      header={<AppHeader title="حسابي" cartCount={itemCount} mode="customer" />}
      keyboardAware
    >
          <AccountProfileHeader
            name={displayName}
            details={[{ icon: "call-outline", value: displayPhone }]}
            onEdit={handleStartEditing}
          />

          {profileLoading ? (
            <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "center" }}>جارٍ تحميل بيانات الحساب...</Text>
          ) : null}
          {/* {user?.email ? (
            // <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", paddingHorizontal: Spacing.one }}>
            //   {user.email}
            // </Text>
          ) : null} */}
          {profileError ? (
            <Text accessibilityRole="alert" style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }}>
              {profileError}
            </Text>
          ) : null}
          {profileNotice ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.primary, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }}>
              {profileNotice}
            </Text>
          ) : null}

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
                  onPress={() => void handleSaveProfile()}
                  disabled={savingProfile}
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: savingProfile ? 0.6 : pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <AppIcon
                    name={savingProfile ? "time-outline" : "checkmark-outline"}
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
                    {savingProfile ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {menuSections.map((section) => (
            <AccountSection key={section.title} title={section.title}>
              {section.items.map((item, index) => (
                <AccountMenuItem
                  key={item.title}
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  isLast={index === section.items.length - 1}
                  onPress={() => handleItemPress(item)}
                />
              ))}
            </AccountSection>
          ))}

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الخروج"
          >
            <AppIcon name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>تسجيل الخروج</Text>
          </Pressable>

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
    </AccountShell>
  );
}

const styles = StyleSheet.create({
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

  logoutButton: {
    alignItems: "center",
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: Spacing.two,
    justifyContent: "center",
    marginTop: Spacing.two,
    minHeight: 54,
  },

  logoutText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
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

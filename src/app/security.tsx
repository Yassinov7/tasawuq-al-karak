import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

export default function MerchantSecurityScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successVisible, setSuccessVisible] = useState(false);

  const email = user?.email ?? "";

  const changePassword = async () => {
    setError("");

    if (!user || !email) {
      setError("تعذر قراءة بيانات الحساب. سجّل الدخول مرة أخرى.");
      return;
    }

    if (!currentPassword) {
      setError("أدخل كلمة المرور الحالية.");
      return;
    }

    if (newPassword.length < 8) {
      setError("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.");
      return;
    }

    if (newPassword !== passwordConfirmation) {
      setError("كلمتا المرور الجديدتان غير متطابقتين.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("كلمة المرور الجديدة يجب أن تختلف عن الحالية.");
      return;
    }

    setBusy(true);

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyError) {
        setError("كلمة المرور الحالية غير صحيحة.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError("تعذر تغيير كلمة المرور. حاول مرة أخرى.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setSuccessVisible(true);
    } catch {
      setError("تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AppHeader
        title="الأمان وكلمة المرور"
        // cartCount={itemCount}
        mode="shared"
      />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.introIcon,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            <AppIcon
              name="shield-checkmark-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.introContent}>
            <Text
              style={[
                styles.introTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              حماية حسابك
            </Text>

            <Text
              style={[
                styles.introText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              يمكنك تغيير كلمة المرور من هنا. لن نسمح بتغيير البريد الإلكتروني
              المرتبط بالحساب.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            البريد الإلكتروني
          </Text>

          <View
            style={[
              styles.emailRow,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emailIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon name="mail-outline" size={20} color={colors.primary} />
            </View>

            <View style={styles.emailContent}>
              <Text
                style={[
                  styles.emailLabel,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                البريد المرتبط بالحساب
              </Text>

              <Text
                style={[
                  styles.emailValue,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {email || "غير متوفر"}
              </Text>
            </View>

            <AppIcon
              name="lock-closed-outline"
              size={17}
              color={colors.textMuted}
            />
          </View>

          <Text
            style={[
              styles.readOnlyText,
              {
                color: colors.textMuted,
              },
            ]}
          >
            البريد الإلكتروني للعرض فقط ولا يمكن تغييره من حساب التاجر.
          </Text>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeading}>
            <View
              style={[
                styles.sectionIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="lock-closed-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.sectionHeadingContent}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                تغيير كلمة المرور
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                أدخل كلمة المرور الحالية ثم اختر كلمة مرور جديدة.
              </Text>
            </View>
          </View>

          <View style={styles.fields}>
            <AppTextField
              label="كلمة المرور الحالية"
              value={currentPassword}
              onChangeText={(value) => {
                setCurrentPassword(value);
                setError("");
              }}
              secureTextEntry
              autoComplete="current-password"
              placeholder="أدخل كلمة المرور الحالية"
              returnKeyType="next"
            />

            <AppTextField
              label="كلمة المرور الجديدة"
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                setError("");
              }}
              secureTextEntry
              autoComplete="new-password"
              placeholder="٨ أحرف على الأقل"
              returnKeyType="next"
            />

            <AppTextField
              label="تأكيد كلمة المرور الجديدة"
              value={passwordConfirmation}
              onChangeText={(value) => {
                setPasswordConfirmation(value);
                setError("");
              }}
              secureTextEntry
              autoComplete="new-password"
              placeholder="أعد كتابة كلمة المرور الجديدة"
              returnKeyType="done"
              onSubmitEditing={() => void changePassword()}
            />
          </View>

          <View
            style={[
              styles.passwordHint,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <AppIcon
              name="information-circle-outline"
              size={17}
              color={colors.textSecondary}
            />

            <Text
              style={[
                styles.passwordHintText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل وأن تختلف عن
              كلمة المرور الحالية.
            </Text>
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.error,
                },
              ]}
            >
              <AppIcon
                name="alert-circle-outline"
                size={18}
                color={colors.error}
              />

              <Text
                style={[
                  styles.errorText,
                  {
                    color: colors.error,
                  },
                ]}
              >
                {error}
              </Text>
            </View>
          ) : null}

          <AppButton
            title={busy ? "جارٍ تغيير كلمة المرور…" : "تغيير كلمة المرور"}
            icon="checkmark-outline"
            loading={busy}
            disabled={busy}
            onPress={() => void changePassword()}
          />
        </View>

        <View
          style={[
            styles.securityNote,
            {
              borderColor: colors.border,
            },
          ]}
        >
          <AppIcon
            name="shield-checkmark-outline"
            size={20}
            color={colors.primary}
          />

          <Text
            style={[
              styles.securityNoteText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            لا يتم تخزين كلمات المرور داخل التطبيق أو في التخزين المحلي.
          </Text>
        </View>

        <AppButton
          title="العودة إلى الحساب"
          variant="outline"
          icon="arrow-back"
          onPress={() => router.back()}
        />
      </ScrollView>

      <AppModal
        visible={successVisible}
        title="تم تغيير كلمة المرور"
        message="تم تحديث كلمة المرور بنجاح. يمكنك استخدام كلمة المرور الجديدة عند تسجيل الدخول القادم."
        icon="checkmark-circle-outline"
        confirmText="تم"
        onConfirm={() => setSuccessVisible(false)}
        onCancel={() => setSuccessVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  container: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.ten,
    gap: Spacing.four,
  },

  introCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  introIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  introContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  introTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  introText: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  section: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },

  sectionHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeadingContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  emailRow: {
    minHeight: 62,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  emailIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  emailContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  emailLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  emailValue: {
    marginTop: 2,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  readOnlyText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  fields: {
    gap: Spacing.three,
  },

  passwordHint: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  passwordHintText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  errorText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 21,
    textAlign: "right",
  },

  securityNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
  },

  securityNoteText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },
});

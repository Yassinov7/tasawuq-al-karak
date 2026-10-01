import { Link, useRouter, type Href } from "expo-router";
import { useState } from "react";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAccountRoute } from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const login = async () => {
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    if (!password) {
      setError("أدخل كلمة المرور.");
      return;
    }

    setBusy(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError || !data.user) {
        setError(
          loginError?.message.includes("Email not confirmed")
            ? "أكد بريدك الإلكتروني من الرسالة التي وصلتك، ثم سجّل الدخول."
            : "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.",
        );
        return;
      }

      try {
        const destination = await getAccountRoute(data.user.id);

        router.replace(destination as Href);
      } catch {
        setError(
          "تعذر قراءة دور الحساب. تأكد من تطبيق ترحيل الحسابات ثم حاول مجددًا.",
        );

        await supabase.auth.signOut();
      }
    } catch {
      setError("تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  };

  const openResetModal = () => {
    setResetMessage("");
    setResetVisible(true);
  };

  const sendReset = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setResetMessage("أدخل بريدًا إلكترونيًا صحيحًا في صفحة الدخول أولًا.");
      return;
    }

    setResetBusy(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail);

      setResetMessage(
        resetError
          ? "تعذر إرسال الرسالة الآن. تحقق من إعداد البريد في Supabase."
          : "إذا كان البريد مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.",
      );
    } catch {
      setResetMessage("تعذر الاتصال بالخدمة الآن. حاول مجددًا بعد قليل.");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <BrandMark size="large" />

          <View style={styles.form}>
            <Text style={[styles.title, { color: colors.text }]}>
              تسجيل الدخول
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              أهلًا بعودتك إلى تسوق
            </Text>

            <View style={styles.fields}>
              <AppTextField
                label="البريد الإلكتروني"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                placeholder="name@example.com"
                returnKeyType="next"
              />

              <AppTextField
                label="كلمة المرور"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError("");
                }}
                secureTextEntry
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور"
                returnKeyType="done"
                onSubmitEditing={() => void login()}
              />
            </View>

            <View style={styles.forgotRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="نسيت كلمة المرور"
                onPress={openResetModal}
                hitSlop={8}
                style={styles.forgotButton}
              >
                <AppIcon
                  name="help-circle-outline"
                  size={17}
                  color={colors.primary}
                />

                <Text style={[styles.forgotText, { color: colors.primary }]}>
                  نسيت كلمة المرور؟
                </Text>
              </Pressable>
            </View>

            {error ? (
              <Text
                style={[
                  styles.error,
                  {
                    color: colors.error,
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                {error}
              </Text>
            ) : null}

            <AppButton
              title={busy ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
              onPress={() => void login()}
              loading={busy}
              disabled={busy}
            />

            <View style={styles.signupRow}>
              <Text
                style={[styles.signupText, { color: colors.textSecondary }]}
              >
                ليس لديك حساب؟
              </Text>

              <Link href="/signup" asChild>
                <Pressable accessibilityRole="button" hitSlop={8}>
                  <Text style={[styles.signupLink, { color: colors.primary }]}>
                    إنشاء حساب
                  </Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.infoLinks}>
              <Link href="/terms" asChild>
                <Pressable hitSlop={6}>
                  <Text style={[styles.infoLink, { color: colors.primary }]}>
                    شروط الاستخدام
                  </Text>
                </Pressable>
              </Link>

              <View
                style={[
                  styles.linkSeparator,
                  { backgroundColor: colors.border },
                ]}
              />

              <Link href="/privacy" asChild>
                <Pressable hitSlop={6}>
                  <Text style={[styles.infoLink, { color: colors.primary }]}>
                    سياسة الخصوصية
                  </Text>
                </Pressable>
              </Link>

              <View
                style={[
                  styles.linkSeparator,
                  { backgroundColor: colors.border },
                ]}
              />

              <Link href="/about" asChild>
                <Pressable hitSlop={6}>
                  <Text style={[styles.infoLink, { color: colors.primary }]}>
                    معلومات البرنامج وإصداره
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>

      <AppModal
        visible={resetVisible}
        title="إعادة تعيين كلمة المرور"
        message={
          resetMessage ||
          "سنرسل رابط إعادة التعيين إلى البريد المكتوب في صفحة الدخول."
        }
        icon="mail-outline"
        confirmText={
          resetBusy ? "جارٍ الإرسال…" : resetMessage ? "إغلاق" : "إرسال الرابط"
        }
        cancelText="رجوع"
        busy={resetBusy}
        onCancel={() => {
          if (!resetBusy) {
            setResetVisible(false);
          }
        }}
        onConfirm={
          resetMessage ? () => setResetVisible(false) : () => void sendReset()
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },

  page: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingVertical: Spacing.five,
  },

  form: {
    width: "100%",
    marginTop: Spacing.six,
  },

  title: {
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  subtitle: {
    marginTop: Spacing.two,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  fields: {
    gap: Spacing.three,
    marginTop: Spacing.five,
  },

  forgotRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: Spacing.two,
  },

  forgotButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },

  forgotText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    lineHeight: 21,
  },

  error: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    textAlign: "right",
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  signupRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "baseline",
    gap: Spacing.one,
    marginTop: Spacing.five,
  },

  signupText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  signupLink: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  infoLinks: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    marginTop: Spacing.six,
  },

  infoLink: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 20,
  },

  linkSeparator: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
  },
});

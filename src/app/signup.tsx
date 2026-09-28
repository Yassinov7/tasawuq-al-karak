import { Href, Link, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/utils/authError";
import { normalizePhoneNumber } from "@/utils/phone";

export default function SignupScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const scrollToInput = (y: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y,
        animated: true,
      });
    }, 150);
  };

  const handleSignup = async () => {
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(phone);

    if (!cleanName) {
      setError("يرجى إدخال الاسم");
      return;
    }

    if (cleanName.length < 2) {
      setError("يرجى إدخال اسم صحيح");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }

    if (!normalizedPhone) {
      setError("يرجى إدخال رقم هاتف بصيغته الدولية مع مفتاح الدولة (+)");
      return;
    }

    if (!password) {
      setError("يرجى إدخال كلمة المرور");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    if (!confirmPassword) {
      setError("يرجى تأكيد كلمة المرور");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { display_name: cleanName, phone: normalizedPhone } },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace("/home" as Href);
      } else if (data.user) {
        router.replace({
          pathname: "/verify-email",
          params: { email: cleanEmail },
        } as unknown as Href);
      } else {
        setError("تعذر إنشاء الحساب. حاول مرة أخرى");
      }
    } catch (signUpError) {
      setError(authErrorMessage(signUpError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <BrandMark size="small" showSubtitle={false} />

          <View style={styles.form}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              إنشاء حساب
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              أنشئ حسابك وابدأ التسوق من منطقتك
            </Text>

            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الاسم
              </Text>

              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setError("");
                }}
                placeholder="أدخل اسمك"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  },
                ]}
                textAlign="right"
                returnKeyType="next"
                editable={!isLoading}
                onFocus={() => scrollToInput(100)}
                accessibilityLabel="الاسم"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>البريد الإلكتروني</Text>
              <TextInput
                value={email}
                onChangeText={(value) => { setEmail(value); setError(""); }}
                placeholder="example@email.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                textAlign="left"
                returnKeyType="next"
                editable={!isLoading}
                onFocus={() => scrollToInput(180)}
                accessibilityLabel="البريد الإلكتروني"
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>سيُستخدم لتأكيد الحساب وتسجيل الدخول</Text>
            </View>

            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                  },
                ]}
              >
                رقم الهاتف
              </Text>

              <TextInput
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setError("");
                }}
                placeholder="أدخل الرقم مع مفتاح الدولة (+)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  },
                ]}
                textAlign="right"
                returnKeyType="next"
                editable={!isLoading}
                onFocus={() => scrollToInput(180)}
                accessibilityLabel="رقم الهاتف"
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>للتواصل معك فقط، ولا يحتاج إلى رمز SMS</Text>
            </View>

            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                  },
                ]}
              >
                كلمة المرور
              </Text>

              <View
                style={[
                  styles.passwordContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  placeholder="أدخل كلمة المرور"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  style={[
                    styles.passwordInput,
                    {
                      color: colors.text,
                    },
                  ]}
                  textAlign="right"
                  returnKeyType="next"
                  editable={!isLoading}
                  onFocus={() => scrollToInput(350)}
                  accessibilityLabel="كلمة المرور"
                />

                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  <Text
                    style={[
                      styles.passwordToggle,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    {showPassword ? "إخفاء" : "إظهار"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                  },
                ]}
              >
                تأكيد كلمة المرور
              </Text>

              <View
                style={[
                  styles.passwordContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <TextInput
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setError("");
                  }}
                  placeholder="أعد إدخال كلمة المرور"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  style={[
                    styles.passwordInput,
                    {
                      color: colors.text,
                    },
                  ]}
                  textAlign="right"
                  returnKeyType="done"
                  editable={!isLoading}
                  onFocus={() => scrollToInput(440)}
                  onSubmitEditing={handleSignup}
                  accessibilityLabel="تأكيد كلمة المرور"
                />

                <Pressable
                  onPress={() => setShowConfirmPassword((value) => !value)}
                  hitSlop={10}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword
                      ? "إخفاء تأكيد كلمة المرور"
                      : "إظهار تأكيد كلمة المرور"
                  }
                >
                  <Text
                    style={[
                      styles.passwordToggle,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    {showConfirmPassword ? "إخفاء" : "إظهار"}
                  </Text>
                </Pressable>
              </View>
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

            <Pressable
              style={({ pressed }) => [
                styles.signupButton,
                {
                  backgroundColor: colors.primary,
                },
                isLoading && styles.signupButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSignup}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="إنشاء الحساب"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text
                  style={[
                    styles.signupButtonText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  إنشاء الحساب
                </Text>
              )}
            </Pressable>

            <View style={styles.loginRow}>
              <Text
                style={[
                  styles.loginText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                لديك حساب بالفعل؟
              </Text>

              <Link href="/login" asChild>
                <Pressable
                  hitSlop={8}
                  disabled={isLoading}
                  accessibilityRole="link"
                  accessibilityLabel="تسجيل الدخول"
                >
                  <Text
                    style={[
                      styles.loginLink,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    تسجيل الدخول
                  </Text>
                </Pressable>
              </Link>
            </View>
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
    flexGrow: 1,
    paddingHorizontal: Spacing.six,
    paddingTop: Spacing.four,
    paddingBottom: 180,
  },

  form: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    marginTop: Spacing.five,
  },

  title: {
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
  },

  subtitle: {
    marginTop: Spacing.two,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 24,
  },

  field: {
    marginTop: Spacing.four,
  },

  label: {
    marginBottom: Spacing.two,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  optional: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  helperText: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  input: {
    minHeight: 54,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.md,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
  },

  passwordContainer: {
    minHeight: 54,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  passwordInput: {
    flex: 1,
    minHeight: 52,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
  },

  passwordToggle: {
    marginLeft: Spacing.two,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  errorBox: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  errorText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 21,
    textAlign: "right",
  },

  signupButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.five,
    borderRadius: Radius.md,
  },

  signupButtonDisabled: {
    opacity: 0.7,
  },

  signupButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.five,
  },

  loginText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  loginLink: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.7,
  },
});

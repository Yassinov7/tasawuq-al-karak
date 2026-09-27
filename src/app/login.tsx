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

export default function LoginScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { colors } = useTheme();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const handleLogin = () => {
    setError("");

    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanPhone) {
      setError("يرجى إدخال رقم الهاتف");
      return;
    }

    if (cleanPhone.length < 8) {
      setError("يرجى إدخال رقم هاتف صحيح");
      return;
    }

    if (!cleanPassword) {
      setError("يرجى إدخال كلمة المرور");
      return;
    }

    if (cleanPassword.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.replace("/home" as Href);
    }, 800);
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
          <BrandMark size="large" />

          <View style={styles.form}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              تسجيل الدخول
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              سجّل دخولك للمتابعة إلى تسوق
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
                رقم الهاتف
              </Text>

              <TextInput
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setError("");
                }}
                placeholder="أدخل رقم الهاتف"
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
                onFocus={() => scrollToInput(150)}
                accessibilityLabel="رقم الهاتف"
              />
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
                  returnKeyType="done"
                  editable={!isLoading}
                  onFocus={() => scrollToInput(250)}
                  onSubmitEditing={handleLogin}
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
                styles.loginButton,
                {
                  backgroundColor: colors.primary,
                },
                isLoading && styles.loginButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الدخول"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text
                  style={[
                    styles.loginButtonText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  تسجيل الدخول
                </Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.forgotButton,
                pressed && styles.pressed,
              ]}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="نسيت كلمة المرور"
            >
              <Text
                style={[
                  styles.forgotText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                نسيت كلمة المرور؟
              </Text>
            </Pressable>

            <View style={styles.signupRow}>
              <Text
                style={[
                  styles.signupText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                ليس لديك حساب؟
              </Text>

              <Link href="/signup" asChild>
                <Pressable
                  hitSlop={8}
                  disabled={isLoading}
                  accessibilityRole="link"
                  accessibilityLabel="إنشاء حساب"
                >
                  <Text
                    style={[
                      styles.signupLink,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    إنشاء حساب
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
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.eight,
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
  },

  field: {
    marginTop: Spacing.five,
  },

  label: {
    marginBottom: Spacing.two,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
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
    textAlign: "right",
  },

  loginButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.five,
    borderRadius: Radius.md,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  forgotButton: {
    alignSelf: "flex-start",
    marginTop: Spacing.three,
    paddingVertical: Spacing.one,
  },

  forgotText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.five,
  },

  signupText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  signupLink: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.7,
  },
});

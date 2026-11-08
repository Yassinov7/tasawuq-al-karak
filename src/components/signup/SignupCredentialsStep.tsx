import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { SignupErrorNotice } from "@/components/signup/SignupErrorNotice";
import { Fonts, FontSizes, Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { SignupField } from "@/hooks/useSignup";
import type {
  ProfileAgeRange,
  ProfileGender,
} from "@/types/profile-demographics";

const ageRangeOptions: { value: ProfileAgeRange; label: string }[] = [
  { value: "under_18", label: "أقل من 18" },
  { value: "18_24", label: "18–24" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_54", label: "45–54" },
  { value: "55_plus", label: "55 فأكثر" },
];

const genderOptions: { value: ProfileGender; label: string }[] = [
  { value: "male", label: "ذكر" },
  { value: "female", label: "أنثى" },
  { value: "prefer_not_to_say", label: "أفضل عدم الإجابة" },
];

type SignupCredentialsStepProps = {
  ageRange: ProfileAgeRange | null;
  email: string;
  error: string;
  fieldErrors: Partial<Record<SignupField, string>>;
  fullName: string;
  gender: ProfileGender | null;
  passwordValue: string;
  passwordConfirmation: string;
  onChangeAgeRange: (value: ProfileAgeRange | null) => void;
  onChangeEmail: (value: string) => void;
  onChangeFullName: (value: string) => void;
  onChangeGender: (value: ProfileGender | null) => void;
  onChangePassword: (value: string) => void;
  onChangePasswordConfirmation: (value: string) => void;
  onContinue: () => void;
  onExit: () => void;
};

export function SignupCredentialsStep({
  ageRange,
  email,
  error,
  fieldErrors,
  fullName,
  gender,
  passwordValue,
  passwordConfirmation,
  onChangeAgeRange,
  onChangeEmail,
  onChangeFullName,
  onChangeGender,
  onChangePassword,
  onChangePasswordConfirmation,
  onContinue,
  onExit,
}: SignupCredentialsStepProps) {
  const { colors } = useTheme();
  const [optionalInfoExpanded, setOptionalInfoExpanded] = useState(false);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>
        معلومات الحساب
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        أدخل بياناتك الأساسية لإنشاء حسابك.
      </Text>

      <View style={styles.fields}>
        <AppTextField design="refined"
          label="الاسم الكامل"
          value={fullName}
          onChangeText={onChangeFullName}
          autoCapitalize="words"
          autoComplete="name"
          placeholder="الاسم كما تحب أن يظهر"
          returnKeyType="next"
          error={fieldErrors.fullName}
        />
        <AppTextField design="refined"
          label="البريد الإلكتروني"
          value={email}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          placeholder="name@example.com"
          returnKeyType="next"
          error={fieldErrors.email}
        />
        <AppTextField design="refined"
          label="كلمة المرور"
          value={passwordValue}
          onChangeText={onChangePassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="٨ أحرف على الأقل"
          returnKeyType="next"
          helperText="٨ أحرف على الأقل"
          passwordToggleMode="icon"
          error={fieldErrors.password}
        />
        <AppTextField design="refined"
          label="تأكيد كلمة المرور"
          value={passwordConfirmation}
          onChangeText={onChangePasswordConfirmation}
          secureTextEntry
          autoComplete="new-password"
          placeholder="أعد كتابة كلمة المرور"
          returnKeyType="done"
          onSubmitEditing={onContinue}
          passwordToggleMode="icon"
          error={fieldErrors.passwordConfirmation}
        />
      </View>

      <View
        style={[
          styles.optionalSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="معلومات اختيارية عن الفئة العمرية والجنس"
          accessibilityState={{ expanded: optionalInfoExpanded }}
          onPress={() => setOptionalInfoExpanded((expanded) => !expanded)}
          style={styles.optionalHeader}
        >
          <View
            style={[
              styles.optionalIcon,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <AppIcon
              name="options-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.optionalHeading}>
            <Text style={[styles.optionalTitle, { color: colors.text }]}>
              معلومات اختيارية
            </Text>
            <Text
              style={[
                styles.optionalDescription,
                { color: colors.textSecondary },
              ]}
            >
              اختيارية لتحسين ملاءمة التجربة والعروض وفق سياسة الخصوصية.
            </Text>
          </View>
          <AppIcon
            name={
              optionalInfoExpanded
                ? "chevron-up-outline"
                : "chevron-down-outline"
            }
            size={21}
            color={colors.textSecondary}
          />
        </Pressable>

        {optionalInfoExpanded ? (
          <View style={styles.optionalFields}>
            <Text style={[styles.optionalLabel, { color: colors.text }]}>
              الفئة العمرية (اختياري)
            </Text>
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              اختيارك تقديري ولا يثبت العمر أو الأهلية.
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="اختر فئتك العمرية، أو اتركها دون تحديد"
              style={styles.choices}
            >
              {ageRangeOptions.map((option) => (
                <Choice
                  key={option.value}
                  label={option.label}
                  selected={ageRange === option.value}
                  onPress={() =>
                    onChangeAgeRange(
                      ageRange === option.value ? null : option.value,
                    )
                  }
                />
              ))}
            </View>

            <Text
              style={[
                styles.optionalLabel,
                styles.genderLabel,
                { color: colors.text },
              ]}
            >
              الجنس (اختياري)
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="اختر الجنس، أو اتركه دون تحديد"
              style={styles.choices}
            >
              {genderOptions.map((option) => (
                <Choice
                  key={option.value}
                  label={option.label}
                  selected={gender === option.value}
                  onPress={() =>
                    onChangeGender(
                      gender === option.value ? null : option.value,
                    )
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <SignupErrorNotice message={hasFieldErrors ? "" : error} />
      <View style={styles.action}>
        <AppButton design="refined"
          title="التالي: نوع الحساب"
          icon="arrow-back"
          onPress={onContinue}
        />
      </View>

      <View style={styles.loginRow}>
        <Text style={[styles.loginText, { color: colors.textSecondary }]}>
          لديك حساب بالفعل؟
        </Text>

          <Pressable onPress={onExit} accessibilityRole="button" style={styles.loginButton}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>
              تسجيل الدخول
            </Text>
          </Pressable>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  title: {
    textAlign: "right",
    ...Typography.pageTitle,
  },
  subtitle: {
    marginTop: Spacing.one,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
  },
  fields: {
    marginTop: Spacing.two,
  },
  optionalSection: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  optionalHeader: {
    minHeight: 72,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionalIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  optionalHeading: {
    flex: 1,
    alignItems: "flex-end",
  },
  optionalTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  optionalDescription: {
    marginTop: 2,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
  },
  optionalFields: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  optionalLabel: {
    marginTop: Spacing.two,
    textAlign: "right",
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  genderLabel: {
    marginTop: Spacing.four,
  },
  note: {
    marginTop: 2,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
  },
  choices: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  choice: {
    minWidth: "30%",
    minHeight: 46,
    flexGrow: 1,
    flexBasis: "30%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  choiceText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },
  action: {
    marginTop: Spacing.four,
  },
  loginRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  loginText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
  loginButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  loginLink: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },
});

type ChoiceProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Choice({ label, selected, onPress }: ChoiceProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {selected ? (
        <AppIcon name="checkmark-circle" size={17} color={colors.primary} />
      ) : null}
      <Text
        style={[
          styles.choiceText,
          { color: selected ? colors.primary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

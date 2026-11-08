import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { SignupErrorNotice } from "@/components/signup/SignupErrorNotice";
import { Fonts, FontSizes, Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { SignupRole } from "@/hooks/useSignup";

const roles: {
  value: SignupRole;
  title: string;
  detail: string;
  icon: "cart-outline" | "storefront-outline" | "bicycle-outline";
}[] = [
  {
    value: "customer",
    title: "عميل",
    detail: "تسوّق من المتاجر المحلية واكتشف العروض",
    icon: "cart-outline",
  },
  {
    value: "merchant",
    title: "تاجر أو صاحب متجر",
    detail: "قدّم متجرك واختر خطة الاشتراك",
    icon: "storefront-outline",
  },
  {
    value: "driver",
    title: "سائق",
    detail: "قدّم طلب انتساب للعمل مع المنصة",
    icon: "bicycle-outline",
  },
];

type SignupRoleStepProps = {
  acceptedTerms: boolean;
  accountCreated: boolean;
  busy: boolean;
  error: string;
  role: SignupRole | null;
  onClearError: () => void;
  onContinue: () => void;
  onRetryRouting: () => void;
  onSetRole: (role: SignupRole) => void;
  onToggleTerms: () => void;
};

export function SignupRoleStep({
  acceptedTerms,
  accountCreated,
  busy,
  error,
  role,
  onClearError,
  onContinue,
  onRetryRouting,
  onSetRole,
  onToggleTerms,
}: SignupRoleStepProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>
        نوع الحساب
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        اختر الطريقة التي تناسبك للانضمام إلى تسوق.
      </Text>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="اختر نوع الحساب"
        style={styles.roles}
      >
        {roles.map((item) => {
          const selected = role === item.value;

          return (
            <Pressable
              key={item.value}
              disabled={accountCreated || busy}
              accessibilityRole="radio"
              accessibilityLabel={`${item.title}. ${item.detail}`}
              accessibilityState={{ selected }}
              onPress={() => {
                onSetRole(item.value);
                onClearError();
              }}
              style={[
                styles.roleCard,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? colors.primaryLight
                    : colors.surface,
                },
              ]}
            >
              <AppIcon
                name={item.icon}
                size={23}
                color={selected ? colors.primary : colors.textSecondary}
              />
              <View style={styles.roleCopy}>
                <Text
                  style={[
                    styles.roleTitle,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.roleDetail,
                    { color: colors.textSecondary },
                  ]}
                >
                  {item.detail}
                </Text>
              </View>
              <AppIcon
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={23}
                color={selected ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        disabled={accountCreated}
        accessibilityLabel="الموافقة على شروط الاستخدام وسياسة الخصوصية"
        accessibilityState={{ checked: acceptedTerms }}
        onPress={onToggleTerms}
        style={styles.agreementRow}
      >
        <View style={styles.agreementCopy}>
          <Text style={[styles.agreementText, { color: colors.textSecondary }]}>
            أوافق على
          </Text>
          <Link href="/terms" asChild>
            <Pressable onPress={(event) => event.stopPropagation()} hitSlop={6}>
              <Text style={[styles.agreementLink, { color: colors.primary }]}>
                شروط الاستخدام
              </Text>
            </Pressable>
          </Link>
          <Text style={[styles.agreementText, { color: colors.textSecondary }]}>
            و
          </Text>
          <Link href="/privacy" asChild>
            <Pressable onPress={(event) => event.stopPropagation()} hitSlop={6}>
              <Text style={[styles.agreementLink, { color: colors.primary }]}>
                سياسة الخصوصية
              </Text>
            </Pressable>
          </Link>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: acceptedTerms ? colors.primary : colors.border,
              backgroundColor: acceptedTerms
                ? colors.primary
                : colors.surface,
            },
          ]}
        >
          {acceptedTerms ? (
            <AppIcon name="checkmark" size={16} color={colors.surface} />
          ) : null}
        </View>
      </Pressable>

      <SignupErrorNotice message={error} />

      <View style={styles.actions}>
        <AppButton design="refined"
          title={busy ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب"}
          icon={busy ? undefined : "person-add-outline"}
          onPress={onContinue}
          loading={busy}
          disabled={!role || !acceptedTerms || busy || accountCreated}
        />
        {accountCreated ? (
          <AppButton design="refined"
            title="إعادة محاولة فتح الحساب"
            variant="outline"
            onPress={onRetryRouting}
            loading={busy}
            disabled={busy}
          />
        ) : null}
      </View>

      <View style={styles.infoLinks}>
        <Link href="/terms" asChild>
          <Pressable hitSlop={6}>
            <Text style={[styles.infoLink, { color: colors.primary }]}>
              شروط الاستخدام
            </Text>
          </Pressable>
        </Link>
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <Link href="/privacy" asChild>
          <Pressable hitSlop={6}>
            <Text style={[styles.infoLink, { color: colors.primary }]}>
              سياسة الخصوصية
            </Text>
          </Pressable>
        </Link>
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <Link href="/about" asChild>
          <Pressable hitSlop={6}>
            <Text style={[styles.infoLink, { color: colors.primary }]}>
              معلومات البرنامج وإصداره
            </Text>
          </Pressable>
        </Link>
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
    paddingBottom: Spacing.four,
  },
  title: {
    textAlign: "right",
    ...Typography.pageTitle,
  },
  subtitle: {
    marginTop: Spacing.two,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
  },
  roles: {
    gap: Spacing.three,
    marginTop: Spacing.five,
  },
  roleCard: {
    minHeight: 82,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  roleCopy: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  roleTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },
  roleDetail: {
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },
  agreementRow: {
    minHeight: 54,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: Spacing.three,
    marginTop: Spacing.five,
  },
  agreementCopy: {
    flex: 1,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "flex-end",
    gap: Spacing.one,
  },
  agreementText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
  },
  agreementLink: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
    lineHeight: 21,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    marginTop: Spacing.three,
  },
  infoLinks: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  infoLink: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 20,
  },
  separator: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
  },
});

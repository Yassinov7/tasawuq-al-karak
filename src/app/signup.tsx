import { Link, useRouter, type Href } from "expo-router";

import { useCallback, useRef, useState } from "react";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAccountRoute } from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

type SignupRole = "customer" | "merchant" | "driver";

const roles: {
  value: SignupRole;
  title: string;
  detail: string;
  icon: "cart-outline" | "storefront-outline" | "bicycle-outline";
}[] = [
  {
    value: "customer",
    title: "زبون",
    detail: "اكتشف المتاجر واطلب احتياجاتك",
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

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);

  const pageHeight = Math.max(600, height - 16);

  const pageRef = useRef(0);
  const pageOffsetsRef = useRef([0, pageHeight, pageHeight * 2]);

  const [page, setPage] = useState(0);
  const [pageOffsets, setPageOffsets] = useState([
    0,
    pageHeight,
    pageHeight * 2,
  ]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [role, setRole] = useState<SignupRole | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const goToPage = useCallback(
    (nextPage: number) => {
      pageRef.current = nextPage;
      setPage(nextPage);

      scrollRef.current?.scrollTo({
        y: pageOffsetsRef.current[nextPage] ?? nextPage * pageHeight,
        animated: true,
      });
    },
    [pageHeight],
  );

  const recordPageLayout = (index: number, offset: number) => {
    const nextOffsets = [...pageOffsetsRef.current];

    if (Math.abs(nextOffsets[index] - offset) < 1) {
      return;
    }

    nextOffsets[index] = offset;
    pageOffsetsRef.current = nextOffsets;
    setPageOffsets(nextOffsets);
  };

  const continueToRole = () => {
    setError("");

    if (fullName.trim().length < 2) {
      return setError("أدخل اسمك الكامل.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("أدخل بريدًا إلكترونيًا صحيحًا.");
    }

    if (password.length < 8) {
      return setError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
    }

    if (password !== passwordConfirmation) {
      return setError("كلمتا المرور غير متطابقتين.");
    }

    goToPage(2);
  };

  const createAccount = async () => {
    setError("");

    if (!role) {
      return setError("اختر دورًا واحدًا للمتابعة.");
    }

    if (!acceptedTerms) {
      return setError(
        "يجب الموافقة على شروط الاستخدام وسياسة الخصوصية قبل إنشاء الحساب.",
      );
    }

    setBusy(true);

    let data;
    let signupError;

    try {
      const response = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            signup_role: role,
          },
        },
      });

      data = response.data;
      signupError = response.error;
    } catch {
      setBusy(false);
      setError("تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول مجددًا.");
      return;
    }

    if (signupError) {
      setBusy(false);

      setError(
        signupError.message.includes("already registered")
          ? "هذا البريد مسجل مسبقًا. سجّل الدخول بدل إنشاء حساب جديد."
          : "تعذر إنشاء الحساب. تحقق من الاتصال وإعداد البريد ثم أعد المحاولة.",
      );

      return;
    }

    if (!data.session || !data.user) {
      setBusy(false);

      router.replace({
        pathname: "/verify-email",
        params: {
          email: email.trim().toLowerCase(),
          role,
        },
      } as unknown as Href);

      return;
    }

    try {
      const destination = await getAccountRoute(data.user.id);
      router.replace(destination as Href);
    } catch {
      setError(
        "تم إنشاء الحساب، لكن تعذر تحميل دوره الآن. سجّل الدخول بعد قليل.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        snapToOffsets={pageOffsets}
        snapToStart
        snapToEnd
        disableIntervalMomentum
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;

          const next = pageOffsetsRef.current.reduce(
            (closest, currentOffset, index, offsets) =>
              Math.abs(currentOffset - offsetY) <
              Math.abs(offsets[closest] - offsetY)
                ? index
                : closest,
            0,
          );

          pageRef.current = next;
          setPage(next);

          if (next !== 2) {
            setError("");
          }
        }}
      >
        {/* الصفحة الأولى */}
        <View
          onLayout={(event) => recordPageLayout(0, event.nativeEvent.layout.y)}
          style={[styles.page, { minHeight: pageHeight }]}
        >
          <View style={styles.welcomeContent}>
            <BrandMark size="medium" />

            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              أهلاً بك في
            </Text>

            <Text style={[styles.title, { color: colors.text }]}>تسوق</Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              متاجر الكرك الشرقي، أقرب إليك. أنشئ حسابك وتابع طلباتك أو قدّم
              متجرك أو طلب انتسابك للسائقين.
            </Text>

            <Text style={[styles.hint, { color: colors.textMuted }]}>
              تعرّف على خطوات الانضمام، أو ابدأ الآن
            </Text>

            <AppButton
              title="ابدأ الآن"
              onPress={() => goToPage(1)}
              variant="secondary"
            />
          </View>
        </View>

        {/* الصفحة الثانية */}
        <View
          onLayout={(event) => recordPageLayout(1, event.nativeEvent.layout.y)}
          style={[styles.page, { minHeight: pageHeight }]}
        >
          <View style={styles.formPage}>
            <Text
              style={[
                styles.title,
                styles.sectionTitle,
                { color: colors.text },
              ]}
            >
              بيانات حسابك
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              أدخل بياناتك الأساسية للمتابعة.
            </Text>

            <View style={styles.fields}>
              <AppTextField
                label="الاسم الكامل"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                placeholder="الاسم كما تحب أن يظهر"
                returnKeyType="next"
              />

              <AppTextField
                label="البريد الإلكتروني"
                value={email}
                onChangeText={setEmail}
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
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="٨ أحرف على الأقل"
                returnKeyType="next"
              />

              <AppTextField
                label="تأكيد كلمة المرور"
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                secureTextEntry
                autoComplete="new-password"
                placeholder="أعد كتابة كلمة المرور"
                returnKeyType="done"
                onSubmitEditing={continueToRole}
              />
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

            <AppButton title="التالي: اختيار الدور" onPress={continueToRole} />

            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.textSecondary }]}>
                لديك حساب؟
              </Text>

              <Link href="/login" asChild>
                <Pressable accessibilityRole="button" hitSlop={8}>
                  <Text style={[styles.loginLink, { color: colors.primary }]}>
                    تسجيل الدخول
                  </Text>
                </Pressable>
              </Link>
            </View>

            <Text style={[styles.swipeHint, { color: colors.textMuted }]}>
              أكمل البيانات ثم تابع، أو اسحب للأعلى
            </Text>
          </View>
        </View>

        {/* الصفحة الثالثة */}
        <View
          onLayout={(event) => recordPageLayout(2, event.nativeEvent.layout.y)}
          style={[styles.page, { minHeight: pageHeight }]}
        >
          <View style={styles.formPage}>
            <Text style={[styles.title, { color: colors.text }]}>
              كيف ستستخدم تسوق؟
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              اختر دورًا واحدًا لهذا الحساب. لا يمكن للحساب امتلاك أكثر من دور.
            </Text>

            <View style={styles.roles}>
              {roles.map((item) => {
                const selected = role === item.value;

                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setRole(item.value);
                      setError("");
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
                          {
                            color: selected ? colors.primary : colors.text,
                          },
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
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={21}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* الموافقة */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: acceptedTerms,
              }}
              onPress={() => {
                setAcceptedTerms((current) => !current);

                if (error) {
                  setError("");
                }
              }}
              style={styles.agreementRow}
            >
              <View style={styles.agreementCopy}>
                <Text
                  style={[
                    styles.agreementText,
                    { color: colors.textSecondary },
                  ]}
                >
                  أوافق على
                </Text>

                <Link href="/terms" asChild>
                  <Pressable
                    onPress={(event) => event.stopPropagation()}
                    hitSlop={6}
                  >
                    <Text
                      style={[styles.agreementLink, { color: colors.primary }]}
                    >
                      شروط الاستخدام
                    </Text>
                  </Pressable>
                </Link>

                <Text
                  style={[
                    styles.agreementText,
                    { color: colors.textSecondary },
                  ]}
                >
                  و
                </Text>

                <Link href="/privacy" asChild>
                  <Pressable
                    onPress={(event) => event.stopPropagation()}
                    hitSlop={6}
                  >
                    <Text
                      style={[styles.agreementLink, { color: colors.primary }]}
                    >
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
                  <AppIcon
                    name="checkmark"
                    size={16}
                    color={colors.primary}
                  />
                ) : null}
              </View>
            </Pressable>

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

            <View style={styles.actions}>
              <AppButton
                title="رجوع للبيانات"
                variant="outline"
                onPress={() => goToPage(1)}
                disabled={busy}
              />

              <AppButton
                title={busy ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب والمتابعة"}
                onPress={() => void createAccount()}
                loading={busy}
                disabled={!role || !acceptedTerms}
              />
            </View>

            {/* الروابط الإضافية */}
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

            <Text style={[styles.swipeHint, { color: colors.textMuted }]}>
              يمكنك قراءة الشروط وسياسة الخصوصية قبل إنشاء الحساب.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* شريط التقدم الثابت */}
      {page > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.fixedProgress, { backgroundColor: colors.background }]}
        >
          <View style={styles.progressInner}>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>
              {page === 1 ? "الخطوة ١ من ٢" : "الخطوة ٢ من ٢"}
            </Text>

            <View
              style={[styles.stepTrack, { backgroundColor: colors.border }]}
            >
              <View
                style={[
                  styles.stepFill,
                  {
                    backgroundColor:
                      page === 1 ? colors.primary : colors.accent,
                    width: page === 1 ? "50%" : "100%",
                  },
                ]}
              />
            </View>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: Spacing.nine,
  },

  page: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: 150,
  },

  welcomeContent: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    alignItems: "center",
    padding: Spacing.five,
  },

  eyebrow: {
    marginTop: Spacing.five,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  title: {
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  sectionTitle: {
    marginTop: Spacing.six,
  },

  subtitle: {
    marginTop: Spacing.two,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
  },

  hint: {
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
  },

  formPage: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },

  fields: {
    gap: Spacing.three,
    marginTop: Spacing.five,
  },

  roles: {
    gap: Spacing.three,
    marginTop: Spacing.five,
  },

  stepText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  stepTrack: {
    flex: 1,
    height: 5,
    overflow: "hidden",
    borderRadius: Radius.full,
  },

  stepFill: {
    height: "100%",
    borderRadius: Radius.full,
  },

  error: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    textAlign: "right",
    fontFamily: Fonts.medium,
    lineHeight: 22,
  },

  loginRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "baseline",
    gap: Spacing.one,
    marginTop: Spacing.four,
  },

  loginText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  loginLink: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  swipeHint: {
    marginTop: Spacing.four,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
  },

  roleCard: {
    minHeight: 78,
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
    flexDirection: "column",
    gap: Spacing.two,
    marginTop: Spacing.five,
  },

  infoLinks: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    marginTop: Spacing.five,
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

  fixedProgress: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },

  progressInner: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },
});

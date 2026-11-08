import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { OnboardingFrame } from "@/components/auth/OnboardingFrame";
import { useOnboardingDraft } from "@/hooks/useOnboardingDraft";
import { useOnboardingExit } from "@/hooks/useOnboardingExit";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing, Typography, LayoutSpacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type LoadState = "loading" | "ready" | "error";

const emptyDriverDraft = { name: "", phone: "", vehicle: "", duration: "12", hours: "08:00 - 17:00" };
export default function DriverApplicationScreen() {
  const { user } = useAuth();
  return <DriverApplicationForm key={user?.id ?? "guest"} />;
}
function DriverApplicationForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const prefilled = useRef(false);
  const form = useOnboardingDraft('driver-application-draft:' + (user?.id ?? 'guest'), emptyDriverDraft);
  const { ready: draftReady, change: changeDraft } = form;
  const { name, phone, vehicle, duration, hours } = form.value;
  const setName = (value: string) => changeDraft('name', value);
  const setPhone = (value: string) => changeDraft('phone', value);
  const setVehicle = (value: string) => changeDraft('vehicle', value);
  const setDuration = (value: string) => changeDraft('duration', value);
  const setHours = (value: string) => changeDraft('hours', value);
  const submitLock = useRef(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof emptyDriverDraft, string>>>({});
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const exit = useOnboardingExit({ dirty: form.dirty, busy, save: form.save, discard: form.discard });
  const checkApplication = useCallback(
    async (isRefresh = false) => {
      if (!draftReady) return;
      if (!user) {
        router.replace("/login");
        setLoadState("ready");
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadState("loading");
      }

      setError("");

      try {
        const { data, error: applicationError } = await supabase
          .from("driver_applications")
          .select("id,status,full_name,contact_phone,vehicle_type,contract_duration_months,available_hours")
          .eq("user_id", user.id)
          .maybeSingle();

        if (applicationError) {
          throw applicationError;
        }

        if (data && !(edit === "1" && ["changes_requested", "rejected"].includes(data.status))) {
          router.replace("/application-status" as Href);
          return;
        }

        if (data && !prefilled.current) {
          prefilled.current = true;
          changeDraft("name", (old) => old || data.full_name);
          changeDraft("phone", (old) => old || data.contact_phone);
          changeDraft("vehicle", (old) => old || data.vehicle_type);
          changeDraft("duration", String(data.contract_duration_months));
          const hours = data.available_hours;
          if (hours && typeof hours === "object" && !Array.isArray(hours) && typeof hours.schedule === "string") changeDraft("hours", hours.schedule);
        }
        setLoadState("ready");
      } catch {
        setLoadState("error");
        setError(
          "تعذر التحقق من حالة طلب السائق. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [router, user, draftReady, edit, changeDraft],
  );

  useEffect(() => {
    const timer = setTimeout(() => void checkApplication(), 0);
    return () => clearTimeout(timer);
  }, [checkApplication]);

  const validateForm = () => {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'أدخل الاسم الكامل.';
    if (!/^[+\d٠-٩۰-۹\s()-]{5,32}$/.test(phone.trim()) || phone.replace(/[^\d٠-٩۰-۹]/g, '').length < 5) next.phone = 'أدخل رقم هاتف صحيحًا.';
    if (!vehicle.trim()) next.vehicle = 'أدخل نوع المركبة.';
    if (!Number.isInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > 60) next.duration = 'مدة التعاقد بين شهر و60 شهرًا.';
    if (!hours.trim()) next.hours = 'أدخل أوقات العمل المتاحة.';
    setErrors(next); setFieldError(Object.keys(next).length ? 'راجع الحقول المشار إليها.' : '');
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitLock.current) return;
    if (!user) {
      setError("سجّل الدخول أولًا.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    const months = Number(duration);

    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
    setFieldError("");

    const existing = await supabase.from("driver_applications").select("status").eq("user_id", user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && !["changes_requested", "rejected"].includes(existing.data.status)) { router.replace("/application-status"); return; }
    const identity = await supabase.auth.getUser();
    if (identity.error || identity.data.user?.id !== user.id) throw new Error("session-changed");
    const { error: submitError } = await supabase.rpc(
      "submit_driver_application",
      {
        input_full_name: name.trim(),
        input_contact_phone: phone.trim(),
        input_vehicle_type: vehicle.trim(),
        input_contract_duration_months: months,
        input_available_hours: {
          schedule: hours.trim(),
        },
      },
    );

    if (submitError) {
      if (submitError.message.includes("awaiting review")) {
        setError("طلبك قيد المراجعة بالفعل.");
        return;
      }

      setError("تعذر إرسال طلب الانتساب. تحقق من البيانات وحاول مرة أخرى.");
      return;
    }

    await form.clear();
    router.replace("/application-status" as Href);
    } catch { setError("تعذر تأكيد إرسال الطلب. احتفظنا بالمسودة؛ تحقق من الحالة قبل إعادة المحاولة."); }
    finally { submitLock.current = false; setBusy(false); }
  };

  if (loadState === "loading") {
    return (<OnboardingFrame title="طلب الانتساب كسائق" onCancel={exit} busy={busy}>{(
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          جاري التحقق من حالة طلبك...
        </Text>
      </View>
    )}</OnboardingFrame>);
  }

  if (loadState === "error") {
    return (<OnboardingFrame title="طلب الانتساب كسائق" onCancel={exit} busy={busy}>{(
      <View
        style={[
          styles.center,
          styles.errorScreen,
          { backgroundColor: colors.background },
        ]}
      >
        <View
          style={[
            styles.errorIcon,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <AppIcon name="warning-outline" size={28} color={colors.error} />
        </View>

        <Text style={[styles.errorTitle, { color: colors.text }]}>
          تعذر تحميل الصفحة
        </Text>

        <Text
          style={[styles.errorDescription, { color: colors.textSecondary }]}
        >
          {error}
        </Text>

        <AppButton design="refined"
          title="إعادة المحاولة"
          onPress={() => void checkApplication()}
        />
      </View>
    )}</OnboardingFrame>);
  }

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(vehicle.trim()) &&
    Boolean(duration.trim()) &&
    Boolean(hours.trim()) &&
    !busy;

  return (
    <OnboardingFrame title="طلب الانتساب كسائق" onCancel={exit} busy={busy}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { padding: LayoutSpacing.pageGutter, gap: LayoutSpacing.cardGap }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void checkApplication(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[styles.heroIcon, { backgroundColor: colors.primaryLight }]}
          >
            <AppIcon name="car-outline" size={28} color={colors.primary} />
          </View>

          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              كن سائقًا مع تسوق
            </Text>

            <Text
              style={[styles.heroDescription, { color: colors.textSecondary }]}
            >
              أدخل معلوماتك الأساسية ومعلومات العمل حتى تتمكن الإدارة من مراجعة
              طلب الانتساب الخاص بك.
            </Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressCircle,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.progressNumber, { color: colors.onPrimary }]}>
                1
              </Text>
            </View>

            <Text style={[styles.progressLabel, { color: colors.text }]}>
              البيانات
            </Text>
          </View>

          <View
            style={[styles.progressLine, { backgroundColor: colors.border }]}
          />

          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressCircle,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.progressNumber, { color: colors.textSecondary }]}
              >
                2
              </Text>
            </View>

            <Text
              style={[styles.progressLabel, { color: colors.textSecondary }]}
            >
              المراجعة
            </Text>
          </View>

          <View
            style={[styles.progressLine, { backgroundColor: colors.border }]}
          />

          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressCircle,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.progressNumber, { color: colors.textSecondary }]}
              >
                3
              </Text>
            </View>

            <Text
              style={[styles.progressLabel, { color: colors.textSecondary }]}
            >
              بدء العمل
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <AppIcon name="person-outline" size={19} color={colors.primary} />
            </View>

            <View style={styles.sectionHeaderContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                البيانات الشخصية
              </Text>

              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                معلومات أساسية للتواصل والتعريف بك
              </Text>
            </View>
          </View>

          <AppTextField design="refined"
            label="الاسم الكامل *"
            error={errors.name} value={name}
            onChangeText={(value) => {
              setName(value);
              setFieldError("");
            }}
            autoCapitalize="words"
            placeholder="أدخل اسمك الكامل"
          />

          <AppTextField design="refined"
            label="رقم الهاتف للتواصل *"
            error={errors.phone} value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setFieldError("");
            }}
            keyboardType="phone-pad"
            placeholder="مثال: 09xxxxxxxx"
          />
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <AppIcon name="car-outline" size={19} color={colors.primary} />
            </View>

            <View style={styles.sectionHeaderContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                معلومات العمل
              </Text>

              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                أخبرنا عن وسيلة النقل والمدة والأوقات المتاحة
              </Text>
            </View>
          </View>

          <AppTextField design="refined"
            label="نوع المركبة *"
            error={errors.vehicle} value={vehicle}
            onChangeText={(value) => {
              setVehicle(value);
              setFieldError("");
            }}
            placeholder="دراجة نارية، سيارة..."
          />

          <AppTextField design="refined"
            label="مدة التعاقد بالأشهر *"
            error={errors.duration} value={duration}
            onChangeText={(value) => {
              setDuration(value.replace(/[^0-9]/g, ""));
              setFieldError("");
            }}
            keyboardType="number-pad"
            placeholder="مثال: 12"
          />

          <View
            style={[
              styles.durationHint,
              {
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
          >
            <AppIcon
              name="calendar-outline"
              size={18}
              color={colors.textSecondary}
            />

            <Text
              style={[styles.durationHintText, { color: colors.textSecondary }]}
            >
              يمكن أن تكون مدة التعاقد من شهر واحد حتى 60 شهرًا.
            </Text>
          </View>

          <AppTextField design="refined"
            label="ساعات وأوقات العمل المتاحة *"
            error={errors.hours} value={hours}
            onChangeText={(value) => {
              setHours(value);
              setFieldError("");
            }}
            placeholder="مثال: يوميًا من ٨ صباحًا حتى ٥ مساءً"
          />
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          <View style={[styles.infoIcon, { backgroundColor: colors.surface }]}>
            <AppIcon
              name="information-circle-outline"
              size={20}
              color={colors.primary}
            />
          </View>

          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              ماذا يحدث بعد إرسال الطلب؟
            </Text>

            <Text
              style={[styles.infoDescription, { color: colors.textSecondary }]}
            >
              ستتم مراجعة بياناتك من الإدارة. يمكنك متابعة حالة الطلب من صفحة
              حالة الطلبات في حسابك.
            </Text>
          </View>
        </View>

        {fieldError ? (
          <View
            style={[
              styles.validationBox,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.error,
              },
            ]}
          >
            <AppIcon name="warning-outline" size={19} color={colors.error} />

            <Text style={[styles.validationText, { color: colors.error }]}>
              {fieldError}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.validationBox,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.error,
              },
            ]}
          >
            <AppIcon name="warning-outline" size={19} color={colors.error} />

            <Text style={[styles.validationText, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.submitArea}>
          <AppButton design="refined"
            title="إرسال طلب الانتساب"
            onPress={() => void submit()}
            loading={busy}
            disabled={!canSubmit}
          />

          <Text style={[styles.submitHint, { color: colors.textSecondary }]}>
            تأكد من صحة بياناتك قبل إرسال الطلب.
          </Text>
        </View>
      </ScrollView>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  scroll: {
    flex: 1,
  },

  container: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
    gap: Spacing.three,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.five,
  },

  errorScreen: {
    gap: Spacing.three,
  },

  loadingText: {
    marginTop: Spacing.three,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  errorTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  errorDescription: {
    maxWidth: 420,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
    textAlign: "center",
  },

  header: {
    minHeight: 72,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  heroContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  heroTitle: {

    ...Typography.sectionTitle,
    textAlign: "right",
  },

  heroDescription: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "right",
  },

  progressRow: {
    minHeight: 60,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.two,
  },

  progressItem: {
    alignItems: "center",
    gap: 5,
  },

  progressCircle: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  progressNumber: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  progressLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    textAlign: "center",
  },

  progressLine: {
    flex: 1,
    height: 1,
    marginHorizontal: Spacing.two,
    marginBottom: 18,
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },

  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeaderContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  sectionTitle: {

    ...Typography.cardTitle,
    textAlign: "right",
  },

  sectionDescription: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  durationHint: {
    marginBottom: Spacing.four,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  durationHintText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  infoCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  infoTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  infoDescription: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "right",
  },

  validationBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  validationText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "right",
  },

  submitArea: {
    paddingTop: Spacing.one,
    gap: Spacing.two,
  },

  submitHint: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "center",
  },
});

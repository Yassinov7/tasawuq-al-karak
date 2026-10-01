import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type LoadState = "loading" | "ready" | "error";

export default function DriverApplicationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [duration, setDuration] = useState("12");
  const [hours, setHours] = useState("08:00 - 17:00");

  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const checkApplication = useCallback(
    async (isRefresh = false) => {
      if (!user) {
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
          .select("id,status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (applicationError) {
          throw applicationError;
        }

        if (data) {
          router.replace("/application-status" as Href);
          return;
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
    [router, user],
  );

  useEffect(() => {
    void checkApplication();
  }, [checkApplication]);

  const validateForm = () => {
    setError("");
    setFieldError("");

    if (!name.trim()) {
      setFieldError("أدخل الاسم الكامل.");
      return false;
    }

    if (!phone.trim()) {
      setFieldError("أدخل رقم الهاتف للتواصل.");
      return false;
    }

    if (!vehicle.trim()) {
      setFieldError("أدخل نوع المركبة.");
      return false;
    }

    if (!duration.trim()) {
      setFieldError("أدخل مدة التعاقد.");
      return false;
    }

    const months = Number(duration);

    if (!Number.isInteger(months) || months < 1 || months > 60) {
      setFieldError("مدة التعاقد يجب أن تكون بين شهر و60 شهرًا.");
      return false;
    }

    if (!hours.trim()) {
      setFieldError("أدخل أوقات العمل المتاحة.");
      return false;
    }

    return true;
  };

  const submit = async () => {
    if (!user) {
      setError("سجّل الدخول أولًا.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    const months = Number(duration);

    setBusy(true);
    setError("");
    setFieldError("");

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

    setBusy(false);

    if (submitError) {
      if (submitError.message.includes("awaiting review")) {
        setError("طلبك قيد المراجعة بالفعل.");
        return;
      }

      setError("تعذر إرسال طلب الانتساب. تحقق من البيانات وحاول مرة أخرى.");
      return;
    }

    router.replace("/application-status" as Href);
  };

  if (loadState === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          جاري التحقق من حالة طلبك...
        </Text>
      </View>
    );
  }

  if (loadState === "error") {
    return (
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

        <AppButton
          title="إعادة المحاولة"
          onPress={() => void checkApplication()}
        />
      </View>
    );
  }

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(vehicle.trim()) &&
    Boolean(duration.trim()) &&
    Boolean(hours.trim()) &&
    !busy;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.headerButton}
        >
          <AppIcon name="arrow-forward" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            طلب الانتساب كسائق
          </Text>

          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            انضم إلى شبكة سائقي تسوق
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
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
              <Text style={[styles.progressNumber, { color: colors.primary }]}>
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

          <AppTextField
            label="الاسم الكامل *"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setFieldError("");
            }}
            autoCapitalize="words"
            placeholder="أدخل اسمك الكامل"
          />

          <AppTextField
            label="رقم الهاتف للتواصل *"
            value={phone}
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

          <AppTextField
            label="نوع المركبة *"
            value={vehicle}
            onChangeText={(value) => {
              setVehicle(value);
              setFieldError("");
            }}
            placeholder="دراجة نارية، سيارة..."
          />

          <AppTextField
            label="مدة التعاقد بالأشهر *"
            value={duration}
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

          <AppTextField
            label="ساعات وأوقات العمل المتاحة *"
            value={hours}
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
          <AppButton
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
    </View>
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
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
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
    fontSize: 10,
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
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
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

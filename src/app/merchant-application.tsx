import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { peekLocalCache, writeLocalCache, invalidateLocalCache } from "@/lib/local-cache";

type ApplicationDraft = { planId: string; categoryId: string; phone: string; store: string; description: string; address: string };
type Plan = {
  id: string;
  name: string;
  description: string;
  duration_months: number;
  price: number;
  currency: "SYP" | "USD";
  commission_rate: number | null;
  product_limit: number | null;
  features: string[] | null;
};

type StoreCategory = {
  id: string;
  name: string;
};

type LoadState = "loading" | "ready" | "error";

const money = (price: number, currency: "SYP" | "USD") =>
  `${Number(price).toLocaleString("ar-SY")} ${
    currency === "USD" ? "دولار" : "ل.س"
  }`;

const getDurationLabel = (months: number) => {
  if (months === 1) return "شهر واحد";
  if (months === 2) return "شهران";
  if (months === 3) return "3 أشهر";
  if (months === 6) return "6 أشهر";
  if (months === 12) return "سنة كاملة";
  return `${months} أشهر`;
};

const isPlanReady = (plan: Plan) =>
  plan.commission_rate !== null &&
  plan.product_limit !== null &&
  Array.isArray(plan.features) &&
  plan.features.length > 0;

export default function MerchantApplicationScreen() {
  const { user } = useAuth();
  return <MerchantApplicationForm key={user?.id ?? "guest"} />;
}

function MerchantApplicationForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const userId = user?.id;
  const draftKey = userId ? `merchant-application-draft:${userId}` : "";
  const draft = draftKey ? peekLocalCache<ApplicationDraft>(draftKey) : undefined;
  const submitLock = useRef(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [planId, setPlanId] = useState(draft?.planId ?? "");
  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? "");

  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [store, setStore] = useState(draft?.store ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [address, setAddress] = useState(draft?.address ?? "");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
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
        const [planResult, categoryResult, appResult] = await Promise.all([
          supabase
            .from("subscription_plans")
            .select("id,name,description,duration_months,price,currency,commission_rate,product_limit,features")
            .eq("is_active", true)
            .order("duration_months"),

          supabase
            .from("store_categories")
            .select("id,name")
            .eq("is_active", true)
            .order("sort_order"),

          supabase
            .from("merchant_applications")
            .select("id,status")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        if (planResult.error) {
          throw planResult.error;
        }

        if (categoryResult.error) {
          throw categoryResult.error;
        }

        if (appResult.error) {
          throw appResult.error;
        }

        if (appResult.data) {
          router.replace("/application-status" as Href);
          return;
        }

        const loadedPlans = (planResult.data ?? []) as Plan[];
        const loadedCategories = (categoryResult.data ?? []) as StoreCategory[];

        setPlans(loadedPlans);
        setCategories(loadedCategories);

        setCategoryId((previous) => loadedCategories.some((item) => item.id === previous) ? previous : loadedCategories[0]?.id ?? "");
        setPlanId((previous) => loadedPlans.some((item) => item.id === previous && isPlanReady(item)) ? previous : "");
        setLoadState("ready");
      } catch {
        setLoadState("error");
        setError(
          "تعذر تحميل بيانات إنشاء المتجر. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [router, userId],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (draftKey) void writeLocalCache(draftKey, { planId, categoryId, phone, store, description, address });
  }, [draftKey, planId, categoryId, phone, store, description, address]);

  const validateForm = () => {
    setError("");
    setFieldError("");

    if (!/^[+\d٠-٩۰-۹\s()-]{5,32}$/.test(phone.trim()) || phone.replace(/[^\d٠-٩۰-۹]/g, "").length < 5) {
      setFieldError("أدخل رقم هاتف صحيحًا من 5 إلى 32 محرفًا.");
      return false;
    }

    if (store.trim().length < 2 || store.trim().length > 120) {
      setFieldError("أدخل اسم متجر من حرفين إلى 120 حرفًا.");
      return false;
    }

    if (!categoryId) {
      setFieldError("اختر تصنيف المتجر.");
      return false;
    }

    if (address.trim().length < 3 || address.trim().length > 300) {
      setFieldError("أدخل عنوانًا من 3 إلى 300 حرف.");
      return false;
    }

    if (!plans.some((plan) => plan.id === planId && isPlanReady(plan))) {
      setFieldError("اختر خطة الاشتراك.");
      return false;
    }

    return true;
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

    submitLock.current = true;
    setBusy(true);
    setError("");
    setFieldError("");

    try {
      const { error: submitError } = await supabase.rpc(
        "submit_merchant_application",
        {
          selected_plan: planId,
          input_contact_phone: phone.trim(),
          input_store_name: store.trim(),
          input_store_description: description.trim(),
          input_store_address: address.trim(),
          selected_store_category: categoryId,
        },
      );

      if (submitError) {
        setError("تعذر إرسال طلب المتجر. تحقق من البيانات وحاول مرة أخرى.");
        return;
      }

      await invalidateLocalCache(draftKey);
      router.replace("/application-status" as Href);
    } catch { setError("تعذر إرسال الطلب. احتفظنا ببياناتك؛ تحقق من الاتصال وحاول مجددًا."); }
    finally { submitLock.current = false; setBusy(false); }
  };

  if (loadState === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          جاري تجهيز نموذج إنشاء المتجر...
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
          <AppIcon name="warning" size={28} color={colors.error} />
        </View>

        <Text style={[styles.errorTitle, { color: colors.text }]}>
          تعذر تحميل الصفحة
        </Text>

        <Text
          style={[styles.errorDescription, { color: colors.textSecondary }]}
        >
          {error}
        </Text>

        <AppButton title="إعادة المحاولة" onPress={() => void loadData()} />
      </View>
    );
  }

  const canSubmit =
    Boolean(phone.trim()) &&
    Boolean(store.trim()) &&
    Boolean(categoryId) &&
    Boolean(address.trim()) &&
    Boolean(plans.some((plan) => plan.id === planId && isPlanReady(plan))) &&
    Boolean(categories.length) &&
    !busy;
  const selectedPlan = plans.find((plan) => plan.id === planId && isPlanReady(plan));

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
            إنشاء متجر
          </Text>

          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            الخطوة الأولى لبدء نشاطك
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
            onRefresh={() => void loadData(true)}
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
            <AppIcon name="storefront" size={28} color={colors.primary} />
          </View>

          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              أنشئ متجرك على تسوق
            </Text>

            <Text
              style={[styles.heroDescription, { color: colors.textSecondary }]}
            >
              أدخل معلومات متجرك واختر خطة الاشتراك. بعد إرسال الطلب ستتم
              مراجعته من الإدارة.
            </Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressCircle,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.progressNumber, { color: colors.primary }]}>
                1
              </Text>
            </View>

            <Text style={[styles.progressLabel, { color: colors.text }]}>
              بيانات المتجر
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
              <AppIcon name="call-outline" size={19} color={colors.primary} />
            </View>

            <View style={styles.sectionHeaderContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                بيانات التواصل
              </Text>

              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                رقم يمكن للإدارة التواصل معك من خلاله
              </Text>
            </View>
          </View>

          <AppTextField
            label="رقم الهاتف *"
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
              <AppIcon name="storefront" size={19} color={colors.primary} />
            </View>

            <View style={styles.sectionHeaderContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                معلومات المتجر
              </Text>

              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                هذه المعلومات ستظهر للعملاء بعد اعتماد متجرك
              </Text>
            </View>
          </View>

          <AppTextField
            label="اسم المتجر *"
            value={store}
            onChangeText={(value) => {
              setStore(value);
              setFieldError("");
            }}
            placeholder="مثال: أسواق الكرك"
          />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            تصنيف المتجر *
          </Text>

          {categories.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon
                name="information-circle-outline"
                size={20}
                color={colors.textSecondary}
              />

              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                لا توجد تصنيفات متاحة حالياً. ستظهر التصنيفات بعد تفعيلها من
                لوحة الإدارة.
              </Text>
            </View>
          ) : (
            <View style={styles.categoryList}>
              {categories.map((category) => {
                const selected = categoryId === category.id;

                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                    }}
                    onPress={() => {
                      setCategoryId(category.id);
                      setFieldError("");
                    }}
                    style={[
                      styles.category,
                      {
                        backgroundColor: selected
                          ? colors.primaryLight
                          : colors.surfaceSecondary,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {selected ? (
                      <AppIcon
                        name="checkmark"
                        size={16}
                        color={colors.primary}
                      />
                    ) : null}

                    <Text
                      style={[
                        styles.categoryText,
                        {
                          color: selected
                            ? colors.primary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <AppTextField
            label="وصف المتجر"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="اكتب وصفاً مختصراً عن نشاط متجرك..."
          />

          <AppTextField
            label="عنوان المتجر *"
            value={address}
            onChangeText={(value) => {
              setAddress(value);
              setFieldError("");
            }}
            multiline
            placeholder="مثال: الكرك الشرقي، الشارع الرئيسي..."
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
              <AppIcon name="card" size={19} color={colors.primary} />
            </View>

            <View style={styles.sectionHeaderContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                خطة الاشتراك
              </Text>

              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                اختر المدة التي تناسب نشاط متجرك
              </Text>
            </View>
          </View>

          {plans.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon
                name="information-circle-outline"
                size={20}
                color={colors.textSecondary}
              />

              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                لا توجد خطط اشتراك متاحة حالياً. ستظهر الخطط بعد إضافتها من لوحة
                الإدارة.
              </Text>
            </View>
          ) : (
            <View style={styles.planList}>
              {plans.map((plan) => {
                const selected = planId === plan.id;
                const ready = isPlanReady(plan);

                return (
                  <Pressable
                    key={plan.id}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                      disabled: !ready,
                    }}
                    disabled={!ready}
                    onPress={() => {
                      if (!ready) return;
                      setPlanId(plan.id);
                      setFieldError("");
                    }}
                    style={[
                      styles.plan,
                      {
                        backgroundColor: selected
                          ? colors.primaryLight
                          : colors.surfaceSecondary,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: ready ? 1 : 0.55,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.planRadio,
                        {
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                          backgroundColor: selected
                            ? colors.primary
                            : "transparent",
                        },
                      ]}
                    >
                      {selected ? (
                        <AppIcon
                          name="checkmark"
                          size={13}
                          color={colors.primary}
                        />
                      ) : null}
                    </View>

                    <View style={styles.planContent}>
                      <View style={styles.planTopRow}>
                        <Text style={[styles.planName, { color: colors.text }]}>
                          {plan.name}
                        </Text>

                        <View
                          style={[
                            styles.durationBadge,
                            {
                              backgroundColor: selected
                                ? colors.surface
                                : colors.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.durationText,
                              { color: colors.primary },
                            ]}
                          >
                            {getDurationLabel(plan.duration_months)}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.planDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {plan.description || "اشتراك المتجر في منصة تسوق"}
                      </Text>

                      <Text
                        style={[styles.planPrice, { color: colors.primary }]}
                      >
                        {money(plan.price, plan.currency)}
                      </Text>

                      <Text style={[styles.planTerms, { color: colors.textSecondary }]}>
                        {ready
                          ? `العمولة ${plan.commission_rate}% · حد المنتجات ${plan.product_limit} · ${plan.features?.length ?? 0} مزايا`
                          : "هذه الخطة غير مهيأة بالكامل ولا يمكن اختيارها حاليًا."}
                      </Text>

                      {ready && plan.features?.length ? (
                        <Text style={[styles.planFeatures, { color: colors.textMuted }]}>
                          {plan.features.join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {selectedPlan ? (
            <View style={[styles.selectedPlanSummary, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Text style={[styles.selectedPlanTitle, { color: colors.primary }]}>الخطة المختارة: {selectedPlan.name}</Text>
              <Text style={[styles.selectedPlanText, { color: colors.textSecondary }]}>
                {money(selectedPlan.price, selectedPlan.currency)} · {getDurationLabel(selectedPlan.duration_months)} · عمولة {selectedPlan.commission_rate}%
              </Text>
            </View>
          ) : null}
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
            <AppIcon name="warning" size={19} color={colors.error} />

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
            <AppIcon name="warning" size={19} color={colors.error} />

            <Text style={[styles.validationText, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.nextStepCard,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          <View
            style={[styles.nextStepIcon, { backgroundColor: colors.surface }]}
          >
            <AppIcon
              name="checkmark-circle-outline"
              size={20}
              color={colors.primary}
            />
          </View>

          <View style={styles.nextStepContent}>
            <Text style={[styles.nextStepTitle, { color: colors.text }]}>
              ماذا يحدث بعد الإرسال؟
            </Text>

            <Text
              style={[
                styles.nextStepDescription,
                { color: colors.textSecondary },
              ]}
            >
              ستتم مراجعة بيانات متجرك من الإدارة. بعد الموافقة ستتمكن من الدخول
              إلى لوحة التاجر وإضافة منتجاتك وإدارة طلباتك.
            </Text>
          </View>
        </View>

        <Text style={[styles.submitHint, { color: colors.textSecondary }]}>
          يبدأ الاشتراك وتصدر فاتورته بعد موافقة الإدارة، وليس عند إرسال الطلب.
        </Text>

        <View style={styles.submitArea}>
          <AppButton
            title="إرسال طلب المتجر"
            onPress={() => void submit()}
            loading={busy}
            disabled={!canSubmit}
          />

          <Text style={[styles.submitHint, { color: colors.textSecondary }]}>
            بإرسال الطلب، أنت تؤكد أن البيانات المدخلة صحيحة.
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

  fieldLabel: {
    marginBottom: Spacing.two,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  categoryList: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },

  category: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },

  categoryText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  emptyBox: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.four,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  emptyText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "right",
  },

  planList: {
    gap: Spacing.two,
  },

  plan: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  planRadio: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  planContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  planTopRow: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  planName: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  durationBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },

  durationText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },

  planDescription: {
    width: "100%",
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  planPrice: {
    width: "100%",
    marginTop: Spacing.two,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  planTerms: {
    width: "100%",
    marginTop: Spacing.one,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  planFeatures: {
    width: "100%",
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  selectedPlanSummary: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    gap: Spacing.one,
  },

  selectedPlanTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  selectedPlanText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
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

  nextStepCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  nextStepIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  nextStepContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  nextStepTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  nextStepDescription: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
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

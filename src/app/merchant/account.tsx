import { useRouter } from "expo-router";

import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";

import { AppButton } from "@/components/ui/AppButton";

import { AppIcon } from "@/components/ui/AppIcon";

import { AppConfirmModal, AppModal } from "@/components/ui/AppModal";

import { AppTextField } from "@/components/ui/AppTextField";

import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";

import { useAuth } from "@/context/AuthContext";

import { useTheme } from "@/context/ThemeContext";

import {
  peekLocalCache,
  readLocalCache,
  writeLocalCache,
} from "@/lib/local-cache";

import { getMerchantStore, type MerchantStore } from "@/lib/merchant-store";

import { supabase } from "@/lib/supabase";

type AccountSnapshot = {
  name: string;

  email: string;

  store: MerchantStore | null;
};

type MerchantSubscription = {
  id: string;
  plan_id: string;
  plan_name_snapshot: string;
  duration_months: number;
  price_snapshot: number;
  currency_snapshot: string;
  starts_at: string;
  expires_at: string;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  currency: string;
  description: string;
};

type MenuItemProps = {
  icon: string;

  title: string;

  subtitle?: string;

  onPress?: () => void;
};

export default function MerchantAccountScreen() {
  const router = useRouter();

  const { user } = useAuth();

  const { colors } = useTheme();

  const cacheKey = user ? `merchant-account:${user.id}` : "";

  const cachedAccount = cacheKey
    ? peekLocalCache<AccountSnapshot>(cacheKey)
    : null;

  const [loading, setLoading] = useState(() => !cacheKey || !cachedAccount);

  const [saving, setSaving] = useState(false);

  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(
    cachedAccount ?? null,
  );

  const [phone, setPhone] = useState(cachedAccount?.store?.phone ?? "");

  const [editingProfile, setEditingProfile] = useState(false);

  const [confirmLogout, setConfirmLogout] = useState(false);

  const [storeEditOpen, setStoreEditOpen] = useState(false);

  const [storeSaving, setStoreSaving] = useState(false);

  const [storeName, setStoreName] = useState("");

  const [storeDescription, setStoreDescription] = useState("");

  const [storeAddress, setStoreAddress] = useState("");

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] =
    useState<MerchantSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [simpleModal, setSimpleModal] = useState<
    "settlements" | "notifications" | "support" | "about" | null
  >(null);

  const loadSubscriptions = useCallback(async (merchantId: string) => {
    setSubscriptionLoading(true);
    try {
      const [currentResult, plansResult] = await Promise.all([
        supabase
          .from("merchant_subscriptions")
          .select(
            "id,plan_id,plan_name_snapshot,duration_months,price_snapshot,currency_snapshot,starts_at,expires_at",
          )
          .eq("merchant_id", merchantId)
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("subscription_plans")
          .select("id,name,duration_months,price,currency,description")
          .eq("is_active", true)
          .order("duration_months", { ascending: true }),
      ]);

      if (currentResult.error) throw currentResult.error;
      if (plansResult.error) throw plansResult.error;

      setCurrentSubscription(currentResult.data as MerchantSubscription | null);
      setAvailablePlans((plansResult.data ?? []) as SubscriptionPlan[]);
    } catch {
      setCurrentSubscription(null);
      setAvailablePlans([]);
      setError("تعذر تحميل بيانات الاشتراك. حاول مرة أخرى.");
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  const openSubscription = async () => {
    setSubscriptionOpen(true);
    const merchantId = snapshot?.store?.merchant_id;
    if (merchantId) {
      await loadSubscriptions(merchantId);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;

    const key = `merchant-account:${user.id}`;

    const cached = peekLocalCache<AccountSnapshot>(key);

    if (cached) {
      setSnapshot(cached);

      setPhone(cached.store?.phone ?? "");

      setLoading(false);
    } else {
      const persisted = await readLocalCache<AccountSnapshot>(key);

      if (persisted) {
        setSnapshot(persisted);

        setPhone(persisted.store?.phone ?? "");

        setLoading(false);
      }
    }

    try {
      const [profileResult, ownedStore] = await Promise.all([
        supabase

          .from("profiles")

          .select("full_name,email")

          .eq("id", user.id)

          .single(),

        getMerchantStore(user.id),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      const next: AccountSnapshot = {
        name: profileResult.data.full_name ?? "",

        email: profileResult.data.email ?? "",

        store: ownedStore,
      };

      setSnapshot(next);

      setPhone(ownedStore?.phone ?? "");

      if (ownedStore?.merchant_id) {
        await loadSubscriptions(ownedStore.merchant_id);
      } else {
        setCurrentSubscription(null);
        setAvailablePlans([]);
      }

      await writeLocalCache(key, next);
    } catch {
      setError("تعذر تحميل بيانات الحساب. حاول تحديث الصفحة.");
    } finally {
      setLoading(false);
    }
  }, [loadSubscriptions, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const saveProfile = async () => {
    if (!user || !snapshot) return;

    const name = snapshot.name.trim();

    if (name.length < 2) {
      setError("أدخل اسمًا صحيحًا.");

      return;
    }

    setSaving(true);

    setError("");

    const { error: profileError } = await supabase

      .from("profiles")

      .update({
        full_name: name,
      })

      .eq("id", user.id);

    setSaving(false);

    if (profileError) {
      setError("تعذر حفظ الاسم. حاول مرة أخرى.");

      return;
    }

    const next: AccountSnapshot = {
      ...snapshot,

      name,
    };

    setSnapshot(next);

    await writeLocalCache(`merchant-account:${user.id}`, next);

    setEditingProfile(false);

    setNotice("تم تحديث بيانات الحساب.");
  };

  const openStoreEditor = () => {
    const store = snapshot?.store;

    if (!store) {
      setError("لا توجد بيانات متجر مرتبطة بهذا الحساب.");

      return;
    }

    setStoreName(store.name);

    setStoreDescription(store.description);

    setStoreAddress(store.address);

    setPhone(store.phone);

    setStoreEditOpen(true);
  };

  const saveStoreDetails = async () => {
    const store = snapshot?.store;

    if (
      !user ||
      !store ||
      !storeName.trim() ||
      !phone.trim() ||
      !storeAddress.trim()
    ) {
      setError("أكمل اسم المتجر ورقم التواصل والعنوان.");

      return;
    }

    setStoreSaving(true);

    setError("");

    const { error: updateError } = await supabase

      .from("stores")

      .update({
        name: storeName.trim(),

        description: storeDescription.trim(),

        phone: phone.trim(),

        address: storeAddress.trim(),
      })

      .eq("id", store.id);

    setStoreSaving(false);

    if (updateError) {
      setError("تعذر حفظ بيانات المتجر.");

      return;
    }

    const nextStore: MerchantStore = {
      ...store,

      name: storeName.trim(),

      description: storeDescription.trim(),

      phone: phone.trim(),

      address: storeAddress.trim(),
    };

    const nextSnapshot: AccountSnapshot = {
      ...snapshot,

      store: nextStore,
    };

    setSnapshot(nextSnapshot);

    await writeLocalCache(`merchant-account:${user.id}`, nextSnapshot);

    const home = peekLocalCache<{ store: MerchantStore }>(
      `merchant-home:${user.id}`,
    );

    if (home) {
      await writeLocalCache(`merchant-home:${user.id}`, {
        ...home,

        store: nextStore,
      });
    }

    setStoreEditOpen(false);

    setNotice("تم تحديث بيانات المتجر.");
  };

  const logout = async () => {
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError("تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.");

      return;
    }

    setConfirmLogout(false);

    router.replace("/login");
  };

  if (loading && !snapshot) {
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
    <View
      style={[
        styles.screen,

        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="حساب التاجر" mode="business" />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View
            style={[
              styles.profileIcon,

              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon name="person-outline" size={28} color={colors.primary} />
          </View>

          <View style={styles.profileContent}>
            <Text
              style={[
                styles.profileName,

                {
                  color: colors.text,
                },
              ]}
            >
              {snapshot?.name || "التاجر"}
            </Text>

            <Text
              style={[
                styles.profileEmail,

                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {snapshot?.email || "—"}
            </Text>

            <Text
              style={[
                styles.profileStore,

                {
                  color: colors.textMuted,
                },
              ]}
            >
              {snapshot?.store?.name || "لم يتم تحديد المتجر"}
            </Text>
          </View>
        </View>

        {editingProfile ? (
          <View
            style={[
              styles.editorCard,

              {
                backgroundColor: colors.surface,

                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,

                {
                  color: colors.text,
                },
              ]}
            >
              تعديل الملف الشخصي
            </Text>

            <AppTextField
              label="الاسم الكامل"
              value={snapshot?.name ?? ""}
              onChangeText={(value) =>
                setSnapshot((previous) =>
                  previous
                    ? {
                        ...previous,

                        name: value,
                      }
                    : previous,
                )
              }
              autoCapitalize="words"
            />

            <View style={styles.editorActions}>
              <AppButton
                title="حفظ التغييرات"
                icon="checkmark-outline"
                loading={saving}
                onPress={() => void saveProfile()}
              />

              <AppButton
                title="إلغاء"
                variant="outline"
                onPress={() => {
                  setEditingProfile(false);

                  setError("");

                  void load();
                }}
              />
            </View>
          </View>
        ) : null}

        <AccountSection title="الملف الشخصي">
          <MenuItem
            icon="person-outline"
            title="بيانات الحساب"
            subtitle={snapshot?.name || "إدارة الاسم والبيانات الأساسية"}
            onPress={() => setEditingProfile(true)}
          />

          <MenuItem
            icon="lock-closed-outline"
            title="الأمان وكلمة المرور"
            subtitle="إدارة كلمة المرور وحماية الحساب"
            onPress={() => router.push("../security")}
          />

          <MenuItem
            icon="settings-outline"
            title="الإعدادات"
            subtitle="الإشعارات والمظهر واللغة والخصوصية"
            onPress={() => router.push("../settings")}
          />
        </AccountSection>

        <AccountSection title="متجري">
          <MenuItem
            icon="storefront-outline"
            title="بيانات المتجر"
            subtitle={snapshot?.store?.name || "إدارة بيانات المتجر"}
            onPress={openStoreEditor}
          />

          <MenuItem
            icon="card-outline"
            title="الاشتراك"
            subtitle={
              currentSubscription
                ? `${currentSubscription.plan_name_snapshot} • ${currentSubscription.price_snapshot} ${currentSubscription.currency_snapshot}`
                : "عرض الاشتراك الحالي والاشتراكات المتاحة"
            }
            onPress={() => void openSubscription()}
          />

          <MenuItem
            icon="wallet-outline"
            title="العمليات المالية "
            subtitle="الرصيد والعمليات المالية"
            onPress={() => router.push("/wallet")}
          />

          <MenuItem
            icon="receipt-outline"
            title="سجل الطلبات"
            subtitle="الطلبات السابقة والمكتملة"
            onPress={() => router.push("/merchant/orders")}
          />
        </AccountSection>

        <View
          style={[
            styles.controlCard,

            {
              backgroundColor: colors.surface,

              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={() => setConfirmLogout(true)}
            style={({ pressed }) => [
              styles.logoutRow,

              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppIcon name="log-out-outline" size={21} color={colors.error} />

            <Text
              style={[
                styles.logoutText,

                {
                  color: colors.error,
                },
              ]}
            >
              تسجيل الخروج
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text
            style={[
              styles.footerBrand,

              {
                color: colors.text,
              },
            ]}
          >
            تسوق
          </Text>

          <Text
            style={[
              styles.footerRegion,

              {
                color: colors.textMuted,
              },
            ]}
          >
            الكرك الشرقي
          </Text>

          <Text
            style={[
              styles.footerVersion,

              {
                color: colors.textMuted,
              },
            ]}
          >
            إصدار التطبيق
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.messageCard,

              {
                backgroundColor: colors.error,

                borderColor: colors.error,
              },
            ]}
          >
            <AppIcon
              name="alert-circle-outline"
              size={18}
              color={colors.surface}
            />

            <Text
              style={[
                styles.messageText,

                {
                  color: colors.surface,
                },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <AppConfirmModal
        visible={confirmLogout}
        title="تسجيل الخروج؟"
        message="هل تريد إنهاء الجلسة على هذا الجهاز؟"
        confirmText="تسجيل الخروج"
        cancelText="البقاء"
        destructive
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => void logout()}
      />

      <AppModal
        visible={storeEditOpen}
        title="بيانات المتجر"
        message="هذه المعلومات تظهر للعملاء عند تصفح متجرك."
        confirmText="حفظ التعديلات"
        cancelText="إلغاء"
        busy={storeSaving}
        onCancel={() => setStoreEditOpen(false)}
        onConfirm={() => void saveStoreDetails()}
      >
        <AppTextField
          label="اسم المتجر"
          value={storeName}
          onChangeText={setStoreName}
        />

        <AppTextField
          label="وصف المتجر"
          value={storeDescription}
          onChangeText={setStoreDescription}
          multiline
        />

        <AppTextField
          label="رقم التواصل"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <AppTextField
          label="العنوان"
          value={storeAddress}
          onChangeText={setStoreAddress}
          multiline
        />
      </AppModal>

      <AppModal
        visible={subscriptionOpen}
        title="اشتراك المتجر"
        message="عرض الاشتراك الحالي والاشتراكات المتاحة."
        cancelText="إغلاق"
        onCancel={() => setSubscriptionOpen(false)}
      >
        <View style={styles.modalStack}>
          {subscriptionLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text
                style={[styles.modalMutedText, { color: colors.textSecondary }]}
              >
                جارٍ تحميل بيانات الاشتراك...
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.subscriptionCard,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.modalSectionTitle, { color: colors.text }]}
                >
                  الاشتراك الحالي
                </Text>
                {currentSubscription ? (
                  <>
                    <SubscriptionDetail
                      label="الخطة"
                      value={currentSubscription.plan_name_snapshot}
                    />
                    <SubscriptionDetail
                      label="السعر"
                      value={`${currentSubscription.price_snapshot} ${currentSubscription.currency_snapshot}`}
                    />
                    <SubscriptionDetail
                      label="المدة"
                      value={`${currentSubscription.duration_months} شهر`}
                    />
                    <SubscriptionDetail
                      label="البداية"
                      value={formatDate(currentSubscription.starts_at)}
                    />
                    <SubscriptionDetail
                      label="الانتهاء"
                      value={formatDate(currentSubscription.expires_at)}
                    />
                    <SubscriptionDetail
                      label="الحالة"
                      value={getSubscriptionStatus(
                        currentSubscription.expires_at,
                      )}
                    />
                  </>
                ) : (
                  <Text
                    style={[
                      styles.modalMutedText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    لا يوجد اشتراك حالي مرتبط بهذا المتجر.
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.subscriptionCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.modalSectionTitle, { color: colors.text }]}
                >
                  الاشتراكات المتاحة
                </Text>
                {availablePlans.length ? (
                  availablePlans.map((plan) => (
                    <View
                      key={plan.id}
                      style={[
                        styles.planRow,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <View style={styles.planContent}>
                        <Text style={[styles.planName, { color: colors.text }]}>
                          {plan.name}
                        </Text>
                        <Text
                          style={[
                            styles.planDescription,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {plan.description || `${plan.duration_months} شهر`}
                        </Text>
                      </View>
                      <Text
                        style={[styles.planPrice, { color: colors.primary }]}
                      >
                        {plan.price} {plan.currency}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text
                    style={[
                      styles.modalMutedText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    لا توجد اشتراكات متاحة حاليًا.
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </AppModal>

      <AppModal
        visible={simpleModal !== null}
        title={
          simpleModal === "settlements"
            ? "التسويات"
            : simpleModal === "notifications"
              ? "الإشعارات"
              : simpleModal === "support"
                ? "المساعدة والدعم"
                : "عن تسوق"
        }
        message={
          simpleModal === "settlements"
            ? "تظهر هنا تسويات المتجر المالية عند توفر عمليات تسوية مرتبطة بالحساب."
            : simpleModal === "notifications"
              ? "ستظهر هنا تنبيهات الطلبات والمتجر عند وصول إشعارات جديدة."
              : simpleModal === "support"
                ? "للدعم، استخدم بيانات التواصل المعتمدة من إدارة المنصة عند توفرها."
                : "تسوق منصة محلية لربط العملاء بالمتاجر والخدمات في الكرك الشرقي."
        }
        cancelText="إغلاق"
        onCancel={() => setSimpleModal(null)}
      />

      <AppModal
        visible={Boolean(notice)}
        title="تم الحفظ"
        message={notice}
        onCancel={() => setNotice("")}
      />
    </View>
  );
}

function SubscriptionDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function getSubscriptionStatus(expiresAt: string) {
  return new Date(expiresAt).getTime() > Date.now() ? "ساري" : "منتهي";
}

function AccountSection({
  title,

  children,
}: {
  title: string;

  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,

          {
            color: colors.text,
          },
        ]}
      >
        {title}
      </Text>

      <View
        style={[
          styles.menuCard,

          {
            backgroundColor: colors.surface,

            borderColor: colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function MenuItem({
  icon,

  title,

  subtitle,

  onPress,
}: MenuItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,

        {
          borderBottomColor: colors.border,

          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.menuIcon,

          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon
          name={
            icon as keyof typeof import("@expo/vector-icons/Ionicons").default.glyphMap
          }
          size={20}
          color={colors.primary}
        />
      </View>

      <View style={styles.menuContent}>
        <Text
          style={[
            styles.menuTitle,

            {
              color: colors.text,
            },
          ]}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text
            style={[
              styles.menuSubtitle,

              {
                color: colors.textSecondary,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <AppIcon name="chevron-back-outline" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  center: {
    flex: 1,

    justifyContent: "center",

    alignItems: "center",
  },

  container: {
    width: "100%",

    maxWidth: 800,

    alignSelf: "center",

    paddingHorizontal: Spacing.four,

    paddingTop: Spacing.three,

    paddingBottom: Spacing.ten,

    gap: Spacing.four,
  },

  profileCard: {
    flexDirection: "row-reverse",

    alignItems: "center",

    gap: Spacing.three,

    padding: Spacing.four,
  },

  profileIcon: {
    width: 58,

    height: 58,

    borderRadius: Radius.full,

    alignItems: "center",

    justifyContent: "center",
  },

  profileContent: {
    flex: 1,

    alignItems: "flex-end",
  },

  profileName: {
    fontFamily: Fonts.bold,

    fontSize: FontSizes.lg,

    textAlign: "right",
  },

  profileEmail: {
    marginTop: 2,

    fontFamily: Fonts.regular,

    fontSize: FontSizes.sm,

    textAlign: "right",
  },

  profileStore: {
    marginTop: 3,

    fontFamily: Fonts.medium,

    fontSize: FontSizes.xs,

    textAlign: "right",
  },

  editorCard: {
    borderWidth: 1,

    borderRadius: Radius.lg,

    padding: Spacing.four,

    gap: Spacing.three,
  },

  cardTitle: {
    fontFamily: Fonts.bold,

    fontSize: FontSizes.md,

    textAlign: "right",
  },

  editorActions: {
    gap: Spacing.two,
  },

  section: {
    gap: Spacing.two,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,

    fontSize: FontSizes.sm,

    textAlign: "right",

    paddingHorizontal: Spacing.one,
  },

  menuCard: {
    borderWidth: 1,

    borderRadius: Radius.lg,

    overflow: "hidden",
  },

  menuItem: {
    minHeight: 68,

    flexDirection: "row-reverse",

    alignItems: "center",

    paddingHorizontal: Spacing.three,

    gap: Spacing.three,

    borderBottomWidth: 1,
  },

  menuItemLast: {
    borderBottomWidth: 0,
  },

  menuIcon: {
    width: 38,

    height: 38,

    borderRadius: Radius.md,

    alignItems: "center",

    justifyContent: "center",
  },

  menuContent: {
    flex: 1,

    alignItems: "flex-end",
  },

  menuTitle: {
    fontFamily: Fonts.semiBold,

    fontSize: FontSizes.sm,

    textAlign: "right",
  },

  menuSubtitle: {
    marginTop: 2,

    fontFamily: Fonts.regular,

    fontSize: FontSizes.xs,

    lineHeight: 18,

    textAlign: "right",
  },

  soonText: {
    fontFamily: Fonts.medium,

    fontSize: FontSizes.xs,
  },

  controlCard: {
    borderWidth: 1,

    borderRadius: Radius.lg,

    overflow: "hidden",
  },

  logoutRow: {
    minHeight: 58,

    flexDirection: "row-reverse",

    alignItems: "center",

    justifyContent: "center",

    gap: Spacing.two,
  },

  logoutText: {
    fontFamily: Fonts.semiBold,

    fontSize: FontSizes.sm,
  },

  messageCard: {
    minHeight: 48,

    borderWidth: 1,

    borderRadius: Radius.md,

    paddingHorizontal: Spacing.three,

    flexDirection: "row-reverse",

    alignItems: "center",

    gap: Spacing.two,
  },

  modalStack: {
    gap: Spacing.three,
  },

  modalLoading: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },

  modalMutedText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "right",
  },

  modalSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
    marginBottom: Spacing.two,
  },

  subscriptionCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  detailRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  detailLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  detailValue: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "left",
  },

  planRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.three,
  },

  planContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  planName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  planDescription: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
  },

  planPrice: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  messageText: {
    flex: 1,

    fontFamily: Fonts.medium,

    fontSize: FontSizes.xs,

    textAlign: "right",

    lineHeight: 20,
  },

  footer: {
    alignItems: "center",

    paddingTop: Spacing.three,

    gap: 2,
  },

  footerBrand: {
    fontFamily: Fonts.bold,

    fontSize: FontSizes.md,
  },

  footerRegion: {
    fontFamily: Fonts.medium,

    fontSize: FontSizes.xs,
  },

  footerVersion: {
    fontFamily: Fonts.regular,

    fontSize: FontSizes.xs,
  },
});

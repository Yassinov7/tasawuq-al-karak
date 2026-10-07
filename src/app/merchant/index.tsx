import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Shadows, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  peekLocalCache,
  readLocalCache,
  writeLocalCache,
} from "@/lib/local-cache";
import {
  getMerchantStore,
  getStoreMediaUrl,
  type MerchantStore,
} from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";

type HomeProduct = {
  id: string;
  title: string;
  price: number;
  currency: "SYP" | "USD";
  selling_unit: string;
  image_path: string | null;
};

type HomeOffer = {
  id: string;
  title: string;
  offer_type: "discount" | "bundle" | "buy_x_get_y";
  discount_method: "percentage" | "fixed_amount" | null;
  discount_value: number | null;
  bundle_price: number | null;
  currency: "SYP" | "USD";
  ends_at: string | null;
  items?: {
    title: string;
    quantity: number;
    item_role: "discounted" | "bundle" | "buy" | "reward";
  }[];
};

type HomeSnapshot = {
  store: MerchantStore;
  productCount: number;
  offerCount: number;
  incomingOrderCount: number;
  recentProducts: HomeProduct[];
  activeOffers: HomeOffer[];
};

type ThemeColors = ReturnType<typeof useTheme>["colors"];

const CACHE_PREFIX = "merchant-home:";

function formatPrice(price: number, currency: "SYP" | "USD"): string {
  const formatted = new Intl.NumberFormat("ar-SY", {
    maximumFractionDigits: 2,
  }).format(price);

  return `${formatted} ${currency}`;
}

function formatOffer(offer: HomeOffer): string {
  if (offer.offer_type === "discount" && offer.discount_value !== null) {
    if (offer.discount_method === "percentage") {
      return `خصم ${offer.discount_value}%`;
    }

    return `خصم ${formatPrice(offer.discount_value, offer.currency)}`;
  }

  if (offer.offer_type === "bundle" && offer.bundle_price !== null) {
    return `باقة بسعر ${formatPrice(offer.bundle_price, offer.currency)}`;
  }

  if (offer.offer_type === "buy_x_get_y") {
    return "عرض شراء";
  }

  return "عرض فعال";
}

function formatOfferEndDate(endsAt: string | null): string | null {
  if (!endsAt) {
    return null;
  }

  const date = new Date(endsAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `ينتهي ${new Intl.DateTimeFormat("ar-SY", {
    day: "numeric",
    month: "short",
  }).format(date)}`;
}

function getStoreStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "المتجر نشط";
    case "pending":
      return "بانتظار التفعيل";
    case "suspended":
      return "المتجر موقوف";
    case "rejected":
      return "المتجر مرفوض";
    default:
      return status || "حالة غير محددة";
  }
}

function getStoreStatusTone(status: string, colors: ThemeColors) {
  switch (status) {
    case "active":
      return {
        background: colors.primaryLight,
        foreground: colors.primary,
      };
    case "suspended":
    case "rejected":
      return {
        background: colors.accentLight,
        foreground: colors.accent,
      };
    default:
      return {
        background: colors.accentLight,
        foreground: colors.accent,
      };
  }
}

function getProductImagePath(
  productId: string,
  mediaRows: {
    product_id: string;
    storage_path: string;
  }[],
) {
  return (
    mediaRows.find((item) => item.product_id === productId)?.storage_path ??
    null
  );
}

export default function MerchantHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCachedContent, setShowCachedContent] = useState(false);

  const cacheKey = useMemo(() => {
    if (!user?.id) {
      return null;
    }

    return `${CACHE_PREFIX}${user.id}`;
  }, [user?.id]);

  const loadDashboard = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const background = options?.background ?? false;

      if (!background) {
        setLoading(true);
      }

      setError(null);

      try {
        const store = await getMerchantStore(user.id);

        if (!store) {
          throw new Error("لم يتم العثور على متجر مرتبط بهذا الحساب.");
        }

        const now = new Date().toISOString();

        const [productsResult, offersResult, notificationsResult] =
          await Promise.all([
            supabase
              .from("products")
              .select("id,title,price,currency,selling_unit", {
                count: "exact",
              })
              .eq("store_id", store.id)
              .order("created_at", {
                ascending: false,
              })
              .limit(4),

            supabase
              .from("store_offers")
              .select(
                "id,title,offer_type,discount_method,discount_value,bundle_price,currency,ends_at",
                {
                  count: "exact",
                },
              )
              .eq("store_id", store.id)
              .eq("is_active", true)
              .lte("starts_at", now)
              .or(`ends_at.is.null,ends_at.gt.${now}`)
              .order("created_at", {
                ascending: false,
              })
              .limit(4),

            supabase
              .from("notifications")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", user.id)
              .eq("type", "order")
              .is("read_at", null),
          ]);

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (offersResult.error) {
          throw offersResult.error;
        }

        if (notificationsResult.error) {
          throw notificationsResult.error;
        }

        const productRows = (productsResult.data ?? []) as {
          id: string;
          title: string;
          price: number;
          currency: "SYP" | "USD";
          selling_unit: string;
        }[];

        const productIds = productRows.map((product) => product.id);

        let mediaRows: {
          product_id: string;
          storage_path: string;
        }[] = [];

        if (productIds.length > 0) {
          const { data: mediaData, error: mediaError } = await supabase
            .from("product_media")
            .select("product_id,storage_path")
            .eq("store_id", store.id)
            .eq("media_type", "image")
            .in("product_id", productIds)
            .order("display_order", {
              ascending: true,
            });

          if (mediaError) {
            throw mediaError;
          }

          mediaRows = (mediaData ?? []) as {
            product_id: string;
            storage_path: string;
          }[];
        }

        const recentProducts: HomeProduct[] = productRows.map((product) => ({
          ...product,
          image_path: getProductImagePath(product.id, mediaRows),
        }));

        const offerRows = offersResult.data ?? [];
        const activeOffers: HomeOffer[] = offerRows.map((offer) => ({
          ...offer,
          items: [],
        }));

        if (offerRows.length > 0) {
          const { data: offerItems, error: offerItemsError } = await supabase
            .from("store_offer_products")
            .select("offer_id,product_id,quantity,item_role")
            .in("offer_id", offerRows.map((offer) => offer.id));

          if (offerItemsError) {
            throw offerItemsError;
          }

          const itemRows = offerItems ?? [];
          const offerProductIds = [...new Set(itemRows.map((item) => item.product_id))];
          const productsById = new Map<string, string>();

          if (offerProductIds.length > 0) {
            const { data: offerProducts, error: offerProductsError } = await supabase
              .from("products")
              .select("id,title")
              .in("id", offerProductIds);

            if (offerProductsError) {
              throw offerProductsError;
            }

            for (const product of offerProducts ?? []) {
              productsById.set(product.id, product.title);
            }
          }

          const offersById = new Map(activeOffers.map((offer) => [offer.id, offer]));
          for (const item of itemRows) {
            const offer = offersById.get(item.offer_id);
            const title = productsById.get(item.product_id);
            if (offer && title) {
              offer.items = [...(offer.items ?? []), {
                title,
                quantity: item.quantity,
                item_role: item.item_role,
              }];
            }
          }
        }

        const nextSnapshot: HomeSnapshot = {
          store,
          productCount: productsResult.count ?? 0,
          offerCount: offersResult.count ?? 0,
          incomingOrderCount: notificationsResult.count ?? 0,
          recentProducts,
          activeOffers,
        };

        setSnapshot(nextSnapshot);
        setShowCachedContent(false);

        if (cacheKey) {
          await writeLocalCache(cacheKey, nextSnapshot);
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "تعذر تحميل لوحة المتجر.";

        if (cacheKey) {
          const cached = await readLocalCache<HomeSnapshot>(cacheKey);

          if (cached) {
            setSnapshot(cached);
            setShowCachedContent(true);
          }
        }

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey, user],
  );

  useEffect(() => {
    let mounted = true;

    const loadCachedFirst = async () => {
      if (!cacheKey) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      const hasCache = await peekLocalCache(cacheKey);

      if (!mounted) {
        return;
      }

      if (hasCache) {
        const cached = await readLocalCache<HomeSnapshot>(cacheKey);

        if (cached && mounted) {
          setSnapshot(cached);
          setShowCachedContent(true);
          setLoading(false);
        }
      }

      await loadDashboard({
        background: Boolean(hasCache),
      });
    };

    void loadCachedFirst();

    return () => {
      mounted = false;
    };
  }, [cacheKey, loadDashboard]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadDashboard();
  }, [loadDashboard]);

  if (loading && !snapshot) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <AppHeader title="لوحة تحكم المتجر" mode="business" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text
            style={[
              styles.loadingText,
              {
                color: colors.textMuted,
              },
            ]}
          >
            جارٍ تحميل لوحة متجرك...
          </Text>
        </View>
      </View>
    );
  }

  if (!snapshot) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <AppHeader title="لوحة التاجر" />

        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorIcon,
              {
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
          >
            <AppIcon name="warning-outline" size={28} color={colors.error} />
          </View>

          <Text
            style={[
              styles.errorTitle,
              {
                color: colors.text,
              },
            ]}
          >
            تعذر تحميل المتجر
          </Text>

          <Text
            style={[
              styles.errorMessage,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {error ?? "حدث خطأ غير متوقع."}
          </Text>

          <AppButton
            title="إعادة المحاولة"
            onPress={() => void loadDashboard()}
          />
        </View>
      </View>
    );
  }

  const statusTone = getStoreStatusTone(snapshot.store.status, colors);

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="لوحة التاجر" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.greetingRow}>
          <View style={styles.greetingTextContainer}>
            <Text
              style={[
                styles.greeting,
                {
                  color: colors.text,
                },
              ]}
            >
              أهلاً بك 👋
            </Text>

            <Text
              style={[
                styles.greetingStore,
                {
                  color: colors.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {snapshot.store.name}
            </Text>
          </View>

          <View
            style={[
              styles.locationPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppIcon name="location-outline" size={16} color={colors.primary} />

            <Text
              style={[
                styles.locationText,
                {
                  color: colors.text,
                },
              ]}
            >
              الكرك الشرقي
            </Text>
          </View>
        </View>

        {showCachedContent ? (
          <View
            style={[
              styles.cacheNotice,
              {
                backgroundColor: colors.accentLight,
              },
            ]}
          >
            <AppIcon
              name="information-circle-outline"
              size={17}
              color={colors.accent}
            />

            <Text
              style={[
                styles.cacheNoticeText,
                {
                  color: colors.text,
                },
              ]}
            >
              يتم عرض آخر بيانات محفوظة وسيتم تحديثها عند توفر الاتصال.
            </Text>
          </View>
        ) : null}

        {error ? (
          <Pressable
            onPress={() => void loadDashboard()}
            style={[
              styles.refreshNotice,
              {
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
          >
            <AppIcon name="refresh-outline" size={17} color={colors.error} />

            <Text
              style={[
                styles.refreshNoticeText,
                {
                  color: colors.text,
                },
              ]}
            >
              تعذر تحديث بعض البيانات. اضغط للمحاولة مرة أخرى.
            </Text>
          </Pressable>
        ) : null}

        <View
          style={[
            styles.storeCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={styles.storeCardTop}>
            <View
              style={[
                styles.storeIconContainer,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="storefront-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <View style={styles.storeCardInfo}>
              <Text
                style={[
                  styles.storeCardTitle,
                  {
                    color: colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {snapshot.store.name}
              </Text>

              <Text
                style={[
                  styles.storeCardDescription,
                  {
                    color: colors.textMuted,
                  },
                ]}
                numberOfLines={2}
              >
                {snapshot.store.description ||
                  "أدر منتجاتك وعروضك وطلباتك من مكان واحد."}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: statusTone.background,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: statusTone.foreground,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color: statusTone.foreground,
                  },
                ]}
              >
                {getStoreStatusLabel(snapshot.store.status)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.storeDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <Pressable
            onPress={() => router.push("/merchant/account")}
            style={({ pressed }) => [
              styles.storeManageRow,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.storeManageText,
                {
                  color: colors.primary,
                },
              ]}
            >
              إدارة حساب المتجر
            </Text>

            <AppIcon
              name="chevron-back-outline"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </View>

        <SectionHeader
          title="ملخص المتجر"
          subtitle="نظرة سريعة على نشاط متجرك"
          colors={colors}
        />

        <View style={styles.statsGrid}>
          <StatCard
            icon="receipt-outline"
            title="طلبات تحتاج متابعة"
            value={String(snapshot.incomingOrderCount)}
            subtitle="إشعارات الطلبات غير المقروءة"
            colors={colors}
            onPress={() => router.push("/merchant/orders")}
          />

          <StatCard
            icon="cube-outline"
            title="منتجات المتجر"
            value={String(snapshot.productCount)}
            subtitle="إجمالي المنتجات"
            colors={colors}
            onPress={() => router.push("/merchant/catalog")}
          />

          <StatCard
            icon="pricetags-outline"
            title="العروض الفعالة"
            value={String(snapshot.offerCount)}
            subtitle="عروض متاحة حاليًا"
            colors={colors}
            onPress={() => router.push("/merchant/catalog")}
          />
        </View>

        <SectionHeader
          title="إجراءات سريعة"
          subtitle="وصل لما تحتاجه بسرعة"
          colors={colors}
        />

        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="add-circle-outline"
            title="إضافة منتج"
            subtitle="أضف منتجًا جديدًا"
            colors={colors}
            onPress={() => router.push("/merchant/product-editor")}
          />

          <QuickAction
            icon="pricetag-outline"
            title="إضافة عرض"
            subtitle="أنشئ عرضًا لمتجرك"
            colors={colors}
            onPress={() => router.push("/merchant/offer-editor")}
          />

          <QuickAction
            icon="cube-outline"
            title="إدارة الكتالوج"
            subtitle="المنتجات والعروض"
            colors={colors}
            onPress={() => router.push("/merchant/catalog")}
          />

          <QuickAction
            icon="receipt-outline"
            title="إدارة الطلبات"
            subtitle="تابع طلبات العملاء"
            colors={colors}
            onPress={() => router.push("/merchant/orders")}
          />
        </View>

        <SectionHeader
          title="أحدث المنتجات"
          subtitle={
            snapshot.productCount > 0
              ? `${snapshot.productCount} منتج في الكتالوج`
              : "لم تضف منتجات بعد"
          }
          actionLabel={snapshot.productCount > 0 ? "عرض الكل" : undefined}
          onAction={() => router.push("/merchant/catalog")}
          colors={colors}
        />

        {snapshot.recentProducts.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {snapshot.recentProducts.map((product) => (
              <ProductPreview
                key={product.id}
                product={product}
                colors={colors}
              />
            ))}
          </ScrollView>
        ) : (
          <EmptySection
            icon="cube-outline"
            title="لا توجد منتجات بعد"
            description="ابدأ بإضافة أول منتج إلى كتالوج متجرك."
            actionLabel="إضافة منتج"
            onPress={() => router.push("/merchant/product-editor")}
            colors={colors}
          />
        )}

        <SectionHeader
          title="العروض الفعالة"
          subtitle={
            snapshot.offerCount > 0
              ? `${snapshot.offerCount} عرض فعال`
              : "لا توجد عروض فعالة"
          }
          actionLabel={snapshot.offerCount > 0 ? "عرض الكل" : undefined}
          onAction={() => router.push("/merchant/catalog")}
          colors={colors}
        />

        {snapshot.activeOffers.length > 0 ? (
          <View style={styles.offersList}>
            {snapshot.activeOffers.map((offer) => (
              <OfferPreview key={offer.id} offer={offer} colors={colors} />
            ))}
          </View>
        ) : (
          <EmptySection
            icon="pricetag-outline"
            title="لا توجد عروض فعالة"
            description="أنشئ عرضًا جديدًا لجذب العملاء إلى متجرك."
            actionLabel="إضافة عرض"
            onPress={() => router.push("/merchant/offer-editor")}
            colors={colors}
          />
        )}

        <View
          style={[
            styles.bottomNote,
            {
              backgroundColor: colors.primaryLight,
            },
          ]}
        >
          <View
            style={[
              styles.bottomNoteIcon,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            <AppIcon name="sparkles-outline" size={21} color={colors.primary} />
          </View>

          <View style={styles.bottomNoteContent}>
            <Text
              style={[
                styles.bottomNoteTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              خلّي متجرك جاهزًا دائمًا
            </Text>

            <Text
              style={[
                styles.bottomNoteText,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              حدّث المنتجات والأسعار والعروض باستمرار حتى تظهر للعملاء بشكل
              صحيح.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  colors: ThemeColors;
};

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  colors,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
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

        {subtitle ? (
          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.sectionAction,
            pressed && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Text
            style={[
              styles.sectionActionText,
              {
                color: colors.primary,
              },
            ]}
          >
            {actionLabel}
          </Text>

          <AppIcon
            name="chevron-back-outline"
            size={16}
            color={colors.primary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

type StatCardProps = {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  value: string;
  subtitle: string;
  colors: ThemeColors;
  onPress: () => void;
};

function StatCard({
  icon,
  title,
  value,
  subtitle,
  colors,
  onPress,
}: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadows.card,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.statIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={21} color={colors.primary} />
      </View>

      <Text
        style={[
          styles.statValue,
          {
            color: colors.text,
          },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statTitle,
          {
            color: colors.text,
          },
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.statSubtitle,
          {
            color: colors.textMuted,
          },
        ]}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

type QuickActionProps = {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  subtitle: string;
  colors: ThemeColors;
  onPress: () => void;
};

function QuickAction({
  icon,
  title,
  subtitle,
  colors,
  onPress,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.quickActionIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={21} color={colors.primary} />
      </View>

      <View style={styles.quickActionContent}>
        <Text
          style={[
            styles.quickActionTitle,
            {
              color: colors.text,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.quickActionSubtitle,
            {
              color: colors.textMuted,
            },
          ]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>

      <AppIcon name="chevron-back-outline" size={17} color={colors.textMuted} />
    </Pressable>
  );
}

type ProductPreviewProps = {
  product: HomeProduct;
  colors: ThemeColors;
};

function ProductPreview({ product, colors }: ProductPreviewProps) {
  return (
    <View
      style={[
        styles.productCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadows.card,
      ]}
    >
      <View
        style={[
          styles.productImageContainer,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        {product.image_path ? (
          <Image
            source={{
              uri: getStoreMediaUrl(product.image_path),
            }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <AppIcon name="image-outline" size={28} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text
          style={[
            styles.productTitle,
            {
              color: colors.text,
            },
          ]}
          numberOfLines={2}
        >
          {product.title}
        </Text>

        <Text
          style={[
            styles.productUnit,
            {
              color: colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {product.selling_unit}
        </Text>

        <Text
          style={[
            styles.productPrice,
            {
              color: colors.primary,
            },
          ]}
          numberOfLines={1}
        >
          {formatPrice(product.price, product.currency)}
        </Text>
      </View>
    </View>
  );
}

type OfferPreviewProps = {
  offer: HomeOffer;
  colors: ThemeColors;
};

function OfferPreview({ offer, colors }: OfferPreviewProps) {
  const endDate = formatOfferEndDate(offer.ends_at);

  return (
    <View
      style={[
        styles.offerCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadows.card,
      ]}
    >
      <View
        style={[
          styles.offerIcon,
          {
            backgroundColor: colors.accentLight,
          },
        ]}
      >
        <AppIcon name="pricetag-outline" size={23} color={colors.accent} />
      </View>

      <View style={styles.offerContent}>
        <Text
          style={[
            styles.offerTitle,
            {
              color: colors.text,
            },
          ]}
          numberOfLines={1}
        >
          {offer.title}
        </Text>

        <Text
          style={[
            styles.offerSummary,
            {
              color: colors.primary,
            },
          ]}
          numberOfLines={1}
        >
          {formatOffer(offer)}
        </Text>

        {offer.items && offer.items.length > 0 ? (
          <Text
            style={[
              styles.offerItems,
              {
                color: colors.textSecondary,
              },
            ]}
            numberOfLines={2}
          >
            {offer.items
              .map((item) => `${item.title} × ${item.quantity}${item.item_role === "reward" ? " (هدية)" : ""}`)
              .join(" · ")}
          </Text>
        ) : null}

        {endDate ? (
          <Text
            style={[
              styles.offerEnd,
              {
                color: colors.textMuted,
              },
            ]}
            numberOfLines={1}
          >
            {endDate}
          </Text>
        ) : null}
      </View>

      <AppIcon name="chevron-back-outline" size={18} color={colors.textMuted} />
    </View>
  );
}

type EmptySectionProps = {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
  colors: ThemeColors;
};

function EmptySection({
  icon,
  title,
  description,
  actionLabel,
  onPress,
  colors,
}: EmptySectionProps) {
  return (
    <View
      style={[
        styles.emptySection,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={25} color={colors.primary} />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            color: colors.text,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.emptyDescription,
          {
            color: colors.textMuted,
          },
        ]}
      >
        {description}
      </Text>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.emptyAction,
          {
            backgroundColor: colors.primaryLight,
          },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.emptyActionText,
            {
              color: colors.primary,
            },
          ]}
        >
          {actionLabel}
        </Text>

        <AppIcon name="arrow-back" size={17} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 120,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },

  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.md,
    textAlign: "center",
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },

  errorIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  errorTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "center",
  },

  errorMessage: {
    maxWidth: 340,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 23,
    textAlign: "center",
  },

  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },

  greetingTextContainer: {
    flex: 1,
  },

  greeting: {
    fontFamily: Fonts.bold,
    fontSize: 25,
    lineHeight: 32,
  },

  greetingStore: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.md,
  },

  locationPill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  locationText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  cacheNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Radius.lg,
  },

  cacheNoticeText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 19,
  },

  refreshNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Radius.lg,
  },

  refreshNoticeText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
  },

  storeCard: {
    padding: Spacing.four,
    marginBottom: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  storeCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },

  storeIconContainer: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  storeCardInfo: {
    flex: 1,
  },

  storeCardTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    lineHeight: 25,
  },

  storeCardDescription: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },

  statusText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    textAlign: "right",
  },

  storeDivider: {
    height: 1,
    marginVertical: Spacing.three,
  },

  storeManageRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  storeManageText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    lineHeight: 25,
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },

  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.one,
  },

  sectionActionText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  statsGrid: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },

  statCard: {
    flex: 1,
    minHeight: 150,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  statIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.two,
    borderRadius: Radius.md,
  },

  statValue: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    lineHeight: 30,
  },

  statTitle: {
    marginTop: 2,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },

  statSubtitle: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },

  quickActionsGrid: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },

  quickAction: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  quickActionIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  quickActionContent: {
    flex: 1,
  },

  quickActionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  quickActionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 17,
  },

  horizontalList: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },

  productCard: {
    width: 172,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  productImageContainer: {
    width: "100%",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  productInfo: {
    padding: Spacing.three,
  },

  productTitle: {
    minHeight: 38,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 19,
  },

  productUnit: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  productPrice: {
    marginTop: 6,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  offersList: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },

  offerCard: {
    minHeight: 78,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  offerIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  offerContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  offerTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  offerSummary: {
    marginTop: 3,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  offerItems: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },

  offerEnd: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
  },

  emptySection: {
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    marginBottom: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  emptyIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.three,
    borderRadius: Radius.full,
  },

  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 310,
    marginTop: 5,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "center",
  },

  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },

  emptyActionText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  bottomNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.xl,
  },

  bottomNoteIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  bottomNoteContent: {
    flex: 1,
  },

  bottomNoteTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  bottomNoteText: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },

  bottomSpacing: {
    height: Spacing.four,
  },

  pressed: {
    opacity: 0.7,
  },
});

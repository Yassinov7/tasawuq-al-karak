import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import {
  getMerchantStore,
  getStoreMediaUrl,
  type MerchantStore,
} from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  title: string;
  description: string;
  category_id: string;
  price: number;
  currency: "SYP" | "USD";
  selling_unit: string;
  is_available: boolean;
};

type Category = {
  id: string;
  name: string;
};

type ProductMedia = {
  product_id: string;
  storage_path: string;
  media_type: "image" | "video";
  display_order: number;
};

type ProductsSnapshot = {
  store: MerchantStore | null;
  products: Product[];
  categories: Category[];
  media: ProductMedia[];
};

export function MerchantProductsPanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const cacheKey = user ? `merchant-products:${user.id}` : "";

  const cached = cacheKey
    ? peekLocalCache<ProductsSnapshot>(cacheKey)
    : undefined;

  const [store, setStore] = useState<MerchantStore | null>(
    cached?.store ?? null,
  );
  const [products, setProducts] = useState<Product[]>(cached?.products ?? []);
  const [categories, setCategories] = useState<Category[]>(
    cached?.categories ?? [],
  );
  const [media, setMedia] = useState<ProductMedia[]>(cached?.media ?? []);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!cached);
  const [busyId, setBusyId] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const key = `merchant-products:${user.id}`;

      const saved =
        peekLocalCache<ProductsSnapshot>(key) ??
        (await readLocalCache<ProductsSnapshot>(key));

      if (saved) {
        setStore(saved.store);
        setProducts(saved.products);
        setCategories(saved.categories);
        setMedia(saved.media);
        setLoading(false);
      }

      const ownStore = await getMerchantStore(user.id);
      setStore(ownStore);

      if (!ownStore) return;

      const [productResult, categoryResult, mediaResult] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,title,description,category_id,price,currency,selling_unit,is_available",
          )
          .eq("store_id", ownStore.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("product_categories")
          .select("id,name")
          .eq("is_active", true)
          .order("sort_order"),

        supabase
          .from("product_media")
          .select("product_id,storage_path,media_type,display_order")
          .eq("store_id", ownStore.id)
          .order("display_order"),
      ]);

      if (productResult.error || categoryResult.error || mediaResult.error) {
        throw productResult.error ?? categoryResult.error ?? mediaResult.error;
      }

      const next: ProductsSnapshot = {
        store: ownStore,
        products: (productResult.data ?? []) as Product[],
        categories: (categoryResult.data ?? []) as Category[],
        media: (mediaResult.data ?? []) as ProductMedia[],
      };

      setProducts(next.products);
      setCategories(next.categories);
      setMedia(next.media);

      await writeLocalCache(key, next);
    } catch {
      setError("تعذر تحميل المنتجات. تأكد من تنفيذ ترحيل المتجر والمنتجات.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);

    return () => clearTimeout(timer);
  }, [load]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filtered = useMemo(
    () =>
      products.filter((product) =>
        product.title.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [products, normalizedQuery],
  );

  const availableCount = useMemo(
    () => products.filter((product) => product.is_available).length,
    [products],
  );

  const unavailableCount = products.length - availableCount;

  const openEditor = (productId?: string) => {
    router.push({
      pathname: "/merchant/product-editor",
      params: productId ? { id: productId } : {},
    } as Href);
  };

  const toggleAvailability = async (product: Product, nextValue: boolean) => {
    setBusyId(product.id);
    setError("");

    const { error: updateError } = await supabase
      .from("products")
      .update({
        is_available: nextValue,
      })
      .eq("id", product.id)
      .eq("store_id", store?.id ?? "");

    setBusyId("");

    if (updateError) {
      setError("تعذر تحديث حالة المنتج.");
      return;
    }

    const nextProducts = products.map((item) =>
      item.id === product.id
        ? {
            ...item,
            is_available: nextValue,
          }
        : item,
    );

    setProducts(nextProducts);

    if (cacheKey) {
      await writeLocalCache(cacheKey, {
        store,
        products: nextProducts,
        categories,
        media,
      } satisfies ProductsSnapshot);
    }
  };

  const deleteProduct = async () => {
    if (!selected || !store) return;

    setBusyId(selected.id);
    setError("");

    const productMedia = media.filter(
      (item) => item.product_id === selected.id,
    );

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", selected.id)
      .eq("store_id", store.id);

    if (deleteError) {
      setBusyId("");
      setError("تعذر حذف المنتج. ربما يرتبط بطلبات أو عروض سابقة.");
      return;
    }

    if (productMedia.length) {
      await supabase.storage
        .from("store-media")
        .remove(productMedia.map((item) => item.storage_path));
    }

    const nextProducts = products.filter(
      (product) => product.id !== selected.id,
    );

    const nextMedia = media.filter((item) => item.product_id !== selected.id);

    setProducts(nextProducts);
    setMedia(nextMedia);
    setSelected(null);
    setBusyId("");
    setNotice("تم حذف المنتج.");

    if (cacheKey) {
      await writeLocalCache(cacheKey, {
        store,
        products: nextProducts,
        categories,
        media: nextMedia,
      } satisfies ProductsSnapshot);
    }
  };

  if (loading && !cached) {
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
      {!embedded ? <AppHeader title="منتجات المتجر" mode="business" /> : null}

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <View style={styles.heading}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              منتجات المتجر
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {store?.name ?? "متجرك"} · {products.length} منتج
            </Text>
          </View>

          <Pressable
            onPress={() => openEditor()}
            style={[
              styles.addButton,
              {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <AppIcon name="add-outline" size={20} color={colors.surface} />

            <Text
              style={[
                styles.addButtonText,
                {
                  color: colors.surface,
                },
              ]}
            >
              إضافة منتج
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.stat}>
            <View
              style={[
                styles.statIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="checkmark-circle-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.statValue,
                {
                  color: colors.text,
                },
              ]}
            >
              {availableCount}
            </Text>

            <Text
              style={[
                styles.statLabel,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              متاح
            </Text>
          </View>

          <View
            style={[
              styles.statDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <View style={styles.stat}>
            <View
              style={[
                styles.statIcon,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <AppIcon
                name="pause-circle-outline"
                size={20}
                color={colors.textMuted}
              />
            </View>

            <Text
              style={[
                styles.statValue,
                {
                  color: colors.text,
                },
              ]}
            >
              {unavailableCount}
            </Text>

            <Text
              style={[
                styles.statLabel,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              غير متاح
            </Text>
          </View>

          <View
            style={[
              styles.statDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <View style={styles.stat}>
            <View
              style={[
                styles.statIcon,
                {
                  backgroundColor: colors.accentLight,
                },
              ]}
            >
              <AppIcon
                name="pricetag-outline"
                size={20}
                color={colors.accent}
              />
            </View>

            <Text
              style={[
                styles.statValue,
                {
                  color: colors.text,
                },
              ]}
            >
              {products.length}
            </Text>

            <Text
              style={[
                styles.statLabel,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              الإجمالي
            </Text>
          </View>
        </View>

        <View style={styles.searchSection}>
          <AppTextField
            label="البحث"
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث باسم المنتج"
          />
        </View>

        {error ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.border,
              },
            ]}
          >
            <AppIcon name="warning-outline" size={20} color={colors.error} />

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

        {!categories.length ? (
          <View
            style={[
              styles.infoCard,
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

            <Text
              style={[
                styles.infoText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              لا توجد تصنيفات جاهزة بعد. ستظهر التصنيفات التي تعتمدها إدارة
              المنصة هنا.
            </Text>
          </View>
        ) : null}

        {products.length > 0 && filtered.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
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
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <AppIcon
                name="search-outline"
                size={28}
                color={colors.textMuted}
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              لا توجد نتائج
            </Text>

            <Text
              style={[
                styles.emptyDescription,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              لم نجد منتجًا يطابق «{query.trim()}».
            </Text>

            <AppButton
              title="مسح البحث"
              variant="outline"
              fullWidth={false}
              onPress={() => setQuery("")}
            />
          </View>
        ) : null}

        {products.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
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
              <AppIcon
                name="pricetag-outline"
                size={30}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              ابدأ بإضافة منتجاتك
            </Text>

            <Text
              style={[
                styles.emptyDescription,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              أضف منتجات متجرك مع الأسعار والتفاصيل والصور لتظهر للعملاء.
            </Text>

            <AppButton
              title="إضافة أول منتج"
              icon="add-outline"
              onPress={() => openEditor()}
            />
          </View>
        ) : null}

        {filtered.map((product) => {
          const firstImage = media.find(
            (item) =>
              item.product_id === product.id && item.media_type === "image",
          );

          const category =
            categoryNames.get(product.category_id) ?? "بدون تصنيف";

          const price = Number(product.price).toLocaleString("ar-SY");

          return (
            <View
              key={product.id}
              style={[
                styles.productCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.productTop}>
                {firstImage ? (
                  <Image
                    source={{
                      uri: getStoreMediaUrl(firstImage.storage_path),
                    }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View
                    style={[
                      styles.thumbnail,
                      styles.placeholderImage,
                      {
                        backgroundColor: colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <AppIcon
                      name="image-outline"
                      size={26}
                      color={colors.textMuted}
                    />
                  </View>
                )}

                <View style={styles.productInfo}>
                  <View style={styles.productTitleRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: product.is_available
                            ? colors.primaryLight
                            : colors.surfaceSecondary,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: product.is_available
                              ? colors.success
                              : colors.textMuted,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: product.is_available
                              ? colors.success
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {product.is_available ? "متاح" : "متوقف"}
                      </Text>
                    </View>

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
                  </View>

                  <Text
                    style={[
                      styles.price,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    {price} {product.currency === "USD" ? "$" : "ل.س"}
                  </Text>

                  <Text
                    style={[
                      styles.meta,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    {category} · لكل {product.selling_unit}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor: colors.border,
                  },
                ]}
              />

              <Text
                style={[
                  styles.description,
                  {
                    color: colors.textSecondary,
                  },
                ]}
                numberOfLines={2}
              >
                {product.description || "لا يوجد وصف للمنتج."}
              </Text>

              <View
                style={[
                  styles.availabilityRow,
                  {
                    backgroundColor: colors.surfaceSecondary,
                  },
                ]}
              >
                <Switch
                  value={product.is_available}
                  onValueChange={(value) =>
                    void toggleAvailability(product, value)
                  }
                  disabled={busyId === product.id}
                  trackColor={{
                    false: colors.border,
                    true: colors.primaryLight,
                  }}
                  thumbColor={
                    product.is_available ? colors.primary : colors.surface
                  }
                />

                <View style={styles.availabilityText}>
                  <Text
                    style={[
                      styles.availabilityTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    {product.is_available
                      ? "المنتج متاح للطلب"
                      : "المنتج غير متاح حاليًا"}
                  </Text>

                  <Text
                    style={[
                      styles.availabilityHint,
                      {
                        color: colors.textMuted,
                      },
                    ]}
                  >
                    يمكنك تغيير الحالة بسرعة من هنا
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => openEditor(product.id)}
                  style={[
                    styles.secondaryAction,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <AppIcon
                    name="create-outline"
                    size={18}
                    color={colors.textSecondary}
                  />

                  <Text
                    style={[
                      styles.secondaryActionText,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    تعديل
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelected(product)}
                  style={[
                    styles.deleteAction,
                    {
                      backgroundColor: colors.surfaceSecondary,
                    },
                  ]}
                >
                  <AppIcon
                    name="trash-outline"
                    size={18}
                    color={colors.error}
                  />

                  <Text
                    style={[
                      styles.deleteActionText,
                      {
                        color: colors.error,
                      },
                    ]}
                  >
                    حذف
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {!embedded ? (
          <AppButton
            title="العودة لإدارة المتجر"
            variant="outline"
            onPress={() => router.replace("/merchant" as Href)}
          />
        ) : null}
      </ScrollView>

      <AppConfirmModal
        visible={Boolean(selected)}
        title="حذف المنتج؟"
        message={`سيتم حذف «${selected?.title ?? ""}» وصوره وفيديوهاته. إذا كان مرتبطًا بعرض محفوظ فحدّث العرض أولًا.`}
        confirmText="حذف المنتج"
        cancelText="إبقاء المنتج"
        destructive
        busy={Boolean(busyId)}
        onCancel={() => setSelected(null)}
        onConfirm={() => void deleteProduct()}
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

export default function MerchantProductsScreen() {
  return <MerchantProductsPanel />;
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
    padding: Spacing.five,
    paddingBottom: Spacing.ten,
    gap: Spacing.three,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },

  topSection: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },

  heading: {
    flex: 1,
    alignItems: "flex-end",
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  addButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },

  addButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  statsCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },

  stat: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.one,
  },

  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  statValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  statLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  statDivider: {
    width: 1,
    height: 54,
  },

  searchSection: {
    marginTop: Spacing.one,
  },

  errorCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  errorText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  infoCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  infoText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  productCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  productTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
  },

  placeholderImage: {
    alignItems: "center",
    justifyContent: "center",
  },

  productInfo: {
    flex: 1,
    gap: Spacing.one,
  },

  productTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  productTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 23,
    textAlign: "right",
  },

  statusBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },

  statusText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  price: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  meta: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  divider: {
    height: 1,
    width: "100%",
  },

  description: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  availabilityRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },

  availabilityText: {
    flex: 1,
    alignItems: "flex-end",
  },

  availabilityTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  availabilityHint: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 11,
    textAlign: "right",
  },

  actions: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
  },

  secondaryAction: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radius.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },

  secondaryActionText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  deleteAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },

  deleteActionText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.six,
    gap: Spacing.two,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },

  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 420,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "center",
  },
});

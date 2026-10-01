import { useRouter, type Href } from "expo-router";
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

type Offer = {
  id: string;
  title: string;
  description: string;
  offer_type: "discount" | "bundle" | "buy_x_get_y";
  discount_method: "percentage" | "fixed_amount" | null;
  discount_value: number | null;
  bundle_price: number | null;
  currency: "SYP" | "USD";
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
};

type OfferProduct = {
  offer_id: string;
  product_id: string;
  item_role: string;
  quantity: number;
};

type OffersSnapshot = {
  store: MerchantStore | null;
  offers: Offer[];
  items: OfferProduct[];
  productNames: Record<string, string>;
};

const labelFor: Record<Offer["offer_type"], string> = {
  discount: "تخفيض",
  bundle: "حزمة",
  buy_x_get_y: "اشترِ واحصل",
};

export function MerchantOffersPanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const cacheKey = user ? `merchant-offers:${user.id}` : "";

  const cached = cacheKey
    ? peekLocalCache<OffersSnapshot>(cacheKey)
    : undefined;

  const [store, setStore] = useState<MerchantStore | null>(
    cached?.store ?? null,
  );

  const [offers, setOffers] = useState<Offer[]>(cached?.offers ?? []);

  const [items, setItems] = useState<OfferProduct[]>(cached?.items ?? []);

  const [productNames, setProductNames] = useState(
    new Map<string, string>(Object.entries(cached?.productNames ?? {})),
  );

  const [loading, setLoading] = useState(!cached);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const key = `merchant-offers:${user.id}`;

      const saved =
        peekLocalCache<OffersSnapshot>(key) ??
        (await readLocalCache<OffersSnapshot>(key));

      if (saved) {
        setStore(saved.store);
        setOffers(saved.offers);
        setItems(saved.items);
        setProductNames(new Map(Object.entries(saved.productNames)));
        setLoading(false);
      }

      const ownStore = await getMerchantStore(user.id);

      setStore(ownStore);

      if (!ownStore) return;

      const [offerResult, productResult] = await Promise.all([
        supabase
          .from("store_offers")
          .select(
            "id,title,description,offer_type,discount_method,discount_value,bundle_price,currency,is_active,starts_at,ends_at",
          )
          .eq("store_id", ownStore.id)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("products")
          .select("id,title")
          .eq("store_id", ownStore.id),
      ]);

      if (offerResult.error || productResult.error) {
        throw offerResult.error ?? productResult.error;
      }

      const list = (offerResult.data ?? []) as Offer[];

      const names = Object.fromEntries(
        (productResult.data ?? []).map((product) => [
          product.id,
          product.title,
        ]),
      );

      let loadedItems: OfferProduct[] = [];

      if (list.length) {
        const { data: itemRows, error: itemError } = await supabase
          .from("store_offer_products")
          .select("offer_id,product_id,item_role,quantity")
          .in(
            "offer_id",
            list.map((offer) => offer.id),
          );

        if (itemError) {
          throw itemError;
        }

        loadedItems = (itemRows ?? []) as OfferProduct[];
      }

      setOffers(list);
      setProductNames(new Map(Object.entries(names)));
      setItems(loadedItems);

      await writeLocalCache(key, {
        store: ownStore,
        offers: list,
        items: loadedItems,
        productNames: names,
      } satisfies OffersSnapshot);
    } catch {
      setError("تعذر تحميل العروض. تأكد من تنفيذ ترحيل المنتجات والعروض.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);

    return () => clearTimeout(timer);
  }, [load]);

  const openEditor = (offerId?: string) => {
    router.push({
      pathname: "/merchant/offer-editor",
      params: offerId ? { id: offerId } : {},
    } as Href);
  };

  const deleteOffer = async () => {
    if (!selected) return;

    setBusy(true);

    const { data: mediaRows } = await supabase
      .from("store_offer_media")
      .select("storage_path")
      .eq("offer_id", selected.id);

    const { error: deleteError } = await supabase.rpc("delete_store_offer", {
      target_offer: selected.id,
    });

    setBusy(false);

    if (deleteError) {
      setError("تعذر حذف العرض.");
      return;
    }

    const paths = (mediaRows ?? []).map((row) => row.storage_path);

    if (paths.length) {
      await supabase.storage.from("store-media").remove(paths);
    }

    setOffers((previous) =>
      previous.filter((offer) => offer.id !== selected.id),
    );

    setItems((previous) =>
      previous.filter((item) => item.offer_id !== selected.id),
    );

    setSelected(null);
    setNotice("تم حذف العرض.");
  };

  const getOfferDetail = (offer: Offer, offerItems: OfferProduct[]) => {
    if (offer.offer_type === "discount") {
      if (offer.discount_method === "percentage") {
        return `${offer.discount_value}% تخفيض`;
      }

      return `${Number(offer.discount_value).toLocaleString("ar-SY")} ${
        offer.currency === "USD" ? "دولار" : "ل.س"
      } تخفيض`;
    }

    if (offer.offer_type === "bundle") {
      return `سعر الحزمة ${Number(offer.bundle_price).toLocaleString(
        "ar-SY",
      )} ${offer.currency === "USD" ? "دولار" : "ل.س"}`;
    }

    const buy = offerItems.find((item) => item.item_role === "buy");

    const reward = offerItems.find((item) => item.item_role === "reward");

    return `اشترِ ${buy?.quantity ?? "X"} واحصل على ${reward?.quantity ?? "Y"}`;
  };

  const getProductSummary = (offerItems: OfferProduct[]) =>
    offerItems
      .map(
        (item) =>
          `${item.quantity > 1 ? `${item.quantity} × ` : ""}${
            productNames.get(item.product_id) ?? "منتج"
          }`,
      )
      .join("، ");

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
      {!embedded ? <AppHeader title="عروض المتجر" mode="business" /> : null}

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View
            style={[
              styles.addButton,
              {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Pressable
              onPress={() => openEditor()}
              style={styles.addButtonPressable}
              accessibilityRole="button"
            >
              <AppIcon name="add-outline" size={18} color="#FFFFFF" />

              <Text style={styles.addButtonText}>إنشاء عرض</Text>
            </Pressable>
          </View>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>
              عروض المتجر
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {store?.name ?? ""} · {offers.length}{" "}
              {offers.length === 1 ? "عرض" : "عروض"}
            </Text>
          </View>
        </View>

        {error ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.error,
              },
            ]}
          >
            <AppIcon name="warning-outline" size={18} color={colors.error} />

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

        {!offers.length ? (
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
                name="pricetags-outline"
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
              لا توجد عروض حاليًا
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              أنشئ عرضًا يجذب الزبائن واختر بين التخفيض أو الحزمة أو اشترِ
              واحصل.
            </Text>

            <AppButton
              title="إنشاء أول عرض"
              icon="add-outline"
              onPress={() => openEditor()}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {offers.map((offer) => {
              const offerItems = items.filter(
                (item) => item.offer_id === offer.id,
              );

              const productSummary = getProductSummary(offerItems);

              const detail = getOfferDetail(offer, offerItems);

              return (
                <View
                  key={offer.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: offer.is_active
                            ? colors.primaryLight
                            : colors.surfaceSecondary,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: offer.is_active
                              ? colors.success
                              : colors.textMuted,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: offer.is_active
                              ? colors.success
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {offer.is_active ? "نشط" : "متوقف"}
                      </Text>
                    </View>

                    <View style={styles.offerIdentity}>
                      <Text
                        style={[
                          styles.cardTitle,
                          {
                            color: colors.text,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {offer.title}
                      </Text>

                      <View style={styles.offerMeta}>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor: colors.surfaceSecondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeText,
                              {
                                color: colors.primary,
                              },
                            ]}
                          >
                            {labelFor[offer.offer_type]}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.detail,
                            {
                              color: colors.primary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {detail}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.productsBox,
                      {
                        backgroundColor: colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <AppIcon
                      name="cube-outline"
                      size={17}
                      color={colors.textSecondary}
                    />

                    <Text
                      style={[
                        styles.productsText,
                        {
                          color: colors.textSecondary,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {productSummary || "لم يتم تحديد المنتجات"}
                    </Text>
                  </View>

                  {offer.description ? (
                    <Text
                      style={[
                        styles.description,
                        {
                          color: colors.textSecondary,
                        },
                      ]}
                      numberOfLines={3}
                    >
                      {offer.description}
                    </Text>
                  ) : null}

                  <View
                    style={[
                      styles.dateRow,
                      {
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.dateItem}>
                      <AppIcon
                        name="calendar-outline"
                        size={15}
                        color={colors.textMuted}
                      />

                      <Text
                        style={[
                          styles.dateText,
                          {
                            color: colors.textMuted,
                          },
                        ]}
                      >
                        يبدأ {formatDate(offer.starts_at)}
                      </Text>
                    </View>

                    {offer.ends_at ? (
                      <View style={styles.dateItem}>
                        <AppIcon
                          name="time-outline"
                          size={15}
                          color={colors.textMuted}
                        />

                        <Text
                          style={[
                            styles.dateText,
                            {
                              color: colors.textMuted,
                            },
                          ]}
                        >
                          ينتهي {formatDate(offer.ends_at)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.dateItem}>
                        <AppIcon
                          name="infinite-outline"
                          size={15}
                          color={colors.textMuted}
                        />

                        <Text
                          style={[
                            styles.dateText,
                            {
                              color: colors.textMuted,
                            },
                          ]}
                        >
                          بدون تاريخ انتهاء
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actions}>
                    <AppButton
                      title="تعديل"
                      icon="create-outline"
                      variant="outline"
                      fullWidth={false}
                      onPress={() => openEditor(offer.id)}
                    />

                    <AppButton
                      title="حذف"
                      icon="trash-outline"
                      variant="danger"
                      fullWidth={false}
                      onPress={() => setSelected(offer)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
        title="حذف العرض؟"
        message={`سيتم حذف «${selected?.title ?? ""}» من متجرك.`}
        confirmText="حذف العرض"
        cancelText="إبقاء العرض"
        destructive
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void deleteOffer()}
      />

      <AppModal
        visible={Boolean(notice)}
        title="تم التنفيذ"
        message={notice}
        onCancel={() => setNotice("")}
      />
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-SY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MerchantOffersScreen() {
  return <MerchantOffersPanel />;
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
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.ten,
    gap: Spacing.three,
  },

  pageHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  headerText: {
    flex: 1,
    alignItems: "flex-end",
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
    marginTop: Spacing.one,
  },

  addButton: {
    borderRadius: Radius.md,
    overflow: "hidden",
  },

  addButtonPressable: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  errorCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },

  errorText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  list: {
    gap: Spacing.three,
  },

  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },

  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  offerIdentity: {
    flex: 1,
    alignItems: "flex-end",
    gap: Spacing.two,
  },

  cardTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 22,
    textAlign: "right",
  },

  offerMeta: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  typeBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  typeText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  detail: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  statusBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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

  productsBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  productsText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  description: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  dateRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.three,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },

  dateItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
  },

  dateText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    textAlign: "right",
  },

  actions: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
  },

  emptyCard: {
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },

  emptyText: {
    maxWidth: 420,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
    textAlign: "center",
  },
});

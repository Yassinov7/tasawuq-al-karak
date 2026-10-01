import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getMerchantStore, type MerchantStore } from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";

type OfferType = "discount" | "bundle" | "buy_x_get_y";

type Product = {
  id: string;
  title: string;
  price: number;
  currency: "SYP" | "USD";
  selling_unit: string;
};

type Offer = {
  id: string;
  title: string;
  description: string;
  offer_type: OfferType;
  discount_method: "percentage" | "fixed_amount" | null;
  discount_value: number | null;
  bundle_price: number | null;
  currency: "SYP" | "USD";
  is_active: boolean;
};

type OfferItem = {
  product_id: string;
  item_role: "discounted" | "bundle" | "buy" | "reward";
  quantity: number;
};

const offerTypes: Array<{
  id: OfferType;
  title: string;
  description: string;
  icon: "pricetag-outline" | "cube-outline" | "gift-outline";
}> = [
  {
    id: "discount",
    title: "تخفيض",
    description: "خصم بنسبة مئوية أو مبلغ ثابت على منتجات تختارها.",
    icon: "pricetag-outline",
  },
  {
    id: "bundle",
    title: "حزمة",
    description: "اجمع عدة منتجات وحدد سعرًا خاصًا للحزمة.",
    icon: "cube-outline",
  },
  {
    id: "buy_x_get_y",
    title: "اشترِ X واحصل على Y",
    description: "حدد المنتج والكمية المطلوبة والمكافأة.",
    icon: "gift-outline",
  },
];

export default function MerchantOfferEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const offerId = Array.isArray(id) ? id[0] : id;

  const { user } = useAuth();
  const { colors } = useTheme();

  const [store, setStore] = useState<MerchantStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<OfferType>("discount");

  const [discountMethod, setDiscountMethod] = useState<
    "percentage" | "fixed_amount"
  >("percentage");

  const [discountValue, setDiscountValue] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");

  const [currency, setCurrency] = useState<"SYP" | "USD">("SYP");

  const [active, setActive] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, string>
  >({});

  const [buyProduct, setBuyProduct] = useState("");
  const [rewardProduct, setRewardProduct] = useState("");

  const [buyQuantity, setBuyQuantity] = useState("1");
  const [rewardQuantity, setRewardQuantity] = useState("1");

  const load = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");

      const ownStore = await getMerchantStore(user.id);

      if (!ownStore) {
        router.replace("/application-status" as Href);
        return;
      }

      setStore(ownStore);

      const { data: productRows, error: productError } = await supabase
        .from("products")
        .select("id,title,price,currency,selling_unit")
        .eq("store_id", ownStore.id)
        .eq("is_available", true)
        .order("title");

      if (productError) {
        throw productError;
      }

      const availableProducts = (productRows ?? []) as Product[];

      setProducts(availableProducts);

      if (offerId) {
        const [offerResult, itemsResult] = await Promise.all([
          supabase
            .from("store_offers")
            .select(
              "id,title,description,offer_type,discount_method,discount_value,bundle_price,currency,is_active",
            )
            .eq("id", offerId)
            .eq("store_id", ownStore.id)
            .maybeSingle(),

          supabase
            .from("store_offer_products")
            .select("product_id,item_role,quantity")
            .eq("offer_id", offerId),
        ]);

        if (offerResult.error || itemsResult.error || !offerResult.data) {
          throw (
            offerResult.error ??
            itemsResult.error ??
            new Error("offer not found")
          );
        }

        const offer = offerResult.data as Offer;

        const offerItems = (itemsResult.data ?? []) as OfferItem[];

        setTitle(offer.title);
        setDescription(offer.description);
        setType(offer.offer_type);
        setDiscountMethod(offer.discount_method ?? "percentage");
        setDiscountValue(
          offer.discount_value == null ? "" : String(offer.discount_value),
        );
        setBundlePrice(
          offer.bundle_price == null ? "" : String(offer.bundle_price),
        );
        setCurrency(offer.currency);
        setActive(offer.is_active);

        if (offer.offer_type === "buy_x_get_y") {
          setBuyProduct(
            offerItems.find((item) => item.item_role === "buy")?.product_id ??
              "",
          );

          setRewardProduct(
            offerItems.find((item) => item.item_role === "reward")
              ?.product_id ?? "",
          );

          setBuyQuantity(
            String(
              offerItems.find((item) => item.item_role === "buy")?.quantity ??
                1,
            ),
          );

          setRewardQuantity(
            String(
              offerItems.find((item) => item.item_role === "reward")
                ?.quantity ?? 1,
            ),
          );
        } else {
          setSelectedQuantities(
            Object.fromEntries(
              offerItems.map((item) => [
                item.product_id,
                String(item.quantity),
              ]),
            ),
          );
        }
      }
    } catch {
      setError("تعذر تحميل بيانات العرض أو منتجات متجرك.");
    } finally {
      setLoading(false);
    }
  }, [user, offerId, router]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);

    return () => clearTimeout(timer);
  }, [load]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) =>
      product.title.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [products, search]);

  const selectedCount = Object.keys(selectedQuantities).length;

  const selectedBuyProduct = products.find(
    (product) => product.id === buyProduct,
  );

  const selectedRewardProduct = products.find(
    (product) => product.id === rewardProduct,
  );

  const setProductSelected = (productId: string, selected: boolean) => {
    setSelectedQuantities((previous) => {
      const next = {
        ...previous,
      };

      if (selected) {
        next[productId] = next[productId] ?? "1";
      } else {
        delete next[productId];
      }

      return next;
    });
  };

  const save = async () => {
    if (!store) return;

    setError("");

    if (title.trim().length < 2) {
      setError("أدخل عنوانًا واضحًا للعرض.");
      return;
    }

    let items: OfferItem[] = [];

    const positiveQty = (value: string) => {
      const number = Number(value.replace(",", "."));

      return Number.isFinite(number) && number > 0;
    };

    if (type === "discount") {
      const discount = Number(discountValue.replace(",", "."));

      if (
        !Number.isFinite(discount) ||
        discount <= 0 ||
        (discountMethod === "percentage" && discount > 100)
      ) {
        setError("أدخل خصمًا صحيحًا. النسبة يجب ألا تتجاوز 100٪.");
        return;
      }

      items = Object.keys(selectedQuantities).map((product_id) => ({
        product_id,
        item_role: "discounted",
        quantity: 1,
      }));
    } else if (type === "bundle") {
      const total = Number(bundlePrice.replace(",", "."));

      if (!Number.isFinite(total) || total <= 0) {
        setError("أدخل سعرًا صحيحًا للحزمة.");
        return;
      }

      if (
        Object.values(selectedQuantities).some(
          (quantity) => !positiveQty(quantity),
        )
      ) {
        setError("تحقق من كميات منتجات الحزمة.");
        return;
      }

      items = Object.entries(selectedQuantities).map(
        ([product_id, quantity]) => ({
          product_id,
          item_role: "bundle",
          quantity: Number(quantity.replace(",", ".")),
        }),
      );
    } else {
      if (
        !buyProduct ||
        !rewardProduct ||
        !positiveQty(buyQuantity) ||
        !positiveQty(rewardQuantity)
      ) {
        setError("اختر منتج الشراء والمكافأة وأدخل الكميتين.");
        return;
      }

      items = [
        {
          product_id: buyProduct,
          item_role: "buy",
          quantity: Number(buyQuantity.replace(",", ".")),
        },
        {
          product_id: rewardProduct,
          item_role: "reward",
          quantity: Number(rewardQuantity.replace(",", ".")),
        },
      ];
    }

    if (!items.length) {
      setError("اختر منتجًا واحدًا على الأقل ليشمله العرض.");
      return;
    }

    if (type !== "buy_x_get_y") {
      const chosen = items
        .map((item) =>
          products.find((product) => product.id === item.product_id),
        )
        .filter((item): item is Product => Boolean(item));

      if (chosen.some((product) => product.currency !== currency)) {
        setError("عملة العرض يجب أن تطابق عملة كل المنتجات المختارة.");
        return;
      }
    }

    setBusy(true);

    const { error: saveError } = await supabase.rpc("save_store_offer", {
      selected_offer: offerId ?? null,
      input_title: title.trim(),
      input_description: description.trim(),
      input_type: type,
      input_discount_method: type === "discount" ? discountMethod : null,
      input_discount_value:
        type === "discount" ? Number(discountValue.replace(",", ".")) : null,
      input_bundle_price:
        type === "bundle" ? Number(bundlePrice.replace(",", ".")) : null,
      input_currency: currency,
      input_ends_at: null,
      input_is_active: active,
      input_items: items,
    });

    setBusy(false);

    if (saveError) {
      setError(
        saveError.message.includes("product")
          ? "تحقق من المنتجات المختارة، يجب أن تكون من متجرك ومتاحة للبيع."
          : "تعذر حفظ العرض. تأكد من تطبيق ترحيل العروض ثم أعد المحاولة.",
      );
      return;
    }

    router.replace({
      pathname: "/merchant/catalog",
      params: {
        tab: "offers",
      },
    } as Href);
  };

  if (loading) {
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
    <KeyboardAvoidingView
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AppHeader
        title={offerId ? "تعديل العرض" : "إنشاء عرض"}
        mode="business"
        showBack
      />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageIntro}>
          <View
            style={[
              styles.introIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon
              name={offerId ? "create-outline" : "pricetags-outline"}
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.introText}>
            <Text
              style={[
                styles.pageTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              {offerId ? "تعديل تفاصيل العرض" : "أنشئ عرضًا جديدًا"}
            </Text>

            <Text
              style={[
                styles.pageSubtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {store?.name ?? ""}
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
            <AppIcon name="warning-outline" size={19} color={colors.error} />

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

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader
            icon="information-circle-outline"
            title="معلومات العرض"
            colors={colors}
          />

          <AppTextField
            label="عنوان العرض"
            value={title}
            onChangeText={setTitle}
            placeholder="مثال: وفر على مشترياتك"
            maxLength={140}
          />

          <AppTextField
            label="وصف العرض"
            value={description}
            onChangeText={setDescription}
            placeholder="الشروط والتفاصيل التي تظهر للزبون"
            multiline
            maxLength={5000}
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
          <SectionHeader
            icon="pricetags-outline"
            title="نوع العرض"
            colors={colors}
          />

          <View style={styles.typeList}>
            {offerTypes.map((offerType) => {
              const selected = type === offerType.id;

              return (
                <Pressable
                  key={offerType.id}
                  onPress={() => {
                    setType(offerType.id);
                    setError("");
                  }}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor: selected
                        ? colors.primaryLight
                        : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      {
                        backgroundColor: selected
                          ? colors.surface
                          : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <AppIcon
                      name={offerType.icon}
                      size={19}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                  </View>

                  <View style={styles.typeContent}>
                    <View style={styles.typeTitleRow}>
                      <Text
                        style={[
                          styles.typeTitle,
                          {
                            color: colors.text,
                          },
                        ]}
                      >
                        {offerType.title}
                      </Text>

                      <AppIcon
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={19}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                    </View>

                    <Text
                      style={[
                        styles.typeDescription,
                        {
                          color: colors.textSecondary,
                        },
                      ]}
                    >
                      {offerType.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {type === "discount" ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <SectionHeader
              icon="remove-circle-outline"
              title="تفاصيل التخفيض"
              colors={colors}
            />

            <Text
              style={[
                styles.label,
                {
                  color: colors.text,
                },
              ]}
            >
              طريقة التخفيض
            </Text>

            <View style={styles.optionRow}>
              <SelectButton
                selected={discountMethod === "percentage"}
                label="نسبة مئوية"
                onPress={() => setDiscountMethod("percentage")}
              />

              <SelectButton
                selected={discountMethod === "fixed_amount"}
                label="مبلغ ثابت"
                onPress={() => setDiscountMethod("fixed_amount")}
              />
            </View>

            <AppTextField
              label={
                discountMethod === "percentage"
                  ? "نسبة التخفيض ٪"
                  : "قيمة التخفيض"
              }
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder={discountMethod === "percentage" ? "10" : "0"}
            />

            {discountMethod === "fixed_amount" ? (
              <CurrencySelect currency={currency} setCurrency={setCurrency} />
            ) : null}
          </View>
        ) : null}

        {type === "bundle" ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <SectionHeader
              icon="cube-outline"
              title="تفاصيل الحزمة"
              colors={colors}
            />

            <AppTextField
              label="سعر الحزمة"
              value={bundlePrice}
              onChangeText={setBundlePrice}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            <CurrencySelect currency={currency} setCurrency={setCurrency} />
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader
            icon="cube-outline"
            title={
              type === "buy_x_get_y"
                ? "منتجات العرض"
                : type === "bundle"
                  ? "مكونات الحزمة"
                  : "المنتجات المشمولة"
            }
            colors={colors}
          />

          <AppTextField
            label="البحث في منتجاتك"
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث باسم المنتج"
          />

          {products.length ? (
            <View style={styles.resultSummary}>
              <Text
                style={[
                  styles.resultText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {filteredProducts.length} منتج متاح
              </Text>

              {type !== "buy_x_get_y" && selectedCount > 0 ? (
                <Text
                  style={[
                    styles.resultSelected,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  تم اختيار {selectedCount}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!products.length ? (
            <View
              style={[
                styles.emptyProducts,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <AppIcon name="cube-outline" size={26} color={colors.textMuted} />

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                لا توجد منتجات متاحة
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                أضف منتجات واجعلها متاحة للبيع قبل إعداد العرض.
              </Text>
            </View>
          ) : null}

          {products.length && !filteredProducts.length ? (
            <View
              style={[
                styles.emptyProducts,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <AppIcon
                name="search-outline"
                size={25}
                color={colors.textMuted}
              />

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
                  styles.emptyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                جرّب البحث باسم منتج مختلف.
              </Text>
            </View>
          ) : null}

          {type === "buy_x_get_y" ? (
            <>
              <RoleHeader
                title="منتج الشراء"
                subtitle="المنتج الذي يجب على الزبون شراؤه"
                color={colors.primary}
                colors={colors}
              />

              {filteredProducts.map((product) => (
                <ProductChoice
                  key={`buy-${product.id}`}
                  product={product}
                  selected={buyProduct === product.id}
                  onPress={() => setBuyProduct(product.id)}
                />
              ))}

              {buyProduct ? (
                <AppTextField
                  label={`كمية الشراء (${
                    selectedBuyProduct?.selling_unit ?? "وحدة"
                  })`}
                  value={buyQuantity}
                  onChangeText={setBuyQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
              ) : null}

              <RoleHeader
                title="منتج المكافأة"
                subtitle="المنتج الذي يحصل عليه الزبون"
                color={colors.accent}
                colors={colors}
              />

              {filteredProducts.map((product) => (
                <ProductChoice
                  key={`reward-${product.id}`}
                  product={product}
                  selected={rewardProduct === product.id}
                  onPress={() => setRewardProduct(product.id)}
                />
              ))}

              {rewardProduct ? (
                <AppTextField
                  label={`كمية المكافأة (${
                    selectedRewardProduct?.selling_unit ?? "وحدة"
                  })`}
                  value={rewardQuantity}
                  onChangeText={setRewardQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
              ) : null}
            </>
          ) : (
            filteredProducts.map((product) => {
              const selected = product.id in selectedQuantities;

              return (
                <View
                  key={product.id}
                  style={[
                    styles.productRow,
                    {
                      backgroundColor: selected
                        ? colors.primaryLight
                        : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Pressable
                    style={styles.productSelect}
                    onPress={() => setProductSelected(product.id, !selected)}
                  >
                    <AppIcon
                      name={selected ? "checkbox" : "square-outline"}
                      size={21}
                      color={selected ? colors.primary : colors.textMuted}
                    />

                    <View style={styles.productInfo}>
                      <Text
                        style={[
                          styles.productName,
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
                          styles.productMeta,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {Number(product.price).toLocaleString("ar-SY")}{" "}
                        {product.currency === "USD" ? "$" : "ل.س"} · لكل{" "}
                        {product.selling_unit}
                      </Text>
                    </View>
                  </Pressable>

                  {selected && type === "bundle" ? (
                    <View style={styles.quantity}>
                      <AppTextField
                        label="الكمية"
                        value={selectedQuantities[product.id]}
                        onChangeText={(value) =>
                          setSelectedQuantities((previous) => ({
                            ...previous,
                            [product.id]: value,
                          }))
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
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
          <SectionHeader
            icon="radio-button-on"
            title="حالة العرض"
            colors={colors}
          />

          <View
            style={[
              styles.activeCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.activeText}>
              <Text
                style={[
                  styles.activeTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {active ? "العرض مفعّل" : "العرض متوقف"}
              </Text>

              <Text
                style={[
                  styles.note,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                يمكنك إيقافه أو تفعيله لاحقًا.
              </Text>
            </View>

            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight,
              }}
              thumbColor={active ? colors.primary : colors.surface}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title={
              busy
                ? "جارٍ حفظ العرض…"
                : offerId
                  ? "حفظ التعديلات"
                  : "إنشاء العرض"
            }
            icon="checkmark-outline"
            onPress={() => void save()}
            loading={busy}
            disabled={busy || products.length === 0}
          />

          <AppButton
            title="إلغاء"
            variant="outline"
            onPress={() => router.back()}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({
  icon,
  title,
  colors,
}: {
  icon:
    | "information-circle-outline"
    | "pricetags-outline"
    | "remove-circle-outline"
    | "cube-outline"
    | "radio-button-on";
  title: string;
  colors: {
    primary: string;
    primaryLight: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    surface: string;
    surfaceSecondary: string;
    border: string;
    error: string;
    success: string;
    accent: string;
  };
}) {
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={18} color={colors.primary} />
      </View>

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
    </View>
  );
}

function RoleHeader({
  title,
  subtitle,
  color,
  colors,
}: {
  title: string;
  subtitle: string;
  color: string;
  colors: {
    text: string;
    textSecondary: string;
  };
}) {
  return (
    <View style={styles.roleHeader}>
      <View
        style={[
          styles.roleLine,
          {
            backgroundColor: color,
          },
        ]}
      />

      <View style={styles.roleText}>
        <Text
          style={[
            styles.roleTitle,
            {
              color,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.roleSubtitle,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function SelectButton({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.selectButton,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
        },
      ]}
    >
      <Text
        style={[
          styles.selectText,
          {
            color: selected ? colors.primary : colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CurrencySelect({
  currency,
  setCurrency,
}: {
  currency: "SYP" | "USD";
  setCurrency: (currency: "SYP" | "USD") => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.currencySection}>
      <Text
        style={[
          styles.label,
          {
            color: colors.text,
          },
        ]}
      >
        عملة العرض
      </Text>

      <View style={styles.optionRow}>
        <SelectButton
          selected={currency === "SYP"}
          label="ليرة سورية"
          onPress={() => setCurrency("SYP")}
        />

        <SelectButton
          selected={currency === "USD"}
          label="دولار"
          onPress={() => setCurrency("USD")}
        />
      </View>
    </View>
  );
}

function ProductChoice({
  product,
  selected,
  onPress,
}: {
  product: Product;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.productRow,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
        },
      ]}
    >
      <AppIcon
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={21}
        color={selected ? colors.primary : colors.textMuted}
      />

      <View style={styles.productInfo}>
        <Text
          style={[
            styles.productName,
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
            styles.productMeta,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          لكل {product.selling_unit}
        </Text>
      </View>
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
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.ten,
    gap: Spacing.three,
  },

  pageIntro: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  introIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  introText: {
    flex: 1,
    alignItems: "flex-end",
  },

  pageTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  pageSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
    marginTop: 3,
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

  sectionCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  typeList: {
    gap: Spacing.two,
  },

  typeCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  typeContent: {
    flex: 1,
    gap: Spacing.one,
  },

  typeTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  typeTitle: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  typeDescription: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  label: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },

  optionRow: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
  },

  selectButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: Spacing.two,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  selectText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  currencySection: {
    marginTop: Spacing.one,
  },

  resultSummary: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.one,
  },

  resultText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  resultSelected: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  roleHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },

  roleLine: {
    width: 3,
    height: 36,
    borderRadius: Radius.full,
  },

  roleText: {
    flex: 1,
    alignItems: "flex-end",
  },

  roleTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  roleSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 2,
  },

  productRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  productSelect: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    minHeight: 48,
  },

  productInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  productName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  productMeta: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 2,
  },

  quantity: {
    width: 112,
  },

  activeCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  activeText: {
    flex: 1,
    alignItems: "flex-end",
  },

  activeTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  note: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
    marginTop: 2,
  },

  emptyProducts: {
    minHeight: 150,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    gap: Spacing.one,
  },

  emptyTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  emptyText: {
    maxWidth: 360,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "center",
  },

  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});

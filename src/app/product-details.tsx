import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ProductCard } from "@/components/marketplace/ProductCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { categories, products, stores } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useTheme } from "@/context/ThemeContext";

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const { itemCount, addItem, getQuantity } = useCart();

  const { isFavorite, toggleFavorite } = useFavorites();

  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [quantity, setQuantity] = useState(1);

  const product = useMemo(() => products.find((item) => item.id === id), [id]);

  const category = useMemo(
    () => categories.find((item) => item.id === product?.categoryId),
    [product?.categoryId],
  );

  const store = useMemo(
    () => stores.find((item) => item.id === product?.storeId),
    [product?.storeId],
  );

  const relatedProducts = useMemo(() => {
    if (!product) {
      return [];
    }

    return products
      .filter(
        (item) =>
          item.id !== product.id &&
          item.storeId === product.storeId &&
          item.categoryId === product.categoryId &&
          item.available,
      )
      .slice(0, 4);
  }, [product]);

  const cartQuantity = product ? getQuantity(product.id) : 0;

  const favorite = product ? isFavorite(product.id) : false;

  if (!product) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <AppHeader title="المنتج" showBack cartCount={itemCount} />

        <View style={styles.notFound}>
          <View
            style={[
              styles.notFoundIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon name="cube-outline" size={42} color={colors.primary} />
          </View>

          <Text
            style={[
              styles.notFoundTitle,
              {
                color: colors.text,
              },
            ]}
          >
            المنتج غير موجود
          </Text>

          <Text
            style={[
              styles.notFoundText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            يبدو أن هذا المنتج لم يعد متاحاً.
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="العودة"
          >
            <Text
              style={[
                styles.backButtonText,
                {
                  color: colors.surface,
                },
              ]}
            >
              العودة
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const totalPrice = product.price * quantity;

  const handleIncrease = () => {
    setQuantity((current) => current + 1);
  };

  const handleDecrease = () => {
    setQuantity((current) => (current > 1 ? current - 1 : 1));
  };

  const handleAddToCart = () => {
    if (!product.available) {
      return;
    }

    addItem(product, quantity);
  };

  const handleGoToCart = () => {
    router.push("/cart");
  };

  const handleToggleFavorite = () => {
    toggleFavorite(product.id);
  };

  const handleStorePress = () => {
    router.push({
      pathname: "/store-details",
      params: {
        id: product.storeId,
      },
    } as Href);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="تفاصيل المنتج" showBack cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.productImage,
            {
              backgroundColor: product.offer
                ? colors.accentLight
                : colors.primaryLight,
            },
          ]}
        >
          <AppIcon
            name={category?.icon ?? "cube-outline"}
            size={78}
            color={colors.primary}
          />

          <Pressable
            onPress={handleToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"
            }
            accessibilityState={{
              selected: favorite,
            }}
            style={({ pressed }) => [
              styles.favoriteButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon
              name={favorite ? "heart" : "heart-outline"}
              size={23}
              color={favorite ? colors.error : colors.textSecondary}
            />
          </Pressable>

          {product.offer ? (
            <View
              style={[
                styles.offerBadge,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.offerBadgeText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                عرض
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.productInfo}>
          <View style={styles.categoryRow}>
            {category ? (
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <AppIcon
                  name={category.icon}
                  size={14}
                  color={colors.primary}
                />

                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {category.name}
                </Text>
              </View>
            ) : null}

            {product.popular ? (
              <View
                style={[
                  styles.popularBadge,
                  {
                    backgroundColor: colors.accentLight,
                  },
                ]}
              >
                <AppIcon
                  name="trending-up-outline"
                  size={14}
                  color={colors.accent}
                />

                <Text
                  style={[
                    styles.popularText,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  الأكثر طلباً
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.productName,
              {
                color: colors.text,
              },
            ]}
          >
            {product.name}
          </Text>

          <Text
            style={[
              styles.description,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {product.description}
          </Text>

          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <Text
                style={[
                  styles.price,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                {product.price.toLocaleString("en-US")}
              </Text>

              <Text
                style={[
                  styles.currency,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                ل.س
              </Text>
            </View>

            <Text
              style={[
                styles.unit,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              {product.unit}
            </Text>
          </View>

          {store ? (
            <Pressable
              onPress={handleStorePress}
              accessibilityRole="button"
              accessibilityLabel={`فتح متجر ${store.name}`}
              style={({ pressed }) => [
                styles.storeRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.storeIcon,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <AppIcon
                  name="storefront-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>

              <View style={styles.storeInfo}>
                <Text
                  style={[
                    styles.storeLabel,
                    {
                      color: colors.textMuted,
                    },
                  ]}
                >
                  المتجر
                </Text>

                <Text
                  style={[
                    styles.storeName,
                    {
                      color: colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {store.name}
                </Text>
              </View>

              <AppIcon name="chevron-back" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.divider,
            {
              backgroundColor: colors.border,
            },
          ]}
        />

        <View
          style={[
            styles.infoCard,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <InfoRow icon="cube-outline" title="الوحدة" value={product.unit} />

          <InfoRow
            icon="checkmark-circle-outline"
            title="التوفر"
            value={product.available ? "متوفر حالياً" : "غير متوفر حالياً"}
            valueColor={product.available ? colors.success : colors.error}
          />

          {category ? (
            <InfoRow
              icon={category.icon}
              title="التصنيف"
              value={category.name}
            />
          ) : null}
        </View>

        {product.available ? (
          <>
            <View style={styles.quantitySection}>
              <Text
                style={[
                  styles.quantityTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الكمية
              </Text>

              <View
                style={[
                  styles.quantityControl,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Pressable
                  onPress={handleDecrease}
                  accessibilityRole="button"
                  accessibilityLabel="تقليل الكمية"
                  style={({ pressed }) => [
                    styles.quantityButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon name="remove" size={19} color={colors.primary} />
                </Pressable>

                <Text
                  style={[
                    styles.quantityValue,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  {quantity}
                </Text>

                <Pressable
                  onPress={handleIncrease}
                  accessibilityRole="button"
                  accessibilityLabel="زيادة الكمية"
                  style={({ pressed }) => [
                    styles.quantityButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon name="add" size={19} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.totalCard,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <View>
                <Text
                  style={[
                    styles.totalLabel,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  الإجمالي
                </Text>

                <Text
                  style={[
                    styles.totalHint,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {quantity} × {product.price.toLocaleString("en-US")} ل.س
                </Text>
              </View>

              <View style={styles.totalPrice}>
                <Text
                  style={[
                    styles.totalAmount,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {totalPrice.toLocaleString("en-US")}
                </Text>

                <Text
                  style={[
                    styles.totalCurrency,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  ل.س
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleAddToCart}
              accessibilityRole="button"
              accessibilityLabel="إضافة المنتج إلى السلة"
              style={({ pressed }) => [
                styles.addButton,
                {
                  backgroundColor:
                    cartQuantity > 0 ? colors.success : colors.primary,
                },
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name={
                  cartQuantity > 0 ? "checkmark-circle-outline" : "cart-outline"
                }
                size={22}
                color={colors.surface}
              />

              <Text
                style={[
                  styles.addButtonText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                {cartQuantity > 0 ? "تمت الإضافة للسلة" : "إضافة إلى السلة"}
              </Text>
            </Pressable>

            {cartQuantity > 0 ? (
              <Pressable
                onPress={handleGoToCart}
                accessibilityRole="button"
                accessibilityLabel="الانتقال إلى السلة"
                style={({ pressed }) => [
                  styles.cartButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.surface,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.cartButtonText,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  الانتقال إلى السلة
                </Text>

                <AppIcon name="arrow-back" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </>
        ) : (
          <View
            style={[
              styles.unavailableCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <AppIcon
              name="alert-circle-outline"
              size={25}
              color={colors.error}
            />

            <View style={styles.unavailableInfo}>
              <Text
                style={[
                  styles.unavailableTitle,
                  {
                    color: colors.error,
                  },
                ]}
              >
                المنتج غير متوفر حالياً
              </Text>

              <Text
                style={[
                  styles.unavailableText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                يمكنك العودة للمتجر ومشاهدة منتجات أخرى.
              </Text>
            </View>
          </View>
        )}

        {relatedProducts.length > 0 ? (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  منتجات مشابهة
                </Text>

                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color: colors.textMuted,
                    },
                  ]}
                >
                  قد تناسب طلبك
                </Text>
              </View>

              <AppIcon
                name="sparkles-outline"
                size={19}
                color={colors.primary}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
            >
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  onPress={() =>
                    router.push({
                      pathname: "/product-details",
                      params: {
                        id: relatedProduct.id,
                      },
                    })
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  value: string;
  valueColor?: string;
};

function InfoRow({ icon, title, value, valueColor }: InfoRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.infoRow}>
      <View
        style={[
          styles.infoIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={18} color={colors.primary} />
      </View>

      <Text
        style={[
          styles.infoTitle,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.infoValue,
          {
            color: valueColor ?? colors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },

  productImage: {
    height: 270,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xl,
    position: "relative",
  },

  favoriteButton: {
    position: "absolute",
    top: Spacing.three,
    left: Spacing.three,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  offerBadge: {
    position: "absolute",
    top: Spacing.three,
    right: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  offerBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  productInfo: {
    marginTop: Spacing.five,
  },

  categoryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  categoryBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  categoryText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  popularBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  popularText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  productName: {
    marginTop: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 35,
    textAlign: "right",
  },

  description: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "right",
  },

  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: Spacing.four,
  },

  priceContainer: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  price: {
    fontFamily: Fonts.bold,
    fontSize: 26,
  },

  currency: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  unit: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  storeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  storeIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  storeInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  storeLabel: {
    fontFamily: Fonts.regular,
    fontSize: 10,
  },

  storeName: {
    marginTop: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  divider: {
    height: 1,
    marginVertical: Spacing.five,
  },

  infoCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 48,
    gap: Spacing.two,
  },

  infoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  infoTitle: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  infoValue: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  quantitySection: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.five,
  },

  quantityTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  quantityButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityValue: {
    minWidth: 34,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "center",
  },

  totalCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.xl,
  },

  totalLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  totalHint: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },

  totalPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 3,
  },

  totalAmount: {
    fontFamily: Fonts.bold,
    fontSize: 22,
  },

  totalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },

  addButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 54,
    marginTop: Spacing.four,
    borderRadius: Radius.lg,
  },

  addButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  cartButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 48,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  cartButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  unavailableCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  unavailableInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  unavailableTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  unavailableText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  relatedSection: {
    marginTop: Spacing.seven,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },

  relatedList: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },

  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
  },

  notFoundIcon: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  notFoundTitle: {
    marginTop: Spacing.four,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "center",
  },

  notFoundText: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  backButton: {
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Radius.full,
  },

  backButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.72,
  },
});

import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { products, stores } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

const PLATFORM_DELIVERY_ENABLED = false;

type DeleteModal =
  | {
      type: "item";
      productId: string;
      productName: string;
    }
  | {
      type: "clear";
    }
  | null;

export default function CartScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const {
    items,
    itemCount,
    subtotal,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
  } = useCart();

  const [deleteModal, setDeleteModal] = useState<DeleteModal>(null);

  const cartProducts = items
    .map((item) => {
      const product = products.find(
        (productItem) => productItem.id === item.productId,
      );

      if (!product) {
        return null;
      }

      return {
        item,
        product,
      };
    })
    .filter(
      (
        value,
      ): value is {
        item: (typeof items)[number];
        product: (typeof products)[number];
      } => Boolean(value),
    );

  const storeIds = Array.from(
    new Set(cartProducts.map(({ product }) => product.storeId)),
  );

  const storeCount = storeIds.length;
  const isSharedCart = storeCount > 1;

  const deliveryFee =
    cartProducts.length > 0 && PLATFORM_DELIVERY_ENABLED ? 15000 : 0;

  const total = subtotal + deliveryFee;

  const deliveryLabel = PLATFORM_DELIVERY_ENABLED
    ? `${deliveryFee.toLocaleString("en-US")} ل.س`
    : "يحدد عند إتمام الطلب";

  const handleClearCart = () => {
    if (cartProducts.length === 0) {
      return;
    }

    setDeleteModal({
      type: "clear",
    });
  };

  const handleRemoveItem = (productId: string, productName: string) => {
    setDeleteModal({
      type: "item",
      productId,
      productName,
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteModal) {
      return;
    }

    if (deleteModal.type === "clear") {
      clearCart();
    } else {
      removeItem(deleteModal.productId);
    }

    setDeleteModal(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModal(null);
  };

  const modalTitle =
    deleteModal?.type === "clear" ? "تفريغ السلة" : "حذف المنتج";

  const modalMessage =
    deleteModal?.type === "clear"
      ? "هل تريد حذف جميع المنتجات من السلة؟"
      : `هل تريد حذف ${deleteModal?.productName ?? "هذا المنتج"} من السلة؟`;

  const modalConfirmText =
    deleteModal?.type === "clear" ? "تفريغ السلة" : "حذف";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="السلة" showBack cartCount={itemCount} />

      {cartProducts.length === 0 ? (
        <EmptyCart onContinue={() => router.replace("/home")} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.summaryHeader}>
            <View>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.text,
                  },
                ]}
              >
                سلة مشترياتك
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                {itemCount} قطعة • {storeCount}{" "}
                {storeCount === 1 ? "متجر" : "متاجر"}
              </Text>
            </View>

            <Pressable
              onPress={handleClearCart}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="تفريغ السلة"
            >
              <AppIcon name="trash-outline" size={17} color={colors.error} />

              <Text
                style={[
                  styles.clearText,
                  {
                    color: colors.error,
                  },
                ]}
              >
                تفريغ السلة
              </Text>
            </Pressable>
          </View>

          <CartTypeCard
            isSharedCart={isSharedCart}
            storeCount={storeCount}
            platformDeliveryEnabled={PLATFORM_DELIVERY_ENABLED}
          />

          {isSharedCart ? <SharedCartStores storeIds={storeIds} /> : null}

          <View style={styles.itemsList}>
            {cartProducts.map(({ item, product }) => (
              <CartItemCard
                key={product.id}
                product={product}
                quantity={item.quantity}
                isSharedCart={isSharedCart}
                onIncrease={() => increaseItem(product.id)}
                onDecrease={() => decreaseItem(product.id)}
                onRemove={() => handleRemoveItem(product.id, product.name)}
              />
            ))}
          </View>

          <DeliveryCard
            isSharedCart={isSharedCart}
            platformDeliveryEnabled={PLATFORM_DELIVERY_ENABLED}
            deliveryFee={deliveryFee}
          />

          <View
            style={[
              styles.totalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.totalTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              ملخص الطلب
            </Text>

            <SummaryRow
              label="المجموع الفرعي"
              value={`${subtotal.toLocaleString("en-US")} ل.س`}
            />

            <SummaryRow label="التوصيل" value={deliveryLabel} />

            <View
              style={[
                styles.totalDivider,
                {
                  backgroundColor: colors.border,
                },
              ]}
            />

            <View style={styles.grandTotalRow}>
              <Text
                style={[
                  styles.grandTotalLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الإجمالي
              </Text>

              <View style={styles.grandTotalPrice}>
                <Text
                  style={[
                    styles.grandTotalAmount,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {total.toLocaleString("en-US")}
                </Text>

                <Text
                  style={[
                    styles.grandTotalCurrency,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  ل.س
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/checkout")}
            style={({ pressed }) => [
              styles.checkoutButton,
              {
                backgroundColor: colors.primary,
              },
              isSharedCart && {
                backgroundColor: colors.accent,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="متابعة لإتمام الطلب"
          >
            <Text
              style={[
                styles.checkoutText,
                {
                  color: colors.surface,
                },
              ]}
            >
              متابعة لإتمام الطلب
            </Text>

            <AppIcon name="arrow-back" size={20} color={colors.surface} />
          </Pressable>

          <Text
            style={[
              styles.note,
              {
                color: colors.textMuted,
              },
            ]}
          >
            الدفع عند الاستلام متاح حالياً.
          </Text>
        </ScrollView>
      )}

      <AppModal
        visible={deleteModal !== null}
        title={modalTitle}
        message={modalMessage}
        icon="trash-outline"
        confirmText={modalConfirmText}
        cancelText="إلغاء"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </View>
  );
}

type CartTypeCardProps = {
  isSharedCart: boolean;
  storeCount: number;
  platformDeliveryEnabled: boolean;
};

function CartTypeCard({
  isSharedCart,
  storeCount,
  platformDeliveryEnabled,
}: CartTypeCardProps) {
  const { colors } = useTheme();

  if (isSharedCart) {
    return (
      <View
        style={[
          styles.sharedCartCard,
          {
            borderColor: colors.accent,
            backgroundColor: colors.accentLight,
          },
        ]}
      >
        <View
          style={[
            styles.sharedCartIcon,
            {
              backgroundColor: colors.surface,
            },
          ]}
        >
          <AppIcon name="git-merge-outline" size={24} color={colors.accent} />
        </View>

        <View style={styles.cartTypeInfo}>
          <View style={styles.cartTypeTitleRow}>
            <Text
              style={[
                styles.sharedCartTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              سلة مشتركة
            </Text>

            <View
              style={[
                styles.sharedBadge,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.sharedBadgeText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                {storeCount} متاجر
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.sharedCartText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            جمعت منتجات من أكثر من متجر في طلب واحد.
          </Text>

          <Text
            style={[
              styles.sharedCartDelivery,
              {
                color: colors.text,
              },
            ]}
          >
            {platformDeliveryEnabled
              ? "سيتم توصيلها عبر منصة تسوق."
              : "عند تفعيل خدمة توصيل المنصة، يتم تجميع الطلبات من المتاجر وتوصيلها عبر تسوق."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.singleCartCard,
        {
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
        },
      ]}
    >
      <View
        style={[
          styles.singleCartIcon,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <AppIcon name="storefront-outline" size={23} color={colors.primary} />
      </View>

      <View style={styles.cartTypeInfo}>
        <Text
          style={[
            styles.singleCartTitle,
            {
              color: colors.primaryDark,
            },
          ]}
        >
          طلب من متجر واحد
        </Text>

        <Text
          style={[
            styles.singleCartText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          جميع المنتجات في هذه السلة من نفس المتجر.
        </Text>

        <Text
          style={[
            styles.singleCartDelivery,
            {
              color: colors.primaryDark,
            },
          ]}
        >
          التوصيل يكون حسب آلية المتجر، إلى أن تتوفر خدمة توصيل منصة تسوق.
        </Text>
      </View>
    </View>
  );
}

type SharedCartStoresProps = {
  storeIds: string[];
};

function SharedCartStores({ storeIds }: SharedCartStoresProps) {
  const { colors } = useTheme();

  const sharedStores = storeIds
    .map((storeId) => stores.find((store) => store.id === storeId))
    .filter((store): store is (typeof stores)[number] => Boolean(store));

  return (
    <View
      style={[
        styles.sharedStoresCard,
        {
          borderColor: colors.accent,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.sharedStoresHeader}>
        <Text
          style={[
            styles.sharedStoresTitle,
            {
              color: colors.text,
            },
          ]}
        >
          المتاجر المشاركة
        </Text>

        <AppIcon name="storefront-outline" size={18} color={colors.accent} />
      </View>

      <View style={styles.sharedStoresList}>
        {sharedStores.map((store, index) => (
          <View
            key={store.id}
            style={[
              styles.sharedStoreRow,
              {
                backgroundColor: colors.accentLight,
              },
            ]}
          >
            <View
              style={[
                styles.sharedStoreNumber,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.sharedStoreNumberText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                {index + 1}
              </Text>
            </View>

            <Text
              style={[
                styles.sharedStoreName,
                {
                  color: colors.text,
                },
              ]}
              numberOfLines={1}
            >
              {store.name}
            </Text>

            <View style={styles.sharedStoreMeta}>
              <AppIcon
                name="time-outline"
                size={13}
                color={colors.textSecondary}
              />

              <Text
                style={[
                  styles.sharedStoreMetaText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {store.deliveryTime}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type CartItemCardProps = {
  product: (typeof products)[number];
  quantity: number;
  isSharedCart: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

function CartItemCard({
  product,
  quantity,
  isSharedCart,
  onIncrease,
  onDecrease,
  onRemove,
}: CartItemCardProps) {
  const { colors } = useTheme();

  const store = stores.find((item) => item.id === product.storeId);

  const itemTotal = product.price * quantity;

  return (
    <View
      style={[
        styles.itemCard,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        isSharedCart && {
          borderColor: colors.accent,
        },
      ]}
    >
      <View style={styles.itemTop}>
        <View
          style={[
            styles.itemVisual,
            {
              backgroundColor: colors.primaryLight,
            },
            isSharedCart && {
              backgroundColor: colors.accentLight,
            },
          ]}
        >
          <AppIcon
            name="cube-outline"
            size={31}
            color={isSharedCart ? colors.accent : colors.primary}
          />
        </View>

        <View style={styles.itemInfo}>
          <Text
            style={[
              styles.itemName,
              {
                color: colors.text,
              },
            ]}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          <Text
            style={[
              styles.storeName,
              {
                color: colors.primary,
              },
              isSharedCart && {
                color: colors.accent,
              },
            ]}
            numberOfLines={1}
          >
            {store?.name ?? "متجر"}
          </Text>

          <Text
            style={[
              styles.itemUnit,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {product.unit}
          </Text>
        </View>

        <Pressable
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`حذف ${product.name}`}
        >
          <AppIcon
            name="close-circle-outline"
            size={21}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.itemBottom,
          {
            borderTopColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.quantityControl,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable
            onPress={onDecrease}
            style={({ pressed }) => [
              styles.quantityButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="إنقاص الكمية"
          >
            <AppIcon name="remove" size={17} color={colors.primary} />
          </Pressable>

          <Text
            style={[
              styles.quantity,
              {
                color: colors.text,
              },
            ]}
          >
            {quantity}
          </Text>

          <Pressable
            onPress={onIncrease}
            style={({ pressed }) => [
              styles.quantityButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="زيادة الكمية"
          >
            <AppIcon name="add" size={17} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.itemPrice}>
          <Text
            style={[
              styles.itemTotal,
              {
                color: colors.primary,
              },
              isSharedCart && {
                color: colors.accent,
              },
            ]}
          >
            {itemTotal.toLocaleString("en-US")}
          </Text>

          <Text
            style={[
              styles.itemCurrency,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            ل.س
          </Text>
        </View>
      </View>
    </View>
  );
}

type DeliveryCardProps = {
  isSharedCart: boolean;
  platformDeliveryEnabled: boolean;
  deliveryFee: number;
};

function DeliveryCard({
  isSharedCart,
  platformDeliveryEnabled,
  deliveryFee,
}: DeliveryCardProps) {
  const { colors } = useTheme();

  const title = isSharedCart ? "توصيل السلة المشتركة" : "توصيل الطلب";

  const text = isSharedCart
    ? platformDeliveryEnabled
      ? "تتولى منصة تسوق تنسيق التوصيل بين المتاجر والعميل."
      : "حالياً لم يتم تفعيل توصيل المنصة. عند تفعيله ستتولى تسوق تجميع الطلبات من المتاجر وتوصيلها للعميل."
    : "سيتم تحديد آلية التوصيل حسب المتجر والعنوان عند إتمام الطلب.";

  const amount = platformDeliveryEnabled
    ? `${deliveryFee.toLocaleString("en-US")} ل.س`
    : "يحدد لاحقاً";

  return (
    <View
      style={[
        styles.deliveryCard,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        isSharedCart && {
          borderColor: colors.accent,
          backgroundColor: colors.accentLight,
        },
      ]}
    >
      <View
        style={[
          styles.deliveryIcon,
          {
            backgroundColor: colors.primaryLight,
          },
          isSharedCart && {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <AppIcon
          name={isSharedCart ? "git-merge-outline" : "bicycle-outline"}
          size={23}
          color={isSharedCart ? colors.accent : colors.primary}
        />
      </View>

      <View style={styles.deliveryInfo}>
        <Text
          style={[
            styles.deliveryTitle,
            {
              color: colors.text,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.deliveryText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {text}
        </Text>
      </View>

      <Text
        style={[
          styles.deliveryAmount,
          {
            color: colors.primary,
          },
          isSharedCart && {
            color: colors.accent,
          },
        ]}
      >
        {amount}
      </Text>
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          {
            color: colors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

type EmptyCartProps = {
  onContinue: () => void;
};

function EmptyCart({ onContinue }: EmptyCartProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name="cart-outline" size={55} color={colors.primary} />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            color: colors.text,
          },
        ]}
      >
        السلة فارغة
      </Text>

      <Text
        style={[
          styles.emptyText,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        لم تضف أي منتجات بعد. تصفح المتاجر واختر المنتجات التي تريدها.
      </Text>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [
          styles.browseButton,
          {
            backgroundColor: colors.primary,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="تصفح المتاجر"
      >
        <AppIcon name="storefront-outline" size={20} color={colors.surface} />

        <Text
          style={[
            styles.browseText,
            {
              color: colors.surface,
            },
          ]}
        >
          تصفح المتاجر
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.ten,
  },

  summaryHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  clearButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  clearText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  singleCartCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  singleCartIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  cartTypeInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  singleCartTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  singleCartText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  singleCartDelivery: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  sharedCartCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
    marginBottom: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderRadius: Radius.xl,
  },

  sharedCartIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  cartTypeTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  sharedCartTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  sharedBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },

  sharedBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
  },

  sharedCartText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  sharedCartDelivery: {
    marginTop: 4,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  sharedStoresCard: {
    marginBottom: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  sharedStoresHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  sharedStoresTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  sharedStoresList: {
    gap: Spacing.two,
  },

  sharedStoreRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },

  sharedStoreNumber: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  sharedStoreNumberText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
  },

  sharedStoreName: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  sharedStoreMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  sharedStoreMetaText: {
    fontFamily: Fonts.regular,
    fontSize: 9,
  },

  itemsList: {
    gap: Spacing.three,
  },

  itemCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  itemTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },

  itemVisual: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  itemInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  itemName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 21,
    textAlign: "right",
  },

  storeName: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  itemUnit: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },

  removeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  itemBottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },

  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  quantityButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  quantity: {
    minWidth: 32,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  itemPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 3,
  },

  itemTotal: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  itemCurrency: {
    fontFamily: Fonts.medium,
    fontSize: 9,
  },

  deliveryCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  deliveryIcon: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  deliveryInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  deliveryTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  deliveryText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  deliveryAmount: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  sharedDeliveryAmount: {
    maxWidth: 85,
  },

  totalCard: {
    marginTop: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },

  totalTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
    marginBottom: Spacing.three,
  },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.two,
  },

  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  totalDivider: {
    height: 1,
    marginVertical: Spacing.three,
  },

  grandTotalRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  grandTotalLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  grandTotalPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  grandTotalAmount: {
    fontFamily: Fonts.bold,
    fontSize: 23,
  },

  grandTotalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },

  checkoutButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 55,
    marginTop: Spacing.four,
    borderRadius: Radius.lg,
  },

  checkoutText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  note: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "center",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
  },

  emptyIcon: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.five,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  emptyText: {
    maxWidth: 320,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  browseButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 50,
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.six,
    borderRadius: Radius.lg,
  },

  browseText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.72,
  },
});

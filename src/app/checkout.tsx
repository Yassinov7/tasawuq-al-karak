import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import {
  FontSizes,
  Fonts,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  createCustomerOrder,
  getCustomerAddresses,
  formatCurrency,
  getDeliveryZones,
  type CustomerAddress,
  type DeliveryZone,
} from "@/lib/customer-orders";
import { supabase } from "@/lib/supabase";

export default function CheckoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    itemCount,
    subtotal,
    currency,
    hasMixedCurrencies,
    loading: cartLoading,
    syncError,
    flush,
    retrySync,
    clearAfterOrder,
  } = useCart();

  const [confirmModalVisible, setConfirmModalVisible] =
    useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedZone = deliveryZones.find((zone) => zone.id === selectedZoneId);
  const deliveryFee = selectedZone?.fixed_fee ?? 0;
  const total = currency && selectedZone?.currency === currency
    ? subtotal + deliveryFee
    : subtotal;
  const confirmationTotal = currency
    ? selectedZone && selectedZone.currency !== currency
      ? `${formatCurrency(subtotal, currency)} + ${formatCurrency(deliveryFee, selectedZone.currency)}`
      : formatCurrency(total, currency)
    : "—";

  useEffect(() => {
    let alive = true;
    const loadCheckoutDetails = async () => {
      setLoadingDetails(true);
      setError(null);
      try {
        const [zones, profileResult, addresses] = await Promise.all([
          getDeliveryZones(),
          user
            ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          getCustomerAddresses(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (!alive) return;
        setDeliveryZones(zones);
        setSavedAddresses(addresses);
        const defaultAddress = addresses.find((address) => address.is_default);
        const defaultZoneIsActive = Boolean(defaultAddress?.zone?.is_active);
        setSelectedAddressId(defaultAddress && defaultZoneIsActive ? defaultAddress.id : null);
        setSelectedZoneId(defaultZoneIsActive
          ? defaultAddress?.delivery_zone_id ?? ""
          : zones[0]?.id ?? "");
        setRecipientName(defaultAddress?.recipient_name ?? profileResult.data?.full_name ?? "");
        const metadataPhone = user?.user_metadata?.phone;
        setContactPhone(defaultAddress?.contact_phone ?? (typeof metadataPhone === "string" ? metadataPhone : ""));
        setDeliveryAddress(defaultAddress?.delivery_address ?? "");
      } catch (cause) {
        if (alive) {
          setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات إتمام الطلب.");
        }
      } finally {
        if (alive) setLoadingDetails(false);
      }
    };
    void loadCheckoutDetails();
    return () => {
      alive = false;
    };
  }, [user]);

  const selectSavedAddress = (address: CustomerAddress) => {
    setSelectedAddressId(address.id);
    setRecipientName(address.recipient_name);
    setContactPhone(address.contact_phone);
    setDeliveryAddress(address.delivery_address);
    if (address.zone?.is_active) {
      setSelectedZoneId(address.delivery_zone_id);
      setError(null);
    } else {
      setSelectedZoneId("");
      setError("منطقة هذا العنوان لم تعد متاحة. اختر منطقة توصيل فعالة.");
    }
  };

  const handleConfirmOrder = () => {
    setError(null);
    if (cartLoading || itemCount === 0) {
      setError("السلة فارغة أو ما زالت قيد التحميل.");
      return;
    }
    if (hasMixedCurrencies) {
      setError("لا يمكن إرسال سلة تحتوي منتجات بعملات مختلفة.");
      return;
    }
    if (!recipientName.trim() || !contactPhone.trim() || !deliveryAddress.trim() || !selectedZone) {
      setError("أكمل بيانات المستلم وعنوان التوصيل واختر منطقة التوصيل.");
      return;
    }
    setConfirmModalVisible(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await flush();
      const orderId = await createCustomerOrder({
        recipientName: recipientName.trim(),
        contactPhone: contactPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryZoneId: selectedZoneId,
        customerNote: customerNote.trim(),
      });
      clearAfterOrder();
      setConfirmModalVisible(false);
      router.replace({ pathname: "/order-details", params: { id: orderId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الطلب. حاول مجددًا.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setConfirmModalVisible(false);
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
      <AppHeader
        title="إتمام الطلب"
        showBack
        cartCount={itemCount}
        mode="customer"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Section title="عنوان التوصيل">
          {savedAddresses.length > 0 ? (
            <View style={{ gap: Spacing.two }}>
              <Text style={{ color: colors.textSecondary, textAlign: "right" }}>
                اختر عنوانًا محفوظًا أو أدخل عنوانًا جديدًا لهذا الطلب:
              </Text>
              {savedAddresses.map((address) => {
                const selected = selectedAddressId === address.id;
                return (
                  <Pressable
                    key={address.id}
                    onPress={() => selectSavedAddress(address)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.optionCard,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionTitle, { color: colors.text }]}>
                        {address.title}{address.is_default ? " · افتراضي" : ""}
                      </Text>
                      <Text style={[styles.optionText, { color: colors.textSecondary }]}>
                        {address.recipient_name} · {address.contact_phone}
                      </Text>
                      <Text style={[styles.optionText, { color: colors.textSecondary }]}>
                        {address.delivery_address}
                      </Text>
                      <Text style={[styles.optionText, { color: address.zone?.is_active ? colors.primary : colors.error }]}>
                        {address.zone
                          ? `${address.zone.name} · ${formatCurrency(address.zone.fixed_fee, address.zone.currency)}`
                          : "منطقة التوصيل غير متاحة"}
                      </Text>
                    </View>
                    <AppIcon
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <AppButton
            title="إدارة العناوين المحفوظة"
            icon="location-outline"
            variant="outline"
            onPress={() => router.push("/addresses")}
          />
          <AppTextField
            label="اسم المستلم"
            value={recipientName}
            onChangeText={(value) => {
              setSelectedAddressId(null);
              setRecipientName(value);
            }}
            autoCapitalize="words"
            maxLength={120}
          />
          <AppTextField
            label="رقم الهاتف"
            value={contactPhone}
            onChangeText={(value) => {
              setSelectedAddressId(null);
              setContactPhone(value);
            }}
            keyboardType="phone-pad"
            maxLength={32}
          />
          <AppTextField
            label="العنوان بالتفصيل"
            value={deliveryAddress}
            onChangeText={(value) => {
              setSelectedAddressId(null);
              setDeliveryAddress(value);
            }}
            placeholder="الحي، الشارع، أقرب علامة مميزة"
            multiline
            maxLength={1000}
          />
          {loadingDetails ? <ActivityIndicator color={colors.primary} /> : null}
          {deliveryZones.map((zone) => (
            <Pressable
              key={zone.id}
              onPress={() => {
                setSelectedAddressId(null);
                setSelectedZoneId(zone.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedZoneId === zone.id }}
              style={[
                styles.optionCard,
                {
                  borderColor: selectedZoneId === zone.id ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
            <View
              style={[
                styles.optionIcon,
                {
                  backgroundColor:
                    colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="home-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.optionInfo}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {zone.name}
              </Text>

              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                رسوم التوصيل: {formatCurrency(zone.fixed_fee, zone.currency)}
              </Text>
            </View>

            <AppIcon
              name={selectedZoneId === zone.id ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={colors.primary}
            />
          </Pressable>
          ))}
          <AppTextField
            label="ملاحظة للطلب (اختياري)"
            value={customerNote}
            onChangeText={setCustomerNote}
            multiline
            maxLength={1500}
          />
        </Section>

        <Section title="طريقة الدفع">
          <View
            style={[
              styles.optionCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.optionIcon,
                {
                  backgroundColor:
                    colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="cash-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.optionInfo}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الدفع عند الاستلام
              </Text>

              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                ادفع نقداً عند وصول الطلب
              </Text>
            </View>

            <AppIcon
              name="checkmark-circle"
              size={22}
              color={colors.primary}
            />
          </View>
        </Section>

        <Section title="ملخص الطلب">
          <View
            style={[
              styles.summaryCard,
              {
                borderColor: colors.border,
                backgroundColor:
                  colors.surface,
              },
            ]}
          >
            <SummaryRow
              label="عدد المنتجات"
              value={`${itemCount} قطعة`}
            />

            <SummaryRow
              label="المجموع الفرعي"
              value={currency ? formatCurrency(subtotal, currency) : "—"}
            />

            <SummaryRow
              label="التوصيل"
              value={selectedZone ? formatCurrency(deliveryFee, selectedZone.currency) : "اختر منطقة التوصيل"}
            />

            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View style={styles.totalRow}>
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

              <View style={styles.totalPrice}>
                <Text
                  style={[
                    styles.totalAmount,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {currency && selectedZone?.currency !== currency
                    ? `${formatCurrency(subtotal, currency)} + ${selectedZone ? formatCurrency(deliveryFee, selectedZone.currency) : "—"}`
                    : total.toLocaleString("en-US")}
                </Text>

                <Text
                  style={[
                    styles.totalCurrency,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  {currency && selectedZone?.currency === currency
                    ? currency === "USD" ? "$" : "ل.س"
                    : ""}
                </Text>
              </View>
            </View>
          </View>
        </Section>

        <View
          style={[
            styles.notice,
            {
              backgroundColor:
                colors.primaryLight,
            },
          ]}
        >
          <AppIcon
            name="information-circle-outline"
            size={21}
            color={colors.primary}
          />

          <Text
            style={[
              styles.noticeText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            الطلب متعدد المتاجر يمكن أن يحتوي
            على أكثر من فاتورة فرعية، وسيتم
            احتساب تفاصيل كل متجر ضمن الطلب.
          </Text>
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "right" }}>
            {error}
          </Text>
        ) : null}
        {syncError ? (
          <View style={{ alignItems: "flex-start", gap: Spacing.two }}>
            <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "right" }}>
              {syncError}
            </Text>
            <AppButton title="إعادة تحميل السلة" variant="outline" onPress={() => void retrySync()} />
          </View>
        ) : null}
        <Pressable
          disabled={loadingDetails || submitting || cartLoading}
          onPress={handleConfirmOrder}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              backgroundColor:
                colors.primary,
            },
            pressed && styles.pressed,
            (loadingDetails || submitting || cartLoading) && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="تأكيد الطلب"
        >
          <Text
            style={[
              styles.confirmText,
              {
                color: colors.surface,
              },
            ]}
          >
            تأكيد الطلب
          </Text>

          <AppIcon
            name="checkmark-circle-outline"
            size={21}
            color={colors.surface}
          />
        </Pressable>

        <Text
          style={[
            styles.footerNote,
            {
              color: colors.textMuted,
            },
          ]}
        >
          بتأكيد الطلب، أنت توافق على تفاصيل الطلب
          وطريقة الدفع المختارة.
        </Text>
      </ScrollView>

      <AppModal
        visible={confirmModalVisible}
        title="تأكيد الطلب"
        message={`هل تريد تأكيد الطلب بقيمة ${confirmationTotal} والدفع عند الاستلام؟`}
        icon="checkmark-circle-outline"
        confirmText={submitting ? "جارٍ إرسال الطلب..." : "تأكيد الطلب"}
        cancelText="مراجعة الطلب"
        busy={submitting}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancel}
      >
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "center", marginTop: Spacing.three }}>
            {error}
          </Text>
        ) : null}
      </AppModal>
    </View>
  );
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({
  title,
  children,
}: SectionProps) {
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

      {children}
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({
  label,
  value,
}: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color:
              colors.textSecondary,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.ten,
  },

  section: {
    marginBottom: Spacing.five,
  },

  sectionTitle: {
    marginBottom: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  optionCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  optionIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  optionInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  optionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  optionText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },

  summaryCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  divider: {
    height: 1,
    marginBottom: Spacing.three,
  },

  totalRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  totalLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  totalPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  totalAmount: {
    fontFamily: Fonts.bold,
    fontSize: 23,
  },

  totalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },

  notice: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.xl,
  },

  noticeText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  confirmButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 55,
    marginTop: Spacing.five,
    borderRadius: Radius.lg,
  },

  confirmText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  footerNote: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.72,
  },
});
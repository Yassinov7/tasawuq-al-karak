import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Address = {
  id: string;
  title: string;
  details: string;
  mapsUrl: string;
  isDefault: boolean;
};

const initialAddresses: Address[] = [
  {
    id: "1",
    title: "المنزل",
    details: "الكرك الشرقي - الشارع الرئيسي",
    mapsUrl: "",
    isDefault: true,
  },
];

export default function AddressesScreen() {
  const { colors } = useTheme();

  const scrollViewRef = useRef<ScrollView>(null);

  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);

  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");

  const scrollToInput = (y: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y,
        animated: true,
      });
    }, 150);
  };

  const resetForm = () => {
    setTitle("");
    setDetails("");
    setMapsUrl("");
    setIsAdding(false);
  };

  const handleAddAddress = () => {
    const cleanTitle = title.trim();
    const cleanDetails = details.trim();
    const cleanMapsUrl = mapsUrl.trim();

    if (!cleanTitle || !cleanDetails) {
      Alert.alert("بيانات ناقصة", "يرجى إدخال اسم العنوان وتفاصيله.");
      return;
    }

    if (cleanMapsUrl && !/^https?:\/\//i.test(cleanMapsUrl)) {
      Alert.alert(
        "رابط غير صحيح",
        "يرجى إدخال رابط Google Maps يبدأ بـ https://",
      );
      return;
    }

    const newAddress: Address = {
      id: Date.now().toString(),
      title: cleanTitle,
      details: cleanDetails,
      mapsUrl: cleanMapsUrl,
      isDefault: addresses.length === 0,
    };

    setAddresses((current) => [...current, newAddress]);

    resetForm();
  };

  const handleSetDefault = (id: string) => {
    setAddresses((current) =>
      current.map((address) => ({
        ...address,
        isDefault: address.id === id,
      })),
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert("حذف العنوان", "هل تريد حذف هذا العنوان؟", [
      {
        text: "إلغاء",
        style: "cancel",
      },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          setAddresses((current) => {
            const remaining = current.filter((address) => address.id !== id);

            if (
              remaining.length > 0 &&
              !remaining.some((address) => address.isDefault)
            ) {
              remaining[0] = {
                ...remaining[0],
                isDefault: true,
              };
            }

            return remaining;
          });
        },
      },
    ]);
  };

  const handleOpenMaps = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("تعذر فتح الرابط", "تأكد من أن رابط Google Maps صحيح.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("تعذر فتح الرابط", "حدثت مشكلة أثناء فتح Google Maps.");
    }
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
      <AppHeader title="العناوين" showBack cartCount={0} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.intro}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              عناوين التوصيل
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              احفظ عناوينك لتسهيل إتمام طلباتك
            </Text>
          </View>

          {addresses.length > 0 ? (
            <View style={styles.addresses}>
              {addresses.map((address) => (
                <View
                  key={address.id}
                  style={[
                    styles.addressCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <View style={styles.addressTop}>
                    <View
                      style={[
                        styles.addressIcon,
                        {
                          backgroundColor: colors.primaryLight,
                        },
                      ]}
                    >
                      <AppIcon
                        name="location-outline"
                        size={23}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.addressInfo}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.addressTitle,
                            {
                              color: colors.text,
                            },
                          ]}
                        >
                          {address.title}
                        </Text>

                        {address.isDefault ? (
                          <View
                            style={[
                              styles.defaultBadge,
                              {
                                backgroundColor: colors.primaryLight,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.defaultBadgeText,
                                {
                                  color: colors.primary,
                                },
                              ]}
                            >
                              افتراضي
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text
                        style={[
                          styles.addressDetails,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {address.details}
                      </Text>
                    </View>
                  </View>

                  {address.mapsUrl ? (
                    <Pressable
                      onPress={() => handleOpenMaps(address.mapsUrl)}
                      style={({ pressed }) => [
                        styles.mapsButton,
                        {
                          backgroundColor: colors.primaryLight,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="فتح الموقع على الخريطة"
                    >
                      <AppIcon
                        name="map-outline"
                        size={18}
                        color={colors.primary}
                      />

                      <Text
                        style={[
                          styles.mapsButtonText,
                          {
                            color: colors.primary,
                          },
                        ]}
                      >
                        فتح الموقع على الخريطة
                      </Text>
                    </Pressable>
                  ) : null}

                  <View
                    style={[
                      styles.addressActions,
                      {
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    {!address.isDefault ? (
                      <Pressable
                        onPress={() => handleSetDefault(address.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="تعيين كافتراضي"
                      >
                        <AppIcon
                          name="checkmark-circle-outline"
                          size={17}
                          color={colors.primary}
                        />

                        <Text
                          style={[
                            styles.defaultActionText,
                            {
                              color: colors.primary,
                            },
                          ]}
                        >
                          تعيين كافتراضي
                        </Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}

                    <Pressable
                      onPress={() => handleDelete(address.id)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="حذف العنوان"
                    >
                      <AppIcon
                        name="trash-outline"
                        size={17}
                        color={colors.error}
                      />

                      <Text
                        style={[
                          styles.deleteText,
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
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
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
                  name="location-outline"
                  size={36}
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
                لا توجد عناوين محفوظة
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                أضف عنواناً لتتمكن من استخدامه عند إتمام طلباتك.
              </Text>
            </View>
          )}

          {isAdding ? (
            <View
              style={[
                styles.formCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View style={styles.formHeader}>
                <Text
                  style={[
                    styles.formTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  إضافة عنوان جديد
                </Text>

                <Pressable
                  onPress={resetForm}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق"
                >
                  <AppIcon
                    name="close-outline"
                    size={23}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                اسم العنوان
              </Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="مثلاً: المنزل"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                  },
                ]}
                textAlign="right"
                returnKeyType="next"
                onFocus={() => scrollToInput(180)}
              />

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                تفاصيل العنوان
              </Text>

              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="المنطقة، الشارع، رقم البناء..."
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  styles.detailsInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                  },
                ]}
                multiline
                textAlign="right"
                textAlignVertical="top"
                onFocus={() => scrollToInput(270)}
              />

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                رابط Google Maps
              </Text>

              <TextInput
                value={mapsUrl}
                onChangeText={setMapsUrl}
                placeholder="الصق رابط موقعك من Google Maps"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                  },
                ]}
                textAlign="right"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => scrollToInput(390)}
              />

              <Text
                style={[
                  styles.helperText,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                افتح Google Maps، اختر موقعك، ثم اضغط مشاركة وانسخ الرابط والصقه
                هنا.
              </Text>

              <Pressable
                onPress={handleAddAddress}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: colors.primary,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="حفظ العنوان"
              >
                <AppIcon
                  name="checkmark-outline"
                  size={20}
                  color={colors.surface}
                />

                <Text
                  style={[
                    styles.saveButtonText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  حفظ العنوان
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setIsAdding(true);

                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({
                    animated: true,
                  });
                }, 200);
              }}
              style={({ pressed }) => [
                styles.addButton,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.surface,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="إضافة عنوان جديد"
            >
              <AppIcon
                name="add-circle-outline"
                size={22}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.addButtonText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                إضافة عنوان جديد
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: 180,
  },

  intro: {
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
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  addresses: {
    gap: Spacing.three,
    marginTop: Spacing.five,
  },

  addressCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  addressTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },

  addressIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  addressInfo: {
    flex: 1,
    marginRight: Spacing.three,
    alignItems: "flex-end",
  },

  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  addressTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  defaultBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },

  defaultBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  addressDetails: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 21,
    textAlign: "right",
  },

  mapsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 42,
    marginTop: Spacing.three,
    borderRadius: Radius.md,
  },

  mapsButtonText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  addressActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },

  actionButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    minHeight: 34,
  },

  defaultActionText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  deleteText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.ten,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.four,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  emptyText: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "center",
  },

  formCard: {
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  formHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  formTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  inputLabel: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  detailsInput: {
    minHeight: 90,
    paddingTop: Spacing.three,
  },

  helperText: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  saveButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 50,
    marginTop: Spacing.four,
    borderRadius: Radius.md,
  },

  saveButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  addButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 52,
    marginTop: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  addButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  pressed: {
    opacity: 0.7,
  },
});

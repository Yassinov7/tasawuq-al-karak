import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getMediaExtension,
  getMerchantStore,
  getStoreMediaUrl,
  type MerchantStore,
} from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
};

type StoredMedia = {
  id: string;
  storage_path: string;
  media_type: "image" | "video";
  display_order: number;
  alt_text: string;
};

type DraftMedia = {
  key: string;
  type: "image" | "video";
  uri: string;
  fileName: string;
  mimeType: string;
  size?: number;
  existing?: StoredMedia;
};

type ProductRow = {
  id: string;
  title: string;
  description: string;
  category_id: string;
  price: number;
  currency: "SYP" | "USD";
  selling_unit: string;
  minimum_quantity: number;
  quantity_step: number;
  is_available: boolean;
};

export default function MerchantProductEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const productId = Array.isArray(id) ? id[0] : id;

  const { user } = useAuth();
  const { colors } = useTheme();

  const [store, setStore] = useState<MerchantStore | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alert, setAlert] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"SYP" | "USD">("SYP");
  const [unit, setUnit] = useState("قطعة");
  const [minimum, setMinimum] = useState("1");
  const [step, setStep] = useState("1");
  const [available, setAvailable] = useState(true);

  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [originalMedia, setOriginalMedia] = useState<StoredMedia[]>([]);

  const saveLock = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");

      const [ownStore, categoryResult] = await Promise.all([
        getMerchantStore(user.id),
        supabase
          .from("product_categories")
          .select("id,name")
          .eq("is_active", true)
          .order("sort_order"),
      ]);

      if (!ownStore) {
        router.replace("/application-status" as Href);
        return;
      }

      if (categoryResult.error) {
        throw categoryResult.error;
      }

      setStore(ownStore);
      setCategories((categoryResult.data ?? []) as Category[]);

      if (categoryResult.data?.length && !productId) {
        setCategoryId(categoryResult.data[0].id);
      }

      if (productId) {
        const [productResult, mediaResult] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,title,description,category_id,price,currency,selling_unit,minimum_quantity,quantity_step,is_available",
            )
            .eq("id", productId)
            .eq("store_id", ownStore.id)
            .maybeSingle(),

          supabase
            .from("product_media")
            .select("id,storage_path,media_type,display_order,alt_text")
            .eq("product_id", productId)
            .order("display_order"),
        ]);

        if (productResult.error || mediaResult.error || !productResult.data) {
          throw (
            productResult.error ??
            mediaResult.error ??
            new Error("product not found")
          );
        }

        const product = productResult.data as ProductRow;

        setTitle(product.title);
        setDescription(product.description);
        setCategoryId(product.category_id);
        setPrice(String(product.price));
        setCurrency(product.currency);
        setUnit(product.selling_unit);
        setMinimum(String(product.minimum_quantity));
        setStep(String(product.quantity_step));
        setAvailable(product.is_available);

        const stored = (mediaResult.data ?? []) as StoredMedia[];

        setOriginalMedia(stored);

        setMedia(
          stored.map((item) => ({
            key: item.id,
            type: item.media_type,
            uri: getStoreMediaUrl(item.storage_path),
            fileName:
              item.alt_text ||
              (item.media_type === "video" ? "فيديو المنتج" : "صورة المنتج"),
            mimeType: "",
            existing: item,
          })),
        );
      }
    } catch {
      setError("تعذر تحميل بيانات المنتج أو التصنيفات.");
    } finally {
      setLoading(false);
    }
  }, [user, productId, router]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);

    return () => clearTimeout(timer);
  }, [load]);

  const imageCount = useMemo(
    () => media.filter((item) => item.type === "image").length,
    [media],
  );

  const hasVideo = media.some((item) => item.type === "video");

  const pickImages = async () => {
    const remaining = 5 - imageCount;

    if (remaining <= 0) {
      setError("يمكن إضافة خمس صور كحد أقصى.");
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError("اسمح للتطبيق بالوصول إلى مكتبة الصور لاختيار صور المنتج.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
      });

      if (result.canceled) return;

      if (
        result.assets.some(
          (asset) => asset.fileSize && asset.fileSize > 50 * 1024 * 1024,
        )
      ) {
        setError("حجم إحدى الصور يتجاوز الحد الأقصى وهو 50 ميغابايت.");
        return;
      }

      const picked: DraftMedia[] = result.assets.map((asset, index) => ({
        key: `${Date.now()}-${index}-${Math.random()}`,
        type: "image",
        uri: asset.uri,
        fileName: asset.fileName ?? `product-image-${index + 1}`,
        mimeType: asset.mimeType ?? "image/jpeg",
        size: asset.fileSize,
      }));

      setMedia((previous) => [...previous, ...picked].slice(0, 5));
      setError("");
    } catch {
      setError("تعذر فتح معرض الصور على هذا الجهاز.");
    }
  };

  const pickVideo = async () => {
    if (hasVideo) {
      setError("يمكن إضافة فيديو واحد فقط. احذف الفيديو الحالي لاستبداله.");
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(
          "اسمح للتطبيق بالوصول إلى مكتبة الوسائط لاختيار فيديو المنتج.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
        setError("حجم الفيديو يتجاوز الحد الأقصى وهو 50 ميغابايت.");
        return;
      }

      if (asset.duration && asset.duration > 120_000) {
        setError("مدة الفيديو تتجاوز دقيقتين.");
        return;
      }

      if (
        asset.mimeType &&
        !["video/mp4", "video/quicktime", "video/webm"].includes(asset.mimeType)
      ) {
        setError("صيغة الفيديو غير مدعومة. استخدم MP4 أو MOV أو WebM.");
        return;
      }

      setMedia((previous) => [
        ...previous.filter((item) => item.type !== "video"),
        {
          key: `${Date.now()}-${Math.random()}`,
          type: "video",
          uri: asset.uri,
          fileName: asset.fileName ?? "product-video",
          mimeType: asset.mimeType ?? "video/mp4",
          size: asset.fileSize,
        },
      ]);

      setError("");
    } catch {
      setError("تعذر فتح معرض الفيديو على هذا الجهاز.");
    }
  };

  const removeMedia = (item: DraftMedia) => {
    setMedia((previous) => previous.filter((entry) => entry.key !== item.key));
  };

  const save = async () => {
    if (!store || saveLock.current) return;

    const cost = Number(price.replace(",", "."));
    const minValue = Number(minimum.replace(",", "."));
    const stepValue = Number(step.replace(",", "."));

    if (title.trim().length < 2 || !categoryId || !unit.trim()) {
      setError("أدخل اسم المنتج واختر تصنيفًا ووحدة بيع.");
      return;
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      setError("أدخل سعرًا أكبر من صفر.");
      return;
    }

    if (
      !Number.isFinite(minValue) ||
      minValue <= 0 ||
      !Number.isFinite(stepValue) ||
      stepValue <= 0
    ) {
      setError("الحد الأدنى وخطوة الكمية يجب أن يكونا أكبر من صفر.");
      return;
    }

    if (
      media.length > 6 ||
      imageCount > 5 ||
      media.filter((item) => item.type === "video").length > 1
    ) {
      setError("تحقق من عدد الصور والفيديوهات.");
      return;
    }

    saveLock.current = true;
    setBusy(true);
    setError("");

    const values = {
      store_id: store.id,
      category_id: categoryId,
      title: title.trim(),
      description: description.trim(),
      price: cost,
      currency,
      selling_unit: unit.trim(),
      minimum_quantity: minValue,
      quantity_step: stepValue,
      is_available: available,
    };

    let savedProductId = productId;
    const uploadedPaths: string[] = [];
    let createdProduct = false;
    let successMessage = "";

    const newMedia = media.filter((item) => !item.existing);

    try {
      if (savedProductId) {
        const { data, error: updateError } = await supabase
          .from("products")
          .update(values)
          .eq("id", savedProductId)
          .eq("store_id", store.id)
          .select("id")
          .single();

        if (updateError || !data?.id) {
          throw updateError ?? new Error("product update was not confirmed");
        }
      } else {
        const { data, error: insertError } = await supabase
          .from("products")
          .insert(values)
          .select("id")
          .single();

        if (insertError || !data?.id) {
          throw insertError ?? new Error("product id missing");
        }

        savedProductId = data.id;
        createdProduct = true;
      }

      for (const [index, item] of newMedia.entries()) {
        const localFile = new File(item.uri);

        if (!localFile.exists) {
          throw new Error("selected media file no longer exists");
        }

        const bytes = await localFile.arrayBuffer();

        if (!bytes.byteLength) {
          throw new Error("empty media file");
        }

        const extension = getMediaExtension(item.mimeType, item.fileName);

        const path = `${store.id}/products/${savedProductId}/${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

        const { data: uploadedFile, error: uploadError } =
          await supabase.storage.from("store-media").upload(path, bytes, {
            contentType: item.mimeType || undefined,
            upsert: false,
          });

        if (uploadError || !uploadedFile?.path) {
          throw uploadError ?? new Error("storage upload was not confirmed");
        }

        uploadedPaths.push(path);
      }

      const uploadedRows = newMedia.map((item, index) => ({
        store_id: store.id,
        product_id: savedProductId!,
        media_type: item.type,
        storage_path: uploadedPaths[index],
        display_order: media.indexOf(item),
        alt_text: item.fileName.slice(0, 180),
      }));

      if (uploadedRows.length) {
        const { data: linkedRows, error: mediaError } = await supabase
          .from("product_media")
          .insert(uploadedRows)
          .select("id,storage_path");

        if (mediaError) {
          throw mediaError;
        }

        if ((linkedRows?.length ?? 0) !== uploadedRows.length) {
          throw new Error("media database links were not confirmed");
        }
      }

      const retainedIds = new Set(
        media.flatMap((item) => (item.existing ? [item.existing.id] : [])),
      );

      const removed = originalMedia.filter((item) => !retainedIds.has(item.id));

      if (removed.length) {
        const { error: removeRowsError } = await supabase
          .from("product_media")
          .delete()
          .in(
            "id",
            removed.map((item) => item.id),
          );

        if (!removeRowsError) {
          await supabase.storage
            .from("store-media")
            .remove(removed.map((item) => item.storage_path));
        }
      }

      const { data: verifiedMedia, error: verifyMediaError } = await supabase
        .from("product_media")
        .select("id")
        .eq("store_id", store.id)
        .eq("product_id", savedProductId);

      if (verifyMediaError) {
        throw verifyMediaError;
      }

      if ((verifiedMedia?.length ?? 0) !== media.length) {
        throw new Error("saved media count did not match the editor");
      }

      const projectRef =
        process.env.EXPO_PUBLIC_SUPABASE_URL?.match(
          /^https?:\/\/([^.]+)/,
        )?.[1] ?? "غير معروف";

      const mediaSummary = newMedia.length
        ? ` وتم التحقق من رفع ${newMedia.length} وسيط وربطه.`
        : " ولم تُرفق وسائط جديدة.";

      successMessage = `${
        productId ? "تم تحديث المنتج." : "تمت إضافة المنتج إلى متجرك."
      }${mediaSummary}${
        __DEV__
          ? `\nمرجع المنتج: ${savedProductId}\nمشروع Supabase: ${projectRef}`
          : ""
      }`;
    } catch (failure) {
      if (uploadedPaths.length) {
        await supabase
          .from("product_media")
          .delete()
          .in("storage_path", uploadedPaths);

        await supabase.storage.from("store-media").remove(uploadedPaths);
      }

      if (createdProduct && savedProductId) {
        await supabase
          .from("products")
          .delete()
          .eq("id", savedProductId)
          .eq("store_id", store.id);
      }

      const details =
        failure && typeof failure === "object"
          ? (failure as {
              message?: string;
              name?: string;
              status?: number;
              statusCode?: string | number;
            })
          : null;

      const reason = [
        details?.name,
        details?.message ?? String(failure),
        details?.statusCode ?? details?.status,
      ]
        .filter(Boolean)
        .join(" · ");

      const message = /bucket not found|nosuchbucket/i.test(reason)
        ? "مخزن الوسائط غير موجود. نفّذ ترحيل إنشاء مخزن store-media وسياساته في Supabase."
        : /row\.level security|not authorized|permission/i.test(reason)
          ? "رفضت صلاحيات التخزين رفع الملف. تأكد من تطبيق سياسات store-media ثم سجّل الخروج والدخول."
          : /mime|content.type|file type/i.test(reason)
            ? "صيغة الملف غير مدعومة. استخدم JPEG أو PNG أو WebP للصور، وMP4 أو MOV أو WebM للفيديو."
            : /too large|exceeded|payload/i.test(reason)
              ? "حجم الملف أكبر من الحد المسموح. خفّض حجم الوسائط ثم أعد المحاولة."
              : /file read failed|empty media file|media file no longer exists/i.test(
                    reason,
                  )
                ? "تعذر قراءة الملف المختار من الجهاز. أعد اختياره من معرض الصور أو الفيديو."
                : `تعذر حفظ المنتج أو ربط وسائطه. لم تُضف نسخة مكررة. (${reason})`;

      setError(`${message}${__DEV__ ? `\nتفاصيل Supabase: ${reason}` : ""}`);

      return;
    } finally {
      setBusy(false);
      saveLock.current = false;
    }

    setAlert(successMessage);
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
        title={productId ? "تعديل المنتج" : "إضافة منتج"}
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
              name={productId ? "create-outline" : "add-circle-outline"}
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.introText}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>
              {productId ? "تعديل تفاصيل المنتج" : "أضف منتجًا جديدًا"}
            </Text>

            <Text
              style={[styles.pageSubtitle, { color: colors.textSecondary }]}
            >
              {store?.name ?? ""}
            </Text>
          </View>
        </View>

        {error ? (
          <View
            style={[
              styles.messageCard,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.error,
              },
            ]}
          >
            <AppIcon name="warning-outline" size={20} color={colors.error} />

            <Text style={[styles.messageText, { color: colors.error }]}>
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
            icon="cube-outline"
            title="معلومات المنتج"
            colors={colors}
          />

          <AppTextField
            label="اسم المنتج"
            value={title}
            onChangeText={setTitle}
            placeholder="مثال: زيت زيتون بلدي"
            maxLength={140}
          />

          <AppTextField
            label="وصف المنتج"
            value={description}
            onChangeText={setDescription}
            placeholder="اكتب تفاصيل تساعد الزبون على الاختيار"
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
            icon="pricetag-outline"
            title="التصنيف"
            colors={colors}
          />

          {!categories.length ? (
            <View
              style={[
                styles.emptyInline,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <AppIcon
                name="information-circle-outline"
                size={18}
                color={colors.textSecondary}
              />

              <Text
                style={[styles.inlineNote, { color: colors.textSecondary }]}
              >
                لا توجد تصنيفات مفعلة حاليًا. يرجى إضافة التصنيفات من إدارة
                المنصة.
              </Text>
            </View>
          ) : (
            <View style={styles.chips}>
              {categories.map((category) => {
                const selected = categoryId === category.id;

                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setCategoryId(category.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? colors.primaryLight
                          : colors.surfaceSecondary,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
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
            icon="wallet-outline"
            title="السعر ووحدة البيع"
            colors={colors}
          />

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <AppTextField
                label="السعر"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>

            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.text }]}>العملة</Text>

              <View style={styles.currencyOptions}>
                {(
                  [
                    ["SYP", "ل.س"],
                    ["USD", "دولار"],
                  ] as const
                ).map(([value, label]) => {
                  const selected = currency === value;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => setCurrency(value)}
                      style={[
                        styles.currency,
                        {
                          backgroundColor: selected
                            ? colors.primaryLight
                            : colors.surfaceSecondary,
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyText,
                          {
                            color: selected
                              ? colors.primary
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <AppTextField
                label="وحدة البيع"
                value={unit}
                onChangeText={setUnit}
                placeholder="قطعة، كغ، لتر"
                maxLength={32}
              />
            </View>

            <View style={styles.fieldHalf}>
              <AppTextField
                label="أقل كمية"
                value={minimum}
                onChangeText={setMinimum}
                keyboardType="decimal-pad"
                placeholder="1"
              />
            </View>
          </View>

          <AppTextField
            label="خطوة الكمية"
            value={step}
            onChangeText={setStep}
            keyboardType="decimal-pad"
            placeholder="مثال: 0.1 كغ"
          />

          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            مثال: إذا كانت الوحدة كغ والحد الأدنى 0.5 وخطوة الكمية 0.1، يمكن
            للزبون طلب 0.5 أو 0.6 أو 0.7 كغ.
          </Text>
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
            title="حالة المنتج"
            colors={colors}
          />

          <View
            style={[
              styles.availabilityCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.switchText}>
              <Text style={[styles.availabilityTitle, { color: colors.text }]}>
                {available ? "المنتج متاح للطلب" : "المنتج غير متاح مؤقتًا"}
              </Text>

              <Text
                style={[styles.inlineNote, { color: colors.textSecondary }]}
              >
                يمكنك إيقاف ظهوره للطلب دون حذف المنتج.
              </Text>
            </View>

            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight,
              }}
              thumbColor={available ? colors.primary : colors.surface}
            />
          </View>

          <View style={styles.inventoryNote}>
            <AppIcon
              name="information-circle-outline"
              size={17}
              color={colors.textMuted}
            />

            <Text style={[styles.inventoryText, { color: colors.textMuted }]}>
              التطبيق لا يستخدم جردًا كميًا للمخزون.
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
          <View style={styles.mediaHeader}>
            <SectionHeader
              icon="images-outline"
              title="صور وفيديو المنتج"
              colors={colors}
            />

            <View
              style={[
                styles.mediaCount,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[styles.mediaCountText, { color: colors.textSecondary }]}
              >
                {imageCount}/5 صور
                {hasVideo ? " · فيديو" : ""}
              </Text>
            </View>
          </View>

          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            أضف حتى 5 صور وفيديو واحد اختياري. الحد الأقصى لكل ملف 50 ميغابايت،
            والفيديو حتى دقيقتين.
          </Text>

          <View style={styles.mediaActions}>
            <View style={styles.mediaAction}>
              <AppButton
                title="إضافة صور"
                icon="images-outline"
                variant="outline"
                onPress={() => void pickImages()}
                disabled={imageCount >= 5 || busy}
              />
            </View>

            <View style={styles.mediaAction}>
              <AppButton
                title={hasVideo ? "الفيديو مضاف" : "إضافة فيديو"}
                icon="videocam-outline"
                variant="outline"
                onPress={() => void pickVideo()}
                disabled={hasVideo || busy}
              />
            </View>
          </View>

          {media.length ? (
            <View style={styles.mediaGrid}>
              {media.map((item, index) => (
                <View
                  key={item.key}
                  style={[
                    styles.mediaTile,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {item.type === "image" ? (
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.mediaPreview}
                    />
                  ) : (
                    <View
                      style={[
                        styles.videoPreview,
                        {
                          backgroundColor: colors.primaryLight,
                        },
                      ]}
                    >
                      <AppIcon
                        name="play-circle-outline"
                        size={34}
                        color={colors.primary}
                      />

                      <Text
                        numberOfLines={2}
                        style={[
                          styles.videoName,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {item.fileName}
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.mediaNumber,
                      {
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.mediaNumberText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.type === "image" ? index + 1 : "فيديو"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => removeMedia(item)}
                    disabled={busy}
                    style={[
                      styles.removeMedia,
                      {
                        backgroundColor: colors.error,
                      },
                    ]}
                  >
                    <AppIcon name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.mediaEmpty,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon
                name="images-outline"
                size={28}
                color={colors.textMuted}
              />

              <Text style={[styles.mediaEmptyTitle, { color: colors.text }]}>
                لم تتم إضافة وسائط
              </Text>

              <Text
                style={[styles.mediaEmptyText, { color: colors.textSecondary }]}
              >
                أضف صورًا واضحة تساعد الزبون على معرفة المنتج.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <AppButton
            title={
              busy
                ? "جارٍ حفظ المنتج والوسائط…"
                : productId
                  ? "حفظ التعديلات"
                  : "إضافة المنتج"
            }
            icon="checkmark-outline"
            onPress={() => void save()}
            loading={busy}
            disabled={busy || !categories.length}
          />

          <AppButton
            title="إلغاء"
            variant="outline"
            onPress={() => router.back()}
            disabled={busy}
          />
        </View>
      </ScrollView>

      <AppModal
        visible={Boolean(alert)}
        title="تم الحفظ"
        message={alert}
        onCancel={() => {
          setAlert("");
          router.replace({
            pathname: "/merchant/catalog",
            params: { tab: "products" },
          } as Href);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function SectionHeader({
  icon,
  title,
  colors,
}: {
  icon:
    | "cube-outline"
    | "pricetag-outline"
    | "wallet-outline"
    | "radio-button-on"
    | "images-outline";
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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
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
    marginBottom: Spacing.one,
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

  messageCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },

  messageText: {
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

  label: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },

  inlineNote: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  emptyInline: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },

  chips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  chipText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
  },

  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },

  currencyOptions: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
  },

  currency: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  currencyText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  helperText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  availabilityCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  switchText: {
    flex: 1,
    alignItems: "flex-end",
  },

  availabilityTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  inventoryNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },

  inventoryText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  mediaHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mediaCount: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  mediaCountText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  mediaActions: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },

  mediaAction: {
    flex: 1,
  },

  mediaGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },

  mediaTile: {
    width: 108,
    height: 108,
    borderWidth: 1,
    borderRadius: Radius.md,
    position: "relative",
    overflow: "hidden",
  },

  mediaPreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  videoPreview: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    padding: Spacing.two,
  },

  videoName: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },

  mediaNumber: {
    position: "absolute",
    left: 5,
    bottom: 5,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  mediaNumberText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  removeMedia: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    justifyContent: "center",
    alignItems: "center",
  },

  mediaEmpty: {
    minHeight: 150,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    gap: Spacing.one,
  },

  mediaEmptyTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  mediaEmptyText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },

  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});

import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceCard, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type Category = { id: string; name: string };
type PriceRow = { id: string; price: number | string; currency: string; selling_unit: string; minimum_quantity: number | string; quantity_step: number | string; is_active: boolean; offer_price: number | string | null; offer_starts_at: string | null; offer_ends_at: string | null };
type ProductRow = { id: string; name: string; description: string; category_id: string | null; image_url: string | null; availability: string; store_products: PriceRow[] };
const units = [{ key: "piece", label: "قطعة" }, { key: "kg", label: "كغ" }, { key: "g", label: "غ" }, { key: "l", label: "لتر" }, { key: "ml", label: "مل" }];

export default function MerchantProducts() {
  const { colors } = useTheme();
  const { stores, merchantApproval } = useWorkspace();
  const approvedStores = stores.filter((store) => store.status === "approved");
  const [storeId, setStoreId] = useState("");
  const firstApprovedStoreId = stores.find((store) => store.status === "approved")?.id ?? "";
  const activeStoreId = storeId || firstApprovedStoreId;
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [storeCurrency, setStoreCurrency] = useState<"SYP" | "USD">("SYP");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; detail: string; label: string; danger?: boolean; run: () => Promise<void> } | null>(null);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState(""); const [minimum, setMinimum] = useState("1"); const [step, setStep] = useState("1"); const [unit, setUnit] = useState("piece"); const [currency, setCurrency] = useState<"SYP" | "USD">("SYP"); const [available, setAvailable] = useState(true); const [priceActive, setPriceActive] = useState(true);

  const load = useCallback(async () => {
    if (!activeStoreId) { setProducts([]); setCategories([]); setLoading(false); return; }
    setLoading(true);
    const [categoryResult, productResult, settingsResult] = await Promise.all([
      supabase.from("categories").select("id,name").eq("is_active", true).order("sort_order"),
      supabase.from("products").select("id,name,description,category_id,image_url,availability,store_products(id,price,currency,selling_unit,minimum_quantity,quantity_step,is_active,offer_price,offer_starts_at,offer_ends_at)").eq("store_id", activeStoreId).order("created_at", { ascending: false }),
      supabase.from("store_settings").select("currency").eq("store_id", activeStoreId).maybeSingle(),
    ]);
    setLoading(false);
    if (categoryResult.error || productResult.error || settingsResult.error) { Alert.alert("تعذر تحميل المنتجات", "تحقق من الاتصال وصلاحيات هذا الفرع."); return; }
    setCategories((categoryResult.data ?? []) as Category[]);
    setProducts((productResult.data ?? []) as unknown as ProductRow[]);
    setStoreCurrency((settingsResult.data?.currency as "SYP" | "USD" | null) ?? "SYP");
  }, [activeStoreId]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const clearForm = () => { setEditing(null); setName(""); setDescription(""); setImageUrl(""); setCategoryId(""); setPrice(""); setMinimum("1"); setStep("1"); setUnit("piece"); setCurrency(storeCurrency); setAvailable(true); setPriceActive(true); };
  const openEdit = (product: ProductRow) => {
    const row = product.store_products[0]; if (!row) return;
    setEditing(product); setName(product.name); setDescription(product.description); setImageUrl(product.image_url ?? ""); setCategoryId(product.category_id ?? ""); setPrice(String(row.price)); setMinimum(String(row.minimum_quantity)); setStep(String(row.quantity_step)); setUnit(row.selling_unit); setCurrency(row.currency as "SYP" | "USD"); setAvailable(product.availability === "available"); setPriceActive(row.is_active); setFormVisible(true);
  };
  const saveProduct = async () => {
    const numericPrice = Number(price); const minQuantity = Number(minimum); const quantityStep = Number(step);
    if (!activeStoreId || !name.trim() || !Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isFinite(minQuantity) || minQuantity <= 0 || !Number.isFinite(quantityStep) || quantityStep <= 0 || (imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim()))) {
      Alert.alert("تحقق من البيانات", "أدخل اسمًا وسعرًا وكميات صحيحة، واجعل رابط الصورة يبدأ بـ http أو https."); return;
    }
    setSaving(true);
    const productValues = { name: name.trim(), description: description.trim(), category_id: categoryId || null, image_url: imageUrl.trim() || null, availability: available ? "available" as const : "unavailable" as const };
    if (editing) {
      const { error: productError } = await supabase.from("products").update(productValues).eq("id", editing.id).eq("store_id", activeStoreId);
      if (productError) { setSaving(false); Alert.alert("تعذر تعديل بيانات المنتج", "حاول مرة أخرى."); return; }
      const priceRow = editing.store_products[0];
      const { error: priceError } = await supabase.from("store_products").update({ price: numericPrice, currency, selling_unit: unit, minimum_quantity: minQuantity, quantity_step: quantityStep, is_active: priceActive }).eq("id", priceRow.id).eq("store_id", activeStoreId);
      setSaving(false);
      if (priceError) { Alert.alert("حُفظت بيانات المنتج ولم يُحفظ سعره", "أعد فتح المنتج واحفظ السعر مرة أخرى."); return; }
    } else {
      const { data: product, error: productError } = await supabase.from("products").insert({ store_id: activeStoreId, ...productValues }).select("id").single();
      if (productError || !product) { setSaving(false); Alert.alert("تعذرت إضافة المنتج", "تحقق من الاتصال وصلاحيات الفرع."); return; }
      const { error: priceError } = await supabase.from("store_products").insert({ product_id: product.id, store_id: activeStoreId, price: numericPrice, currency, selling_unit: unit, minimum_quantity: minQuantity, quantity_step: quantityStep, is_active: priceActive });
      setSaving(false);
      if (priceError) { await supabase.from("products").delete().eq("id", product.id).eq("store_id", activeStoreId); Alert.alert("تعذر حفظ سعر المنتج", "لم يكتمل تسجيل المنتج، أعد المحاولة."); return; }
    }
    setFormVisible(false); clearForm(); await load();
  };
  const removeProduct = async (product: ProductRow) => {
    setSaving(true);
    const { error } = await supabase.from("products").delete().eq("id", product.id).eq("store_id", activeStoreId);
    setSaving(false); setConfirm(null);
    if (error) { Alert.alert("تعذر حذف المنتج", "حاول مرة أخرى أو أوقف توفر المنتج بدل حذفه."); return; }
    await load();
  };
  const toggleAvailability = async (product: ProductRow) => {
    const { error } = await supabase.from("products").update({ availability: product.availability === "available" ? "unavailable" : "available" }).eq("id", product.id).eq("store_id", activeStoreId);
    if (error) Alert.alert("تعذر تحديث التوفر", "حاول مرة أخرى."); else await load();
  };

  return <WorkspaceFrame title="المنتجات">
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <WorkspaceTitle title="منتجات متاجرك" detail="أدر بيانات المنتجات وأسعار كل فرع وتوفرها. المنتجات لا تحتاج موافقة إدارية." />
      {approvedStores.length > 1 ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginTop: 10 }}>{approvedStores.map((store) => <Pressable key={store.id} accessibilityRole="radio" accessibilityState={{ selected: store.id === activeStoreId }} onPress={() => setStoreId(store.id)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: store.id === activeStoreId ? colors.primary : colors.surface, borderWidth: 1, borderColor: store.id === activeStoreId ? colors.primary : colors.border }}><Text style={{ color: store.id === activeStoreId ? colors.surface : colors.text }}>{store.name}</Text></Pressable>)}</View> : null}
      {merchantApproval !== "approved" ? <Text style={{ margin: 16, textAlign: "right", color: colors.textSecondary }}>تتاح إدارة المنتجات بعد اعتماد حساب التاجر.</Text> : null}
      {merchantApproval === "approved" && !approvedStores.length ? <WorkspaceEmptyState icon="storefront-outline" title="لا يوجد متجر معتمد بعد" detail="سيصبح بإمكانك إضافة المنتجات بعد اعتماد أول فرع." /> : null}
      {merchantApproval === "approved" && activeStoreId ? <WorkspaceButton title="إضافة منتج" onPress={() => { clearForm(); setFormVisible(true); }} disabled={saving || loading} /> : null}
      <WorkspaceTitle title="قائمة المنتجات" detail={approvedStores.find((store) => store.id === activeStoreId)?.name} />
      {loading ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>جارٍ تحميل المنتجات…</Text> : null}
      {products.map((product) => {
        const row = product.store_products[0];
        return <View key={product.id}>
          <WorkspaceCard title={product.name} detail={`${product.availability === "available" ? "متاح" : "غير متاح"} · ${row ? `${Number(row.price).toLocaleString("en-US")} ${row.currency} لكل ${row.selling_unit}` : "لا يوجد سعر"} · ${row?.is_active ? "السعر منشور" : "السعر متوقف"}${row?.offer_price != null ? ` · عرض ${Number(row.offer_price).toLocaleString("en-US")}` : ""}`} icon="pricetag-outline" />
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginHorizontal: 16, marginTop: 7 }}>
            <Pressable onPress={() => openEdit(product)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primaryLight }}><Text style={{ color: colors.primary }}>تعديل التفاصيل والسعر</Text></Pressable>
            <Pressable onPress={() => void toggleAvailability(product)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}><Text style={{ color: colors.text }}>{product.availability === "available" ? "إيقاف التوفر" : "إتاحة المنتج"}</Text></Pressable>
            <Pressable onPress={() => setConfirm({ title: "حذف المنتج", detail: `سيُحذف «${product.name}» من كتالوج الفرع، وقد تزال إضافته من سلال العملاء. تبقى تفاصيل الطلبات السابقة محفوظة.`, label: "حذف المنتج", danger: true, run: () => removeProduct(product) })} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.error + "18" }}><Text style={{ color: colors.error }}>حذف</Text></Pressable>
          </View>
        </View>;
      })}
      {!loading && activeStoreId && !products.length ? <WorkspaceEmptyState icon="pricetag-outline" title="لا توجد منتجات في هذا الفرع" detail="ابدأ بإضافة المنتجات وأسعار البيع ووحدات الكمية." /> : null}
    </ScrollView>
    <WorkspaceFormModal visible={formVisible} title={editing ? "تعديل المنتج" : "إضافة منتج"} detail="السعر والعملة ووحدات البيع تخص هذا الفرع." onClose={() => { if (!saving) { setFormVisible(false); clearForm(); } }}>
      <WorkspaceField label="اسم المنتج" value={name} onChangeText={setName} />
      <WorkspaceField label="التفاصيل والوصف" value={description} onChangeText={setDescription} />
      <WorkspaceField label="رابط صورة المنتج (اختياري)" value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" />
      <Text style={{ marginHorizontal: 16, marginTop: 14, textAlign: "right", color: colors.text, fontWeight: "600" }}>التصنيف</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", marginHorizontal: 16, marginTop: 8, gap: 8 }}>{categories.map((category) => <Pressable key={category.id} accessibilityRole="radio" accessibilityState={{ selected: category.id === categoryId }} onPress={() => setCategoryId(category.id === categoryId ? "" : category.id)} style={{ padding: 9, borderRadius: 10, backgroundColor: category.id === categoryId ? colors.primary : colors.surface, borderWidth: 1, borderColor: category.id === categoryId ? colors.primary : colors.border }}><Text style={{ color: category.id === categoryId ? colors.surface : colors.text }}>{category.name}</Text></Pressable>)}</View>
      <WorkspaceField label={`السعر (${currency})`} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <WorkspaceField label="الحد الأدنى للكمية" value={minimum} onChangeText={setMinimum} keyboardType="numeric" />
      <WorkspaceField label="خطوة الكمية" value={step} onChangeText={setStep} keyboardType="numeric" />
      <Text style={{ marginHorizontal: 16, marginTop: 14, textAlign: "right", color: colors.text, fontWeight: "600" }}>وحدة البيع</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", marginHorizontal: 16, marginTop: 8, gap: 8 }}>{units.map((item) => <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ selected: unit === item.key }} onPress={() => setUnit(item.key)} style={{ padding: 9, borderRadius: 10, backgroundColor: unit === item.key ? colors.primary : colors.surface, borderWidth: 1, borderColor: unit === item.key ? colors.primary : colors.border }}><Text style={{ color: unit === item.key ? colors.surface : colors.text }}>{item.label}</Text></Pressable>)}</View>
      <Text style={{ marginHorizontal: 16, marginTop: 14, textAlign: "right", color: colors.textSecondary }}>عملة السعر لهذا الفرع: {storeCurrency}</Text>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: available }} onPress={() => setAvailable((value) => !value)} style={{ marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: available ? colors.primaryLight : colors.surface }}><Text style={{ textAlign: "right", color: available ? colors.primary : colors.textSecondary }}>{available ? "المنتج متاح للبيع" : "المنتج غير متاح للبيع"}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: priceActive }} onPress={() => setPriceActive((value) => !value)} style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: priceActive ? colors.primaryLight : colors.surface }}><Text style={{ textAlign: "right", color: priceActive ? colors.primary : colors.textSecondary }}>{priceActive ? "السعر منشور في هذا الفرع" : "السعر متوقف في هذا الفرع"}</Text></Pressable>
      <WorkspaceButton title={saving ? "جارٍ الحفظ…" : editing ? "حفظ تعديلات المنتج" : "إضافة المنتج والسعر"} onPress={() => void saveProduct()} disabled={saving} />
    </WorkspaceFormModal>
    <WorkspaceConfirmModal visible={confirm !== null} title={confirm?.title ?? "تأكيد"} detail={confirm?.detail ?? ""} confirmLabel={confirm?.label} danger={confirm?.danger} busy={saving} onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) void confirm.run(); }} />
  </WorkspaceFrame>;
}

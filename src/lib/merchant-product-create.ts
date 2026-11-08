import { sellingUnitOptions } from "@/constants/selling-units";

export const maxMediaBytes = 50 * 1024 * 1024;
export type ProductMediaDraft = { key: string; uri: string; name: string; type: "image" | "video"; mime: string; size: number; duration?: number };
export type ProductForm = { title: string; description: string; categoryId: string; price: string; unit: string; minimum: string; step: string; available: boolean };
export const emptyProductForm: ProductForm = { title: "", description: "", categoryId: "", price: "", unit: "قطعة", minimum: "1", step: "1", available: true };
export type ProductValues = { store_id: string; title: string; description: string; category_id: string; price: number; selling_unit: string; minimum_quantity: number; quantity_step: number };
export function parseProductNumber(input: string, precision: number, scale: number): number {
  const text = input.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/٫/g, ".");
  if (/[,،٬]/.test(text)) throw new Error("استخدم النقطة أو الفاصل العشري ٫ دون فواصل آلاف؛ الفاصلة ملتبسة.");
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("أدخل عددًا موجبًا، دون رموز أو صيغة أسية.");
  const [integer, fraction = ""] = text.split(".");
  if (fraction.length > scale) throw new Error(`الحد الأقصى ${scale} منازل عشرية؛ لن نقرّب القيمة تلقائيًا.`);
  if (integer.replace(/^0+/, "").length > precision - scale) throw new Error("القيمة تتجاوز الحد المسموح.");
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) throw new Error("أدخل قيمة أكبر من صفر.");
  return value;
}
export function validateProduct(form: ProductForm, categories: readonly { id: string }[]) {
  const errors: Partial<Record<keyof ProductForm, string>> = {};
  if ([...form.title.trim()].length < 2 || [...form.title.trim()].length > 140) errors.title = "اسم المنتج مطلوب، من 2 إلى 140 حرفًا.";
  if ([...form.description].length > 5000) errors.description = "الحد الأقصى للوصف 5000 حرف.";
  if (!categories.some(category => category.id === form.categoryId)) errors.categoryId = "اختر تصنيفًا نشطًا للمنتج.";
  if (!sellingUnitOptions("").some(option => option.value === form.unit)) errors.unit = "اختر وحدة بيع معتمدة.";
  const numbers = { price: 0, minimum: 0, step: 0 };
  for (const field of ["price", "minimum", "step"] as const) {
    try { numbers[field] = parseProductNumber(form[field], field === "price" ? 14 : 12, field === "price" ? 2 : 3); }
    catch (error) { errors[field] = (error as Error).message; }
  }
  return { errors, numbers };
}
export function appendProductMedia(previous: ProductMediaDraft[], picked: ProductMediaDraft[]) {
  const combined = [...previous, ...picked];
  for (const item of combined) {
    const allowed = item.type === "image" ? ["image/jpeg","image/png","image/webp","image/heic"] : ["video/mp4","video/quicktime","video/webm"];
    if (!allowed.includes(item.mime) || !Number.isSafeInteger(item.size) || item.size <= 0 || item.size > maxMediaBytes) throw new Error("تحقق من صيغة الملف وحجمه؛ الحد 50 MiB.");
    if (item.type === "video" && (!Number.isFinite(item.duration) || !item.duration || item.duration < 0 || item.duration > 120_000)) throw new Error("تعذر تأكيد مدة الفيديو ضمن دقيقتين.");
  }
  if (combined.filter(item => item.type === "image").length > 5 || combined.filter(item => item.type === "video").length > 1) throw new Error("الحد خمس صور وفيديو واحد؛ لم نُضف الاختيار الزائد.");
  return combined;
}
export function inspectProductMedia(bytes: Uint8Array, type: "image" | "video"): string {
  if (!bytes.byteLength || bytes.byteLength > maxMediaBytes) throw new Error("يجب أن يكون الملف غير فارغ وألا يتجاوز 50 MiB.");
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  let mime = "";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = "image/jpeg";
  else if ([137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) mime = "image/png";
  else if (ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP") mime = "image/webp";
  else if (ascii(4,8) === "ftyp") {
    const brands = ascii(8, Math.min(bytes.length,64));
    mime = /avif|avis/.test(brands) ? "" : /heic|heix|hevc|hevx/.test(brands) ? "image/heic" : brands.includes("qt  ") ? "video/quicktime" : /isom|iso2|mp4|avc1|M4V|MSNV/.test(brands) ? "video/mp4" : "";
  } else if ([26,69,223,163].every((value,index) => bytes[index] === value)) mime = "video/webm";
  if (!mime || !mime.startsWith(type + "/")) throw new Error("تعذر تأكيد صيغة الملف. استخدم JPEG أو PNG أو WebP أو HEIC، أو MP4 أو MOV أو WebM.");
  return mime;
}
export function newProductKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Identifiers only, never an authentication/security token. PK uniqueness is authoritative.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => { const n = Math.floor(Math.random() * 16); return (char === "x" ? n : (n & 3) | 8).toString(16); });
}
export type ProductAttempt = { version: 1; ownerId: string; storeId: string; id: string; form: ProductForm; values: ProductValues; media: (ProductMediaDraft & { path: string; rowId: string })[] };
export function productAttempt(ownerId: string, storeId: string, form: ProductForm, media: ProductMediaDraft[], categories: { id: string }[]): ProductAttempt {
  const { errors, numbers } = validateProduct(form, categories);
  if (Object.keys(errors).length) throw new Error("راجع الحقول المطلوبة.");
  appendProductMedia([], media);
  const id = newProductKey();
  return { version: 1, ownerId, storeId, id, form: { ...form }, values: { store_id: storeId, title: form.title.trim(), description: form.description.trim(), category_id: form.categoryId, price: numbers.price, selling_unit: form.unit, minimum_quantity: numbers.minimum, quantity_step: numbers.step }, media: media.map(item => {
    const rowId = newProductKey(), extension = item.mime === "image/jpeg" ? "jpg" : item.mime === "video/quicktime" ? "mov" : item.mime.split("/")[1];
    return { ...item, rowId, path: `${storeId}/products/${id}/${rowId}.${extension}` };
  }) };
}
export type ConfirmedProduct = ProductValues & { id: string; is_available: boolean };
export type ConfirmedMedia = { id: string; storage_path: string; media_type: "image" | "video"; display_order: number };
export type ProductCreateApi = {
  persist: (attempt: ProductAttempt) => Promise<void>;
  assertScope: (attempt: ProductAttempt) => Promise<void>;
  category: (id: string) => Promise<boolean>;
  product: (attempt: ProductAttempt) => Promise<ConfirmedProduct | null>;
  insert: (attempt: ProductAttempt) => Promise<void>;
  files: (attempt: ProductAttempt) => Promise<{ name: string; size: number; mime: string }[]>;
  upload: (item: ProductAttempt["media"][number]) => Promise<void>;
  media: (attempt: ProductAttempt) => Promise<ConfirmedMedia[]>;
  link: (attempt: ProductAttempt, item: ProductAttempt["media"][number], index: number) => Promise<void>;
  available: (attempt: ProductAttempt) => Promise<void>;
};
function matchesProduct(product: ConfirmedProduct | null, attempt: ProductAttempt) {
  return product && Object.entries(attempt.values).every(([key,value]) => product[key as keyof ProductValues] === value);
}
function matchesMedia(rows: ConfirmedMedia[], attempt: ProductAttempt) {
  return rows.length === attempt.media.length && attempt.media.every((item,index) => rows.some(row => row.id === item.rowId && row.storage_path === item.path && row.media_type === item.type && row.display_order === index));
}
/** Same IDs/paths on every retry. Never compensate by deleting uncertain writes. */
export function createProductSaver(api: ProductCreateApi) {
  let locked = false;
  return {
    isBusy: () => locked,
    async save(attempt: ProductAttempt, progress: (message: string) => void): Promise<boolean> {
      if (locked) return false;
      locked = true;
      try {
        await api.persist(attempt); // Must be durable before the first remote write.
        progress("التحقق من المتجر والتصنيف…");
        await api.assertScope(attempt);
        if (!await api.category(attempt.values.category_id)) throw new Error("التصنيف غير متاح حاليًا؛ راجع الكتالوج قبل إعادة المحاولة.");
        let product = await api.product(attempt);
        if (!product) {
          progress("إنشاء المنتج غير المتاح…");
          try { await api.insert(attempt); } catch { /* Read back; never allocate another ID. */ }
          product = await api.product(attempt);
        }
        if (!matchesProduct(product,attempt)) throw new Error("تعذر تأكيد بيانات المنتج المحفوظة.");
        let rows = await api.media(attempt);
        if (rows.some(row => !attempt.media.some(item => item.rowId === row.id && item.path === row.storage_path))) throw new Error("تغيرت الوسائط المحفوظة؛ راجع المنتج من الكتالوج.");
        if (product!.is_available && (!attempt.form.available || !matchesMedia(rows,attempt))) throw new Error("تغيرت حالة المنتج؛ راجعه من الكتالوج قبل المتابعة.");
        for (const [index,item] of attempt.media.entries()) {
          await api.assertScope(attempt);
          progress(`التحقق من الوسائط ${index + 1} / ${attempt.media.length}…`);
          let files = await api.files(attempt);
          const name = item.path.split("/").at(-1);
          if (!files.some(file => file.name === name)) {
            try { await api.upload(item); } catch { /* A timeout may still have stored the file. */ }
            files = await api.files(attempt);
          }
          if (!files.some(file => file.name === name && file.size === item.size && file.mime === item.mime)) throw new Error("تعذر تأكيد رفع الملف وحجمه وصيغته.");
          if (!rows.some(row => row.id === item.rowId && row.storage_path === item.path && row.display_order === index && row.media_type === item.type)) {
            try { await api.link(attempt,item,index); } catch { /* Reconcile by stable row ID. */ }
            rows = await api.media(attempt);
          }
          if (!rows.some(row => row.id === item.rowId && row.storage_path === item.path && row.display_order === index && row.media_type === item.type)) throw new Error("تعذر تأكيد ربط الوسائط.");
        }
        rows = await api.media(attempt);
        if (!matchesMedia(rows,attempt)) throw new Error("تعذر تأكيد قائمة الوسائط.");
        await api.assertScope(attempt);
        if (!await api.category(attempt.values.category_id)) throw new Error("لم يعد التصنيف متاحًا.");
        progress("تأكيد حالة التوفر…");
        if (product!.is_available !== attempt.form.available) {
          try { await api.available(attempt); } catch { /* Confirm requested state, including after lost acknowledgement. */ }
        }
        product = await api.product(attempt);
        if (!matchesProduct(product,attempt) || product!.is_available !== attempt.form.available) throw new Error("تعذر تأكيد حالة التوفر.");
        return true;
      } finally { locked = false; }
    },
  };
}
export function productExitDecision(dirty: boolean, busy: boolean) { return busy ? "busy" : dirty ? "confirm" : "leave"; }

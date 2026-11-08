import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { appendProductMedia, createProductSaver, inspectProductMedia, maxMediaBytes, validateProduct, type ProductAttempt, type ProductCreateApi, type ProductMediaDraft } from "@/lib/merchant-product-create";

const attemptKey = (ownerId: string, storeId: string) => `@tasawuq/product-create/syp-v1/${ownerId}/${storeId}`;
export async function readProductIdentity(ownerId: string, signal?: AbortSignal) {
  let merchantQuery = supabase.from("merchants").select("id,status").eq("owner_user_id",ownerId);
  if (signal) merchantQuery = merchantQuery.abortSignal(signal);
  const merchant = await merchantQuery.maybeSingle();
  if (merchant.error) throw merchant.error;
  if (!merchant.data || merchant.data.status !== "accepted") throw new Error("المتجر غير متاح للإضافة.");
  let storeQuery = supabase.from("stores").select("id,name,status").eq("merchant_id",merchant.data.id);
  if (signal) storeQuery = storeQuery.abortSignal(signal);
  const store = await storeQuery.maybeSingle();
  if (store.error) throw store.error;
  if (!store.data || store.data.status !== "accepted") throw new Error("المتجر غير متاح للإضافة.");
  return store.data;
}
export async function readProductCategories(signal?: AbortSignal) {
  let query = supabase.from("product_categories").select("id,name").eq("is_active",true).order("sort_order").order("id");
  if (signal) query = query.abortSignal(signal);
  const result = await query;
  if (result.error) throw result.error;
  return result.data ?? [];
}
export async function readProductAttempt(ownerId: string, storeId: string): Promise<ProductAttempt | null> {
  // Unlike a disposable catalogue cache, read failure must NOT mean no pending write.
  const text = await AsyncStorage.getItem(attemptKey(ownerId,storeId));
  if (!text) return null;
  const attempt = JSON.parse(text) as ProductAttempt;
  if (attempt.version !== 1 || attempt.ownerId !== ownerId || attempt.storeId !== storeId || !/^[0-9a-f-]{36}$/i.test(attempt.id) || !attempt.form || !attempt.values || !Array.isArray(attempt.media)) throw new Error("Invalid saved attempt");
  const validation = validateProduct(attempt.form,[{id:attempt.form.categoryId}]);
  if (Object.keys(validation.errors).length || attempt.values.store_id !== storeId || attempt.values.title !== attempt.form.title.trim() || attempt.values.description !== attempt.form.description.trim() || attempt.values.category_id !== attempt.form.categoryId || attempt.values.selling_unit !== attempt.form.unit || attempt.values.price !== validation.numbers.price || attempt.values.minimum_quantity !== validation.numbers.minimum || attempt.values.quantity_step !== validation.numbers.step || typeof attempt.form.available !== "boolean") throw new Error("Invalid saved values");
  if (attempt.media.filter(item=>item.type==='image').length > 5 || attempt.media.filter(item=>item.type==='video').length > 1 || attempt.media.some(item => !['image','video'].includes(item.type) || typeof item.uri !== 'string' || typeof item.name !== 'string' || typeof item.key !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.rowId) || !item.path.startsWith(`${storeId}/products/${attempt.id}/${item.rowId}.`) || !Number.isSafeInteger(item.size) || item.size <= 0 || item.size > maxMediaBytes)) throw new Error("Invalid saved media");
  appendProductMedia([],attempt.media);
  return attempt;
}
export async function clearProductAttempt(attempt: ProductAttempt) {
  const saved = await readProductAttempt(attempt.ownerId,attempt.storeId);
  if (saved && saved.id !== attempt.id) throw new Error("Another attempt is pending");
  if (saved) await AsyncStorage.removeItem(attemptKey(attempt.ownerId,attempt.storeId));
}
/** Explicit discard ends local tracking only after positively locating the owned row. */
export async function abandonProductAttempt(attempt: ProductAttempt, isCurrent: () => boolean, api = createProductApi(isCurrent)) {
  await api.assertScope(attempt);
  const product = await api.product(attempt);
  if (!product || !isCurrent()) return false;
  await clearProductAttempt(attempt);
  return true;
}
export async function inspectLocalProductMedia(uri: string, type: "image" | "video") {
  const file = new File(uri);
  if (!file.exists || !file.size || file.size > maxMediaBytes) throw new Error("تعذر قراءة الملف، أو أن حجمه يتجاوز 50 MiB.");
  const buffer = await file.arrayBuffer();
  const mime = inspectProductMedia(new Uint8Array(buffer),type);
  return { size:buffer.byteLength, mime, buffer };
}
export function createProductApi(isCurrent: () => boolean): ProductCreateApi {
  const current = () => { if (!isCurrent()) throw new Error("Screen/account changed"); };
  return {
    async persist(attempt) {
      current();
      const previous = await readProductAttempt(attempt.ownerId,attempt.storeId);
      if (previous && previous.id !== attempt.id) throw new Error("Another attempt is pending");
      await AsyncStorage.setItem(attemptKey(attempt.ownerId,attempt.storeId),JSON.stringify(attempt));
    },
    async assertScope(attempt) {
      current();
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== attempt.ownerId) throw new Error("Account changed");
      const store = await readProductIdentity(attempt.ownerId);
      current();
      if (store.id !== attempt.storeId) throw new Error("Store changed");
    },
    async category(id) {
      current();
      const result = await supabase.from("product_categories").select("id").eq("id",id).eq("is_active",true).maybeSingle();
      if (result.error) throw result.error;
      return Boolean(result.data);
    },
    async product(attempt) {
      current();
      const result = await supabase.from("products").select("id,store_id,title,description,category_id,price,selling_unit,minimum_quantity,quantity_step,is_available").eq("id",attempt.id).eq("store_id",attempt.storeId).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    async insert(attempt) {
      current();
      const result = await supabase.from("products").insert({id:attempt.id,...attempt.values,is_available:false});
      if (result.error) throw result.error;
    },
    async files(attempt) {
      current();
      const result = await supabase.storage.from("store-media").list(`${attempt.storeId}/products/${attempt.id}`, {limit:100});
      if (result.error) throw result.error;
      return (result.data ?? []).map(file => ({name:file.name,size:Number(file.metadata?.size),mime:String(file.metadata?.mimetype ?? "")}));
    },
    async upload(item) {
      current();
      const actual = await inspectLocalProductMedia(item.uri,item.type);
      current();
      if (actual.mime !== item.mime || actual.size !== item.size) throw new Error("Selected file changed");
      const result = await supabase.storage.from("store-media").upload(item.path,actual.buffer,{contentType:item.mime,upsert:false});
      if (result.error) throw result.error;
    },
    async media(attempt) {
      current();
      const result = await supabase.from("product_media").select("id,storage_path,media_type,display_order").eq("product_id",attempt.id).eq("store_id",attempt.storeId).order("display_order");
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    async link(attempt,item,index) {
      current();
      const result = await supabase.from("product_media").insert({id:item.rowId,store_id:attempt.storeId,product_id:attempt.id,storage_path:item.path,media_type:item.type,display_order:index,alt_text:item.name.slice(0,180)});
      if (result.error) throw result.error;
    },
    async available(attempt) {
      current();
      const result = await supabase.from("products").update({is_available:attempt.form.available}).eq("id",attempt.id).eq("store_id",attempt.storeId);
      if (result.error) throw result.error;
    },
  };
}
export type { ProductMediaDraft };

export function createProductCreationSession() {
  let active = false;
  return {
    saver: createProductSaver(createProductApi(() => active)),
    activate() { active = true; },
    deactivate() { active = false; },
  };
}

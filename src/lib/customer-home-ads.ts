import { File } from "expo-file-system";
import { assertAccount } from "@/lib/personal-account";
import { newIdempotencyKey } from "@/lib/request-key";
import { checkBrandingSignature, validateBrandingInput } from "@/lib/store-branding-contract";
import { supabase } from "@/lib/supabase";
import type { Database, Tables } from "@/types/database";

export type HomeAd = Tables<"customer_home_ads">;
export type HomeAdInput = Database["public"]["Tables"]["customer_home_ads"]["Insert"];
const bucket = "customer-home-ads";

export async function listHomeAds(owner: string, signal: AbortSignal) {
  await assertAccount(owner);
  const { data, error } = await supabase.from("customer_home_ads").select("*")
    .order("priority", { ascending: false }).order("id").abortSignal(signal);
  await assertAccount(owner);
  if (error) throw error;
  return data ?? [];
}

export async function uploadHomeAd(owner: string, id: string, uri: string, mime: string, thumbnailUri?: string) {
  const kind = mime === "video/mp4" ? "video" : "image";
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" }[mime];
  let bytes: ArrayBuffer;
  try {
    const file = new File(uri);
    const size = file.size;
    validateBrandingInput(kind === "image" ? "logo" : "promo_video", mime, size);
    bytes = await file.arrayBuffer();
    if (bytes.byteLength !== size) throw Error("File size changed");
    checkBrandingSignature(mime, bytes);
  } catch {
    throw Error(kind === "video" ? "تعذر تجهيز الفيديو للرفع. أعد اختيار ملف MP4 صالح."
      : "تعذر تجهيز الصورة للرفع. أعد اختيار الملف.");
  }
  await assertAccount(owner);
  const version = id + "/" + newIdempotencyKey();
  const path = version + "." + extension;
  const storage = supabase.storage.from(bucket);
  const thumbnail_path = kind === "video" && thumbnailUri ? version + ".jpg" : null;
  if (kind === "video" && !thumbnail_path) throw Error("اختر فيديو له صورة مصغرة قبل الحفظ.");
  if (thumbnail_path && thumbnailUri) {
    let thumbnailBytes: ArrayBuffer;
    try {
      thumbnailBytes = await new File(thumbnailUri).arrayBuffer();
      validateBrandingInput("logo", "image/jpeg", thumbnailBytes.byteLength);
      checkBrandingSignature("image/jpeg", thumbnailBytes);
    } catch {
      throw Error("تعذرت قراءة الصورة المصغرة للرفع. أعد استخراجها أو اختر الفيديو مرة أخرى.");
    }
    await assertAccount(owner);
    const result = await storage.upload(thumbnail_path, thumbnailBytes, { contentType: "image/jpeg", upsert: false }).catch(() => null);
    if (!result || result.error) throw Error("تعذر رفع الصورة المصغرة للإعلان. تحقق من الاتصال ثم أعد الحفظ.");
  }
  await assertAccount(owner);
  const result = await storage.upload(path, bytes, { contentType: mime, upsert: false }).catch(() => null);
  await assertAccount(owner);
  if (!result || result.error) {
    if (thumbnail_path) await storage.remove([thumbnail_path]).catch(() => {});
    throw Error(kind === "video" ? "تعذر رفع الفيديو. تحقق من الاتصال ثم أعد الحفظ." : "تعذر رفع الصورة. تحقق من الاتصال ثم أعد الحفظ.");
  }
  return { media_kind: kind, media_path: path, thumbnail_path } as const;
}

export async function previewHomeAd(owner: string, path: string) {
  await assertAccount(owner);
  const result = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  await assertAccount(owner);
  if (result.error || !result.data) throw Error("تعذر فتح المعاينة.");
  return result.data.signedUrl;
}

export async function saveHomeAd(owner: string, input: HomeAdInput, previous?: HomeAd) {
  await assertAccount(owner);
  const table = supabase.from("customer_home_ads");
  const result = await (previous ? table.update(input).eq("id", previous.id).eq("updated_at", previous.updated_at) : table.insert(input))
    .select("id").maybeSingle();
  await assertAccount(owner);
  if (result.error?.code === "22023") throw Error("تحقق من أن الوسيط موجود والوجهة متاحة عند بدء الإعلان.");
  if (result.error || !result.data) throw Error("تعذر تأكيد الحفظ. حدّث القائمة قبل إعادة المحاولة.");
}

export async function deleteHomeAd(owner: string, previous: HomeAd) {
  await assertAccount(owner);
  const result = await supabase.from("customer_home_ads").delete()
    .eq("id", previous.id).eq("updated_at", previous.updated_at).select("id").maybeSingle();
  await assertAccount(owner);
  if (result.error || !result.data) throw Error("تعذر تأكيد الحذف. حدّث القائمة قبل إعادة المحاولة.");
}

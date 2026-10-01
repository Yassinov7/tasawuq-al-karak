import { supabase } from "@/lib/supabase";

export type MerchantStore = {
  id: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  status: string;
  merchant_id: string;
};

export async function getMerchantStore(userId: string) {
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id,status")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (merchantError) throw merchantError;
  if (!merchant) return null;

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,name,description,phone,address,status,merchant_id")
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (storeError) throw storeError;
  return store as MerchantStore | null;
}

export function getStoreMediaUrl(path: string) {
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}

export function getMediaExtension(mimeType: string, fileName?: string | null) {
  const filenameExtension = fileName?.split(".").pop()?.toLowerCase();
  if (filenameExtension && /^[a-z0-9]{2,5}$/.test(filenameExtension)) return filenameExtension;
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return extensions[mimeType] ?? "bin";
}

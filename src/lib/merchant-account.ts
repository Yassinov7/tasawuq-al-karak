import { readCategoryLabels } from "@/lib/catalog-categories";
import {readPersonalAccount,savePersonalAccount,assertAccount} from "@/lib/personal-account";
import { getMerchantStore } from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";
import { invalidateLocalCache } from "@/lib/local-cache";
import {profileGenders, type ProfileAgeRange} from "@/types/profile-demographics";

export async function loadMerchantIdentity(userId: string) {
  const [profile, info] = await Promise.all([
    readPersonalAccount(userId),
    loadMerchantStoreInfo(userId),
  ]);
  await assertAccount(userId);
  return { profile, ...info };
}

export async function loadMerchantStoreInfo(userId: string) {
  await assertAccount(userId);
  const store = await getMerchantStore(userId);
  let categoryName = "غير محدد";
  if (store?.category_id) {
    const label = (await readCategoryLabels("store", [store.category_id])).get(store.category_id);
    categoryName = label ? label.name + (label.is_active ? "" : " · غير متاح للاختيار") : "غير متاح";
  }
  await assertAccount(userId);
  return { store, categoryName };
}
export type MerchantIdentity = Awaited<ReturnType<typeof loadMerchantIdentity>>;

export async function saveMerchantProfile(userId: string, fullName: string, ageRange: ProfileAgeRange | null, genderChange?: string | null) {
 const base=await readPersonalAccount(userId);
 const gender=genderChange===undefined?base.gender:genderChange===null?null:profileGenders.find(g=>g===genderChange);
 if(gender===undefined)throw Error('اختر قيمة صحيحة للجنس.');
 return savePersonalAccount(userId,base,{full_name:fullName,age_range:ageRange,gender});
}

export type StoreInfoDraft = { name: string; description: string; phone: string; address: string };
export function validateMerchantStoreInfo(draft: StoreInfoDraft) {
  const values = { name: draft.name.trim(), description: draft.description.trim(), phone: draft.phone.trim(), address: draft.address.trim() };
  const errors: Partial<Record<keyof StoreInfoDraft, string>> = {};
  if (values.name.length < 2 || values.name.length > 120) errors.name = "أدخل اسم متجر من حرفين إلى 120 حرفًا.";
  if (!/^[+\d٠-٩۰-۹\s()-]{5,32}$/.test(values.phone) || values.phone.replace(/[^\d٠-٩۰-۹]/g, "").length < 5) errors.phone = "أدخل رقم تواصل صحيحًا من 5 إلى 32 محرفًا.";
  if (values.address.length < 3 || values.address.length > 300) errors.address = "أدخل عنوانًا من 3 إلى 300 حرف.";
  if (values.description.length > 5000) errors.description = "الوصف أطول من الحد المسموح (5000 حرف).";
  return { values, errors };
}

export async function saveMerchantStoreInfo(userId: string, storeId: string, draft: StoreInfoDraft) {
  const { values, errors } = validateMerchantStoreInfo(draft);
  const firstError = Object.values(errors)[0];
  if (firstError) throw new Error(firstError);
  await assertAccount(userId);
  const owned = await getMerchantStore(userId);
  if (!owned || owned.id !== storeId) throw new Error("تعذر التحقق من صلاحية تعديل المتجر.");
  await assertAccount(userId);
  const result = await supabase.from("stores").update(values).eq("id", storeId).eq("merchant_id", owned.merchant_id)
    .select("id,name,description,phone,address,status,merchant_id,category_id").single();
  await assertAccount(userId);
  if (result.error || !result.data) throw new Error("تعذر حفظ بيانات المتجر. لم تُمسح تعديلاتك؛ حاول مجددًا.");
  await Promise.all([invalidateLocalCache(`merchant-account:${userId}`), invalidateLocalCache(`merchant-home:${userId}`)]);
  return result.data;
}

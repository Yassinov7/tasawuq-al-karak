import {readPersonalAccount,savePersonalAccount,assertAccount} from "@/lib/personal-account";
import { getMerchantStore } from "@/lib/merchant-store";
import { supabase } from "@/lib/supabase";
import { invalidateLocalCache } from "@/lib/local-cache";
import { loadMerchantFinancialAccount } from "@/lib/merchant-financial-account";
import {profileGenders, type ProfileAgeRange} from "@/types/profile-demographics";

// Migration 004 exists in the project but these two tables are absent from the
// checked-in generated types. Keep the read-only bridge limited to those tables.
type OwnRead<T> = {
  select: (columns: string) => OwnRead<T>;
  eq: (column: string, value: string) => OwnRead<T>;
  is: (column: string, value: null) => OwnRead<T>;
  order: (column: string, options: { ascending: boolean }) => OwnRead<T>;
  limit: (count: number) => OwnRead<T>;
  maybeSingle: () => PromiseLike<{ data: T | null; error: { message: string } | null }>;
};
const subscriptionReads = supabase as unknown as {
  from(table: "merchant_billing_settings"): OwnRead<{ auto_renew: boolean }>;
  from(table: "merchant_subscription_plan_changes"): OwnRead<{ id: string; plan_name_snapshot: string; selected_at: string }>;
};

export async function loadMerchantIdentity(userId: string) {
  const [profile, store] = await Promise.all([
    readPersonalAccount(userId),
    getMerchantStore(userId),
  ]);
  await assertAccount(userId);
  let categoryName = "غير محدد";
  if (store?.category_id) {
    const category = await supabase.from("store_categories").select("name").eq("id", store.category_id).maybeSingle();
    if (category.error) throw category.error;
    categoryName = category.data?.name ?? "غير متاح";
  }
  await assertAccount(userId);
  return { profile, store, categoryName };
}
export type MerchantIdentity = Awaited<ReturnType<typeof loadMerchantIdentity>>;

export async function saveMerchantProfile(userId: string, fullName: string, ageRange: ProfileAgeRange | null, genderChange?: string | null) {
 const base=await readPersonalAccount(userId);
 const gender=genderChange===undefined?base.gender:genderChange===null?null:profileGenders.find(g=>g===genderChange);
 if(gender===undefined)throw Error('اختر قيمة صحيحة للجنس.');
 return savePersonalAccount(userId,base,{full_name:fullName,age_range:ageRange,gender});
}

export type StoreInfoDraft = { name: string; description: string; phone: string; address: string };
export async function saveMerchantStoreInfo(userId: string, storeId: string, draft: StoreInfoDraft) {
  const values = { name: draft.name.trim(), description: draft.description.trim(), phone: draft.phone.trim(), address: draft.address.trim() };
  if (values.name.length < 2 || values.name.length > 120) throw new Error("أدخل اسم متجر من حرفين إلى 120 حرفًا.");
  if (!/^[+\d٠-٩۰-۹\s()-]{5,32}$/.test(values.phone) || values.phone.replace(/[^\d٠-٩۰-۹]/g, "").length < 5) throw new Error("أدخل رقم تواصل صحيحًا من 5 إلى 32 محرفًا.");
  if (values.address.length < 3 || values.address.length > 300) throw new Error("أدخل عنوانًا من 3 إلى 300 حرف.");
  if (values.description.length > 5000) throw new Error("الوصف أطول من الحد المسموح (5000 حرف).");
  const owned = await getMerchantStore(userId);
  if (!owned || owned.id !== storeId) throw new Error("تعذر التحقق من صلاحية تعديل المتجر.");
  const result = await supabase.from("stores").update(values).eq("id", storeId).eq("merchant_id", owned.merchant_id)
    .select("id,name,description,phone,address,status,merchant_id,category_id").single();
  if (result.error || !result.data) throw new Error("تعذر حفظ بيانات المتجر. لم تُمسح تعديلاتك؛ حاول مجددًا.");
  await Promise.all([invalidateLocalCache(`merchant-account:${userId}`), invalidateLocalCache(`merchant-home:${userId}`)]);
  return result.data;
}

export async function loadMerchantSubscription(userId: string) {
  const store = await getMerchantStore(userId);
  if (!store) throw new Error("لا يوجد متجر معتمد لهذا الحساب.");
  const [periods, plans, billing, changes, account] = await Promise.all([
    supabase.from("merchant_subscriptions").select("*").eq("merchant_id", store.merchant_id).order("starts_at", { ascending: false }),
    supabase.from("subscription_plans").select("*").eq("is_active", true).order("duration_months"),
    subscriptionReads.from("merchant_billing_settings").select("auto_renew").eq("merchant_id", store.merchant_id).maybeSingle(),
    subscriptionReads.from("merchant_subscription_plan_changes").select("id,plan_name_snapshot,selected_at").eq("merchant_id", store.merchant_id)
      .is("superseded_at", null).is("consumed_by_subscription", null).order("selected_at", { ascending: false }).limit(1).maybeSingle(),
    loadMerchantFinancialAccount("overview"),
  ]);
  const error = periods.error ?? plans.error ?? billing.error ?? changes.error;
  if (error) throw error;
  // Match the server's actual latest-started period; future periods stay separate.
  const serverStart = account.subscription?.starts_at;
  const current = typeof serverStart === "string" ? periods.data?.find((period) => new Date(period.starts_at).getTime() === new Date(serverStart).getTime()) ?? null : null;
  if (account.subscription && !current) throw new Error("تغيرت بيانات الاشتراك أثناء التحميل. أعد المحاولة لعرض آخر بيانات محفوظة.");
  const next = periods.data?.filter((period) => !current || new Date(period.starts_at).getTime() > new Date(current.starts_at).getTime()).at(-1) ?? null;
  let currentPlan = plans.data?.find((plan) => plan.id === current?.plan_id) ?? null;
  if (current && !currentPlan) {
    const result = await supabase.from("subscription_plans").select("*").eq("id", current.plan_id).maybeSingle();
    if (result.error) throw result.error;
    currentPlan = result.data;
  }
  return { current, next, currentPlan, plans: plans.data ?? [], autoRenew: billing.data?.auto_renew ?? false, change: changes.data, status: account.subscription?.subscription_status, commissionRate: account.subscription?.commission_rate_snapshot };
}

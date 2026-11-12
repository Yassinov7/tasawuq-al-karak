export type ApplicationDraft = { planId: string; categoryId: string; phone: string; store: string; description: string; address: string };
export const emptyMerchantDraft: ApplicationDraft = { planId: "", categoryId: "", phone: "", store: "", description: "", address: "" };
export const merchantDraftKey = (userId: string) => `merchant-application-draft:${userId}`;
export type ApplicationPlan = { id: string; name: string; description: string; duration_months: number; price: number; commission_rate: number | null; product_limit: number | null; features: string[] | null };
export type ApplicationCategory = { id: string; name: string };
export const applicationPlanReady = (plan: Omit<ApplicationPlan, "features"> & { features: unknown }): plan is ApplicationPlan => plan.commission_rate !== null && plan.product_limit !== null && Array.isArray(plan.features) && plan.features.length > 0 && plan.features.every((feature) => typeof feature === "string");
export const merchantPlanColumns = "id,name,description,duration_months,price,commission_rate,product_limit,features";
export function validateMerchantDraft(draft: ApplicationDraft): Partial<Record<keyof ApplicationDraft, string>> {
  const errors: Partial<Record<keyof ApplicationDraft, string>> = {};
  if (!/^[+\d٠-٩۰-۹\s()-]{5,32}$/.test(draft.phone.trim()) || draft.phone.replace(/[^\d٠-٩۰-۹]/g, "").length < 5) errors.phone = "أدخل رقم هاتف صحيحًا من 5 إلى 32 محرفًا.";
  if (draft.store.trim().length < 2 || draft.store.trim().length > 120) errors.store = "أدخل اسم متجر من حرفين إلى 120 حرفًا.";
  if (!draft.categoryId) errors.categoryId = "اختر تصنيف المتجر.";
  if (draft.address.trim().length < 3 || draft.address.trim().length > 300) errors.address = "أدخل عنوانًا من 3 إلى 300 حرف.";
  if (!draft.planId) errors.planId = "اختر خطة الاشتراك.";
  return errors;
}

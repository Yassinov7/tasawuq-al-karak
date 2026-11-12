export type SignupRole = "customer" | "merchant" | "driver";
export type SignupDetails = { fullName: string; email: string; password: string; passwordConfirmation: string; birthDate: string };
export type ProfessionalApplication = { phone: string; storeName: string; categoryId: string; address: string; vehicle: string; planId: string };
export const emptyProfessionalApplication: ProfessionalApplication = { phone: "", storeName: "", categoryId: "", address: "", vehicle: "", planId: "" };
export type SignupField = keyof SignupDetails;
export type SignupFieldErrors = Partial<Record<SignupField, string>>;
export type ApplicationFieldErrors = Partial<Record<keyof ProfessionalApplication, string>>;
export const signupRoleLabels = { customer: "عميل", merchant: "تاجر", driver: "سائق" } as const;

export function latinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
}
/** Calendar-only date. Never serialize a local date through UTC or accept rollover dates. */
export function normalizeBirthDate(value: string, today = new Date()): string | null {
  const date = latinDigits(value.trim());
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return normalized < current ? normalized : null;
}
export function normalizeContactPhone(value: string): string {
  return latinDigits(value).replace(/[\s()-]/g, "");
}
export function validateSignupDetails(value: SignupDetails): SignupFieldErrors {
  const errors: SignupFieldErrors = {};
  if (value.fullName.trim().length < 2 || value.fullName.trim().length > 120) errors.fullName = "أدخل اسمًا من حرفين إلى 120 حرفًا.";
  if (value.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) errors.email = "أدخل بريدًا إلكترونيًا صحيحًا.";
  if (value.password.length < 8) errors.password = "كلمة المرور يجب ألا تقل عن 8 أحرف.";
  if (value.password !== value.passwordConfirmation) errors.passwordConfirmation = "كلمتا المرور غير متطابقتين.";
  if (!normalizeBirthDate(value.birthDate)) errors.birthDate = "أدخل تاريخ ميلاد صحيحًا سابقًا لليوم.";
  return errors;
}
export function validateProfessionalApplication(role: SignupRole, value: ProfessionalApplication): ApplicationFieldErrors {
  if (role === "customer") return {};
  const errors: ApplicationFieldErrors = {};
  if (!/^\+?[0-9]{7,15}$/.test(normalizeContactPhone(value.phone))) errors.phone = "أدخل رقم تواصل صحيحًا من 7 إلى 15 رقمًا، مع رمز البلد عند الحاجة.";
  if (role === "merchant") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.planId)) errors.planId = "اختر خطة الاشتراك.";
    if (value.storeName.trim().length < 2 || value.storeName.trim().length > 120) errors.storeName = "أدخل اسم متجر من حرفين إلى 120 حرفًا.";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.categoryId)) errors.categoryId = "اختر تصنيف المتجر.";
    if (value.address.trim().length < 3 || value.address.trim().length > 300) errors.address = "أدخل عنوان المتجر بوضوح، من 3 إلى 300 حرف.";
  } else if (value.vehicle.trim().length < 2 || value.vehicle.trim().length > 80) errors.vehicle = "أدخل نوع المركبة المستخدمة للتوصيل.";
  return errors;
}
/** Explicit role allowlist. Never send passwords or unrelated/hidden role fields in metadata. */
export function signupMetadata(role: SignupRole, details: SignupDetails, application: ProfessionalApplication) {
  if (Object.keys(validateSignupDetails(details)).length || Object.keys(validateProfessionalApplication(role, application)).length) throw Error("راجع البيانات المطلوبة.");
  const common = { onboarding_version: 3, signup_role: role, full_name: details.fullName.trim(), signup_birth_date: normalizeBirthDate(details.birthDate)! };
  if (role === "customer") return common;
  const contact_phone = normalizeContactPhone(application.phone);
  return { ...common, signup_application: role === "merchant"
    ? { plan_id: application.planId, contact_phone, store_name: application.storeName.trim(), category_id: application.categoryId, store_address: application.address.trim() }
    : { contact_phone, vehicle_type: application.vehicle.trim() } };
}

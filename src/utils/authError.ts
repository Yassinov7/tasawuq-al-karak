export function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";

  if (code === "invalid_credentials") {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  }
  if (code === "user_already_exists") {
    return "هذا البريد الإلكتروني مسجل مسبقاً";
  }
  if (code === "weak_password") {
    return "كلمة المرور ضعيفة، اختر كلمة مرور أقوى";
  }
  if (code === "over_request_rate_limit") {
    return "تجاوزت عدد المحاولات المسموح بها، حاول لاحقاً";
  }
  if (/email not confirmed/i.test(message)) {
    return "أكد بريدك الإلكتروني من الرسالة التي وصلتك ثم سجّل الدخول";
  }
  if (/email provider.*disabled/i.test(message)) {
    return "تسجيل الدخول بالبريد غير مفعّل في إعدادات Supabase";
  }

  return "تعذّر إتمام العملية. تحقق من اتصالك وحاول مرة أخرى";
}

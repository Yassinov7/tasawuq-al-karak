import { supabase } from "@/lib/supabase";

export type AccountRole = "customer" | "merchant" | "driver" | "admin";
export type AccountRoute =
  | "/home"
  | "/merchant"
  | "/driver"
  | "/wallet"
  | "/merchant-application"
  | "/driver-application"
  | "/application-status"
  | "/admin";

export type AccountRoutingFailure =
  | "session-missing"
  | "profile-missing"
  | "invalid-role"
  | "temporarily-unavailable";

export class AccountRoutingError extends Error {
  constructor(readonly failure: AccountRoutingFailure) {
    super(failure);
    this.name = "AccountRoutingError";
  }
}

export async function getAccountRoute(userId: string): Promise<AccountRoute> {
  if (!userId.trim()) {
    throw new AccountRoutingError("session-missing");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AccountRoutingError("temporarily-unavailable");
  }
  if (!profile) {
    throw new AccountRoutingError("profile-missing");
  }
  if (!isAccountRole(profile.role)) {
    throw new AccountRoutingError("invalid-role");
  }

  if (profile.role === "admin") return "/admin";
  if (profile.role === "customer") return "/home";

  const table =
    profile.role === "merchant" ? "merchant_applications" : "driver_applications";
  const { data: application, error: applicationError } = await supabase
    .from(table)
    .select("id,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (applicationError) {
    throw new AccountRoutingError("temporarily-unavailable");
  }
  if (!application) {
    return profile.role === "merchant"
      ? "/merchant-application"
      : "/driver-application";
  }
  if (application.status === "accepted") {
    return profile.role === "merchant" ? "/merchant" : "/driver";
  }
  return "/application-status";
}

export function isAccountRole(value: string): value is AccountRole {
  return (
    value === "customer" ||
    value === "merchant" ||
    value === "driver" ||
    value === "admin"
  );
}

export function getAccountRoutingErrorMessage(error: unknown): string {
  if (!(error instanceof AccountRoutingError)) {
    return "تعذر تحميل بيانات الحساب. تحقق من الاتصال وحاول مرة أخرى.";
  }

  switch (error.failure) {
    case "session-missing":
      return "انتهت جلسة الدخول. سجّل الدخول للمتابعة.";
    case "profile-missing":
      return "تعذر العثور على بيانات الحساب. أعد المحاولة، وإذا استمرت المشكلة تواصل مع الدعم.";
    case "invalid-role":
      return "تعذر تحديد صلاحيات هذا الحساب. أعد المحاولة أو تواصل مع الدعم.";
    case "temporarily-unavailable":
      return "تعذر تحميل بيانات الحساب. تحقق من الاتصال وحاول مرة أخرى.";
  }
}

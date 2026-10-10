import { supabase } from "@/lib/supabase";

export type AccountRole = "customer" | "merchant" | "driver" | "admin";
export type AccountRoute = "/home" | "/merchant" | "/driver" | "/wallet" | "/merchant-application" | "/driver-application" | "/application-status" | "/admin";

export async function getAccountRoute(userId: string): Promise<AccountRoute> {
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("لم يكتمل إعداد الحساب. سجّل الخروج ثم حاول تسجيل الدخول مرة أخرى.");
  const role = profile.role as AccountRole;
  if (role === "admin") return "/admin";
  if (role === "customer") return "/home";

  const table = role === "merchant" ? "merchant_applications" : "driver_applications";
  const { data: application, error: applicationError } = await supabase.from(table).select("id,status").eq("user_id", userId).maybeSingle();
  if (applicationError) throw applicationError;
  if (!application) return role === "merchant" ? "/merchant-application" : "/driver-application";
  if (application.status === "accepted") return role === "merchant" ? "/merchant" : "/driver";
  return "/application-status";
}

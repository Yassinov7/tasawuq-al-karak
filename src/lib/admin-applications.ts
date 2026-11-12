import { supabase } from "@/lib/supabase";
import type { Json, Tables } from "@/types/database";

export type ApplicationRole = "merchant" | "driver";
export type ApplicationStatus = Tables<"merchant_applications">["status"];
export type MerchantApplication = Tables<"merchant_applications"> & { applicantBirthDate: string | null; applicantName: string | null; applicantEmail: string | null; categoryName: string | null };
export type DriverApplication = Tables<"driver_applications"> & { applicantBirthDate: string | null; applicantEmail: string | null };
export type ApplicationSummary = { publicReference: string; id: string; role: ApplicationRole; name: string; submittedAt: string; status: ApplicationStatus; phone: string };
export type ApplicationDetail = { role: ApplicationRole; merchant?: MerchantApplication; driver?: DriverApplication };

type CachedApplications = { data: ApplicationSummary[]; updatedAt: number };
const cache = new Map<string, CachedApplications>();
export type ApplicationFilter = ApplicationStatus | "all";
const cacheKey=(role:ApplicationRole,status:ApplicationFilter)=>`${role}:${status}`;
const cacheTtlMs = 15_000;

export function getCachedApplications(role: ApplicationRole,status:ApplicationFilter="all") { return cache.get(cacheKey(role,status)) ?? null; }
export function isCachedApplicationsFresh(role: ApplicationRole,status:ApplicationFilter="all") { const item = cache.get(cacheKey(role,status)); return Boolean(item && Date.now() - item.updatedAt < cacheTtlMs); }
export function invalidateAdminApplications() {
  for (const [role, item] of cache) cache.set(role, { ...item, updatedAt: 0 });
}

function featureList(value: Json | null) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function getAdminApplications(role: ApplicationRole, force = false, status:ApplicationFilter="all"): Promise<ApplicationSummary[]> {
  const cached = cache.get(cacheKey(role,status));
  if (!force && cached && Date.now() - cached.updatedAt < cacheTtlMs) return cached.data;
  if (role === "driver") {
    let query = supabase.from("driver_applications").select("id,public_reference,full_name,contact_phone,status,submitted_at").order("submitted_at", { ascending: false });
    if(status!=="all")query=query.eq("status",status);
    const { data, error } = await query;
    if (error) throw error;
    const result = (data ?? []).map((row) => ({ publicReference: row.public_reference, id: row.id, role, name: row.full_name, phone: row.contact_phone, status: row.status, submittedAt: row.submitted_at }));
    cache.set(cacheKey(role,status), { data: result, updatedAt: Date.now() }); return result;
  }
  let query = supabase.from("merchant_applications").select("id,public_reference,user_id,store_name,contact_phone,status,submitted_at").order("submitted_at", { ascending: false });
  if(status!=="all")query=query.eq("status",status);
  const { data: rows, error } = await query;
  if (error) throw error;
  const userIds = [...new Set((rows ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = userIds.length ? await supabase.from("profiles").select("id,full_name").in("id", userIds) : { data: [], error: null };
  if (profilesError) throw profilesError;
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const result = (rows ?? []).map((row) => ({ publicReference: row.public_reference, id: row.id, role, name: names.get(row.user_id) ?? row.store_name, phone: row.contact_phone, status: row.status, submittedAt: row.submitted_at }));
  cache.set(cacheKey(role,status), { data: result, updatedAt: Date.now() }); return result;
}

export async function getAdminApplicationDetail(role: ApplicationRole, id: string): Promise<ApplicationDetail | null> {
  if (role === "driver") {
    const { data, error } = await supabase.from("driver_applications").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: profile, error: profileError } = await supabase.from("profiles").select("email,birth_date").eq("id", data.user_id).maybeSingle();
    if (profileError) throw profileError;
    return { role, driver: { ...data, applicantBirthDate: profile?.birth_date ?? null, applicantEmail: profile?.email ?? null } };
  }
  const { data, error } = await supabase.from("merchant_applications").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [profileResult, categoryResult] = await Promise.all([
    supabase.from("profiles").select("full_name,email,birth_date").eq("id", data.user_id).maybeSingle(),
    supabase.from("catalog_categories").select("name").eq("scope", "store").eq("id", data.category_id).maybeSingle(),
  ]);
  if (profileResult.error ?? categoryResult.error) throw profileResult.error ?? categoryResult.error;
  return { role, merchant: { ...data, applicantBirthDate: profileResult.data?.birth_date ?? null, applicantName: profileResult.data?.full_name ?? null, applicantEmail: profileResult.data?.email ?? null, categoryName: categoryResult.data?.name ?? null } };
}

export async function reviewAdminApplication(role: ApplicationRole, id: string, decision: Exclude<ApplicationStatus, "pending">, note: string) {
  const rpc = role === "merchant" ? "review_merchant_application" : "review_driver_application";
  const { error } = await supabase.rpc(rpc, { target_application: id, decision, decision_note: note.trim() || undefined });
  if (error) throw error;
  invalidateAdminApplications();
}

export { featureList };

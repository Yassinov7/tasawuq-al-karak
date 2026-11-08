import { supabase } from "@/lib/supabase";

export type PlanCurrency = "SYP";

export type ManagedSubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  duration_months: number;
  price: number;
  commission_rate: number | null;
  product_limit: number | null;
  features: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlanInput = {
  name: string;
  description: string;
  durationMonths: number;
  price: number;
  commissionRate: number | null;
  productLimit: number | null;
  features: string[];
  isActive: boolean;
};

const planFields = "id,name,description,duration_months,price,commission_rate,product_limit,features,is_active,created_at,updated_at";

let plansInvalidatedAt = 0;

/** Lets the list refresh immediately after the dedicated form saves a plan. */
export function invalidateManagedSubscriptionPlans(): void {
  plansInvalidatedAt = Date.now();
}

export function getManagedSubscriptionPlansInvalidatedAt(): number {
  return plansInvalidatedAt;
}

export async function loadManagedSubscriptionPlans(): Promise<ManagedSubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(planFields)
    .order("is_active", { ascending: false })
    .order("duration_months")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ManagedSubscriptionPlan[];
}

export async function loadManagedSubscriptionPlan(planId: string): Promise<ManagedSubscriptionPlan> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(planFields)
    .eq("id", planId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("subscription plan not found");
  return data as unknown as ManagedSubscriptionPlan;
}

export async function saveManagedSubscriptionPlan(
  input: SubscriptionPlanInput,
  planId?: string,
): Promise<void> {
  const payload = {
    name: input.name,
    description: input.description,
    duration_months: input.durationMonths,
    price: input.price,
    commission_rate: input.commissionRate,
    product_limit: input.productLimit,
    features: input.features,
    is_active: input.isActive,
  };

  const result = planId
    ? await supabase.from("subscription_plans").update(payload).eq("id", planId)
    : await supabase.from("subscription_plans").insert(payload);

  if (result.error) throw result.error;
  invalidateManagedSubscriptionPlans();
}

export async function setManagedSubscriptionPlanActive(
  planId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("subscription_plans")
    .update({ is_active: isActive })
    .eq("id", planId);

  if (error) throw error;
  invalidateManagedSubscriptionPlans();
}

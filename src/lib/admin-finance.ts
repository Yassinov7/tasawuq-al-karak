import { supabase } from "@/lib/supabase";

export type FinanceCurrency = "SYP" | "USD";

export type MerchantFinancialPosition = {
  merchant_id: string;
  currency: FinanceCurrency;
  invoices_total: number;
  payments_allocated: number;
  invoice_outstanding: number;
  payments_recorded: number;
  unapplied_payment_balance: number;
  commissions_due: number;
  booked_exposure: number;
  effective_exposure: number;
  credit_enabled: boolean;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
};

export type MerchantFinanceSummary = {
  merchantId: string;
  merchantStatus: string;
  storeName: string | null;
  positions: MerchantFinancialPosition[];
};

export type FinanceCurrencySummary = {
  currency: FinanceCurrency;
  invoiceOutstanding: number;
  paymentsRecorded: number;
  commissionsDue: number;
  openInvoiceCount: number;
  openOnlyInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  paymentsAllocated: number;
  unappliedPaymentBalance: number;
  paymentCount: number;
};

export type FinanceAction = {
  merchantId: string;
  storeName: string | null;
  kind: "open_invoices" | "grace_period" | "expiring_subscription";
  currency?: FinanceCurrency;
  count?: number;
  expiresAt?: string;
};

export type AdminFinanceDashboard = {
  merchants: MerchantFinanceSummary[];
  currencies: FinanceCurrencySummary[];
  actions: FinanceAction[];
  subscriptions: SubscriptionIndicatorSummary;
  credit: CreditDashboardSummary;
  commissions: CommissionDashboardSummary[];
  ledger: LedgerDashboardSummary;
};

export type CreditCurrencySummary = { currency: FinanceCurrency; enabledCount: number; creditLimitTotal: number; effectiveExposureTotal: number; atOrOverLimitCount: number };
export type CreditDashboardSummary = { enabledMerchantCount: number; noCreditMerchantCount: number; currencies: CreditCurrencySummary[] };
export type CommissionDashboardSummary = { currency: FinanceCurrency; dueAmount: number; dueCount: number; recordedCount: number; reversalCount: number };
export type LedgerDashboardSummary = { totalCount: number; subscriptionCount: number; commissionCount: number; correctionCount: number };

export type FinancialIndicatorCurrency = FinanceCurrencySummary & {
  effectiveExposure: number;
  invoiceCount: number;
  partiallyPaidInvoiceCount: number;
  paidInvoiceCount: number;
  dueCommissionCount: number;
};

export type SubscriptionIndicatorSummary = {
  active: number;
  expiringWithinSevenDays: number;
  gracePeriod: number;
  expired: number;
};

export type FinancialIndicators = {
  currencies: FinancialIndicatorCurrency[];
  subscriptions: SubscriptionIndicatorSummary;
};

export type AdminInvoiceListFilter = "all" | "open" | "partially_paid" | "paid" | "void";

export type AdminInvoiceSummary = Invoice & {
  merchantName: string | null;
  storeName: string | null;
  subscriptionStartsAt: string | null;
  subscriptionExpiresAt: string | null;
  paidAmount: number;
  outstandingAmount: number;
};

export type AdminInvoicePage = { invoices: AdminInvoiceSummary[]; hasMore: boolean };

export type AdminInvoiceDetails = AdminInvoiceSummary & {
  merchantPhone: string | null;
  merchantStatus: string | null;
  planName: string | null;
  allocations: (InvoicePaymentAllocation & { payment: Payment | null })[];
  ledgerEntries: LedgerEntry[];
};

export type AdminPaymentFilter = "all" | "SYP" | "USD" | "cash" | "external_transfer";

export type AdminPaymentSummary = Payment & {
  merchantName: string | null;
  storeName: string | null;
  allocatedAmount: number;
  unappliedAmount: number | null;
};

export type AdminPaymentPage = { payments: AdminPaymentSummary[]; hasMore: boolean; totalCount: number };

export type AdminPaymentDetails = AdminPaymentSummary & {
  merchantPhone: string | null;
  merchantStatus: string | null;
  allocations: (InvoicePaymentAllocation & { invoice: Pick<Invoice, "id" | "invoice_number" | "currency" | "total_amount" | "status"> | null })[];
  dataIntegrityError: boolean;
};

export type AdminSubscriptionFilter = "all" | "active" | "expiring" | "grace" | "expired";

export type AdminSubscriptionSummary = MerchantSubscription & {
  merchantName: string | null;
  storeName: string | null;
  autoRenew: boolean;
  scheduledPlanName: string | null;
  periodStatus: AdminSubscriptionFilter;
  daysValue: number;
};

export type AdminSubscriptionPage = { subscriptions: AdminSubscriptionSummary[]; hasMore: boolean; totalCount: number };

export type AdminSubscriptionDetails = AdminSubscriptionSummary & {
  merchantPhone: string | null;
  merchantStatus: string | null;
  currentPeriodId: string | null;
  currentPeriodStatus: AdminSubscriptionFilter | null;
  invoice: Pick<Invoice, "id" | "invoice_number" | "currency" | "total_amount" | "status" | "due_at"> | null;
};

export type AdminCreditFilter = "all" | "enabled" | "disabled";
export type AdminCreditCurrencyFilter = "all" | FinanceCurrency;
export type AdminCreditSummary = MerchantFinancialPosition & { merchantName: string | null; storeName: string | null; autoRenew: boolean; overLimitAmount: number };
export type AdminCreditPage = { records: AdminCreditSummary[]; hasMore: boolean; totalCount: number };
export type AdminCreditDetails = AdminCreditSummary & { merchantPhone: string | null; merchantStatus: string | null };
export type AdminCommissionFilter = "all" | "due" | "pending_delivery" | "void";
export type AdminCommissionCurrencyFilter = "all" | FinanceCurrency;
export type AdminCommissionSummary = Commission & { merchant_id: string; merchantName: string | null; storeName: string | null; customerOrderId: string | null; reversalTotal: number; reversalCount: number };
export type AdminCommissionPage = { commissions: AdminCommissionSummary[]; hasMore: boolean; totalCount: number };
export type AdminCommissionDetails = AdminCommissionSummary & { reversals: CommissionReversal[]; merchantPhone: string | null; merchantStatus: string | null; storeOrderStatus: string | null; storeOrderDeliveredAt: string | null };
export type AdminLedgerFilter = "all" | "subscription_invoice" | "store_order_commission" | "payment_allocation" | "commission_reversal" | "manual_adjustment" | "ledger_reversal";
export type AdminLedgerCurrencyFilter = "all" | FinanceCurrency;
export type AdminLedgerSummary = LedgerEntry & { merchant_id: string; reversal_of: string | null; merchantName: string | null; storeName: string | null };
export type AdminLedgerPage = { entries: AdminLedgerSummary[]; hasMore: boolean; totalCount: number };
export type AdminLedgerDetails = AdminLedgerSummary & { merchantPhone: string | null; merchantStatus: string | null; invoiceId: string | null; paymentId: string | null; commissionId: string | null; relatedReversalId: string | null };

export type MerchantSubscription = {
  id: string;
  merchant_id: string;
  plan_id: string;
  plan_name_snapshot: string;
  duration_months: number;
  price_snapshot: number;
  currency_snapshot: FinanceCurrency;
  starts_at: string;
  expires_at: string;
  commission_rate_snapshot: number | null;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  currency: FinanceCurrency;
  is_active: boolean;
  commission_rate: number | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  merchant_id: string;
  subscription_id: string;
  kind: string;
  currency: FinanceCurrency;
  total_amount: number;
  due_at: string | null;
  status: string;
  created_at: string;
};

export type Payment = {
  id: string;
  merchant_id: string;
  currency: FinanceCurrency;
  amount: number;
  method: string;
  external_reference: string | null;
  received_at: string;
  created_at: string;
};

export type LedgerEntry = {
  id: string;
  currency: FinanceCurrency;
  effect: "increase_exposure" | "decrease_exposure";
  source_type: string;
  source_id: string;
  amount: number;
  created_at: string;
};

export type Commission = {
  id: string;
  store_order_id: string;
  currency: FinanceCurrency;
  commission_rate: number;
  base_amount: number;
  commission_amount: number;
  status: string;
  due_at: string | null;
  created_at: string;
};

export type CommissionReversal = {
  id: string;
  commission_id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type InvoicePaymentAllocation = {
  invoice_id: string;
  payment_id: string;
  amount: number;
  created_at: string;
};

export type ScheduledPlanChange = {
  id: string;
  plan_id: string;
  plan_name_snapshot: string;
  duration_months: number;
  price_snapshot: number;
  currency_snapshot: FinanceCurrency;
  commission_rate_snapshot: number | null;
  selected_at: string;
  superseded_at: string | null;
  consumed_by_subscription: string | null;
};

export type MerchantFinanceDetails = {
  merchant: MerchantFinanceSummary;
  subscriptions: MerchantSubscription[];
  plans: SubscriptionPlan[];
  billingAutoRenew: boolean;
  invoices: Invoice[];
  payments: Payment[];
  ledgerEntries: LedgerEntry[];
  commissions: Commission[];
  commissionReversals: CommissionReversal[];
  allocations: InvoicePaymentAllocation[];
  scheduledPlanChange: ScheduledPlanChange | null;
};

type LooseQueryResult = { data: unknown[] | null; error: Error | null; count?: number | null };

type LooseQuery = {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => LooseQuery;
  eq: (column: string, value: string) => LooseQuery;
  in: (column: string, values: string[]) => LooseQuery;
  ilike: (column: string, value: string) => LooseQuery;
  lte: (column: string, value: string) => LooseQuery;
  gt: (column: string, value: string) => LooseQuery;
  or: (filters: string) => LooseQuery;
  limit: (count: number) => LooseQuery;
  range: (from: number, to: number) => PromiseLike<LooseQueryResult>;
  maybeSingle: () => PromiseLike<{ data: unknown | null; error: Error | null }>;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery;
  then: PromiseLike<LooseQueryResult> ["then"];
};

type FinanceClient = {
  from: (relation: string) => LooseQuery;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

// Migrations 00100–00500 are newer than the checked-in generated database
// type file. Keep the untyped bridge isolated until types are regenerated.
const financeClient = supabase as unknown as FinanceClient;

function asRows<T>(result: { data: unknown[] | null; error: Error | null }): T[] {
  if (result.error) throw result.error;
  return (result.data ?? []) as T[];
}

async function countRows(query: LooseQuery): Promise<number> {
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

export async function loadMerchantFinanceSummaries(): Promise<MerchantFinanceSummary[]> {
  const [positionsResult, merchantsResult, storesResult] = await Promise.all([
    financeClient.from("merchant_financial_positions").select("merchant_id,currency,invoices_total,payments_allocated,invoice_outstanding,payments_recorded,unapplied_payment_balance,commissions_due,booked_exposure,effective_exposure,credit_enabled,credit_limit,credit_used,credit_available"),
    financeClient.from("merchants").select("id,status"),
    financeClient.from("stores").select("merchant_id,name"),
  ]);
  const positions = asRows<MerchantFinancialPosition>(positionsResult);
  const merchants = asRows<{ id: string; status: string }>(merchantsResult);
  const stores = asRows<{ merchant_id: string; name: string }>(storesResult);
  const storeNames = new Map(stores.map((store) => [store.merchant_id, store.name]));
  const positionsByMerchant = new Map<string, MerchantFinancialPosition[]>();
  for (const position of positions) {
    positionsByMerchant.set(position.merchant_id, [
      ...(positionsByMerchant.get(position.merchant_id) ?? []),
      position,
    ]);
  }

  return merchants.map((merchant) => ({
    merchantId: merchant.id,
    merchantStatus: merchant.status,
    storeName: storeNames.get(merchant.id) ?? null,
    positions: positionsByMerchant.get(merchant.id) ?? [],
  }));
}

type SubscriptionTiming = { merchant_id: string; starts_at: string; expires_at: string };

const subscriptionGraceMs = 7 * 24 * 60 * 60 * 1000;

function latestStartedSubscriptionPeriods<T extends SubscriptionTiming>(subscriptions: T[], now = Date.now()) {
  const latest = new Map<string, T>();
  for (const subscription of subscriptions) {
    const startsAt = new Date(subscription.starts_at).getTime();
    const expiresAt = new Date(subscription.expires_at).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || startsAt > now) continue;
    const current = latest.get(subscription.merchant_id);
    if (!current || expiresAt > new Date(current.expires_at).getTime()) latest.set(subscription.merchant_id, subscription);
  }
  return latest;
}

function subscriptionIndicatorsFromPeriods(subscriptions: SubscriptionTiming[], now = Date.now()): SubscriptionIndicatorSummary {
  const indicators: SubscriptionIndicatorSummary = { active: 0, expiringWithinSevenDays: 0, gracePeriod: 0, expired: 0 };
  for (const subscription of latestStartedSubscriptionPeriods(subscriptions, now).values()) {
    const expiresAt = new Date(subscription.expires_at).getTime();
    if (expiresAt > now) {
      indicators.active += 1;
      if (expiresAt - now <= subscriptionGraceMs) indicators.expiringWithinSevenDays += 1;
    } else if (expiresAt + subscriptionGraceMs > now) {
      indicators.gracePeriod += 1;
    } else {
      indicators.expired += 1;
    }
  }
  return indicators;
}

function subscriptionPeriodStatus(subscription: SubscriptionTiming, now = Date.now()): AdminSubscriptionFilter | null {
  const startsAt = new Date(subscription.starts_at).getTime();
  const expiresAt = new Date(subscription.expires_at).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || startsAt > now) return null;
  if (expiresAt > now) return expiresAt - now <= subscriptionGraceMs ? "expiring" : "active";
  return expiresAt + subscriptionGraceMs > now ? "grace" : "expired";
}

export async function loadAdminFinanceDashboard(): Promise<AdminFinanceDashboard> {
  const [merchants, invoicesResult, subscriptionsResult, paymentCounts, commissionCounts, ledgerCounts] = await Promise.all([
    loadMerchantFinanceSummaries(),
    financeClient.from("subscription_invoices").select("merchant_id,currency,status").order("created_at", { ascending: false }),
    financeClient.from("merchant_subscriptions").select("merchant_id,starts_at,expires_at").order("expires_at", { ascending: false }),
    Promise.all((["SYP", "USD"] as FinanceCurrency[]).map(async (currency) => ({
      currency,
      count: await countRows(financeClient.from("subscription_payments").select("id", { count: "exact", head: true }).eq("currency", currency)),
    }))),
    Promise.all((["SYP", "USD"] as FinanceCurrency[]).map(async (currency) => {
      const [dueCount, recordedCount, reversalCount] = await Promise.all([
        countRows(financeClient.from("store_order_commissions").select("id", { count: "exact", head: true }).eq("currency", currency).eq("status", "due")),
        countRows(financeClient.from("store_order_commissions").select("id", { count: "exact", head: true }).eq("currency", currency)),
        countRows(financeClient.from("store_order_commission_reversals").select("id", { count: "exact", head: true }).eq("currency", currency)),
      ]);
      return { currency, dueCount, recordedCount, reversalCount };
    })),
    Promise.all(["total", "subscription_invoice", "store_order_commission", "commission_reversal", "payment_allocation", "manual_adjustment", "ledger_reversal"].map(async (sourceType) => ({ sourceType, count: await countRows(sourceType === "total" ? financeClient.from("merchant_ledger_entries").select("id", { count: "exact", head: true }) : financeClient.from("merchant_ledger_entries").select("id", { count: "exact", head: true }).eq("source_type", sourceType)) }))),
  ]);
  const invoices = asRows<{ merchant_id: string; currency: FinanceCurrency; status: string }>(invoicesResult);
  const subscriptions = asRows<SubscriptionTiming>(subscriptionsResult);
  const positions = merchants.flatMap((merchant) => merchant.positions);
  const currencies = (["SYP", "USD"] as FinanceCurrency[]).map((currency) => ({
    currency,
    invoiceOutstanding: positions.filter((position) => position.currency === currency).reduce((total, position) => total + Number(position.invoice_outstanding ?? 0), 0),
    paymentsRecorded: positions.filter((position) => position.currency === currency).reduce((total, position) => total + Number(position.payments_recorded ?? 0), 0),
    commissionsDue: positions.filter((position) => position.currency === currency).reduce((total, position) => total + Number(position.commissions_due ?? 0), 0),
    openInvoiceCount: invoices.filter((invoice) => invoice.currency === currency && ["open", "partially_paid"].includes(invoice.status)).length,
    openOnlyInvoiceCount: invoices.filter((invoice) => invoice.currency === currency && invoice.status === "open").length,
    partiallyPaidInvoiceCount: invoices.filter((invoice) => invoice.currency === currency && invoice.status === "partially_paid").length,
    paymentsAllocated: positions.filter((position) => position.currency === currency).reduce((total, position) => total + Number(position.payments_allocated ?? 0), 0),
    unappliedPaymentBalance: positions.filter((position) => position.currency === currency).reduce((total, position) => total + Number(position.unapplied_payment_balance ?? 0), 0),
    paymentCount: paymentCounts.find((item) => item.currency === currency)?.count ?? 0,
  })).filter((summary) => summary.invoiceOutstanding || summary.paymentsRecorded || summary.commissionsDue || summary.openInvoiceCount);
  const storeNames = new Map(merchants.map((merchant) => [merchant.merchantId, merchant.storeName]));
  const openInvoicesByMerchantCurrency = new Map<string, number>();
  for (const invoice of invoices.filter((item) => ["open", "partially_paid"].includes(item.status))) {
    const key = `${invoice.merchant_id}:${invoice.currency}`;
    openInvoicesByMerchantCurrency.set(key, (openInvoicesByMerchantCurrency.get(key) ?? 0) + 1);
  }
  const invoiceActions = [...openInvoicesByMerchantCurrency.entries()].map(([key, count]) => {
    const [merchantId, currency] = key.split(":") as [string, FinanceCurrency];
    return { merchantId, kind: "open_invoices" as const, currency, count, storeName: storeNames.get(merchantId) ?? null };
  });
  const now = Date.now();
  const subscriptionActions = [...latestStartedSubscriptionPeriods(subscriptions, now).values()].flatMap((subscription) => {
    const remaining = new Date(subscription.expires_at).getTime() - now;
    if (remaining < -subscriptionGraceMs || remaining > subscriptionGraceMs) return [];
    return [{ merchantId: subscription.merchant_id, storeName: storeNames.get(subscription.merchant_id) ?? null, kind: remaining < 0 ? "grace_period" as const : "expiring_subscription" as const, expiresAt: subscription.expires_at }];
  });
  const enabledMerchantIds = new Set(positions.filter((position) => position.credit_enabled).map((position) => position.merchant_id));
  const creditCurrencies = (["SYP", "USD"] as FinanceCurrency[]).map((currency) => {
    const allCurrencyPositions = positions.filter((position) => position.currency === currency);
    const currencyPositions = allCurrencyPositions.filter((position) => position.credit_enabled);
    return {
      currency,
      enabledCount: currencyPositions.length,
      creditLimitTotal: currencyPositions.reduce((total, position) => total + Number(position.credit_limit ?? 0), 0),
      effectiveExposureTotal: allCurrencyPositions.reduce((total, position) => total + Number(position.effective_exposure ?? 0), 0),
      atOrOverLimitCount: currencyPositions.filter((position) => Number(position.effective_exposure ?? 0) >= Number(position.credit_limit ?? 0)).length,
    };
  }).filter((summary) => summary.enabledCount > 0 || summary.effectiveExposureTotal > 0);
  const commissions = commissionCounts.map((count) => ({ ...count, dueAmount: positions.filter((position) => position.currency === count.currency).reduce((total, position) => total + Number(position.commissions_due ?? 0), 0) })).filter((summary) => summary.dueAmount > 0 || summary.recordedCount > 0 || summary.reversalCount > 0);
  const ledgerCount = (sourceType: string) => ledgerCounts.find((item) => item.sourceType === sourceType)?.count ?? 0;
  return { merchants, currencies, actions: [...invoiceActions, ...subscriptionActions], subscriptions: subscriptionIndicatorsFromPeriods(subscriptions, now), credit: { enabledMerchantCount: enabledMerchantIds.size, noCreditMerchantCount: Math.max(0, merchants.length - enabledMerchantIds.size), currencies: creditCurrencies }, commissions, ledger: { totalCount: ledgerCount("total"), subscriptionCount: ledgerCount("subscription_invoice"), commissionCount: ledgerCount("store_order_commission"), correctionCount: ledgerCount("commission_reversal") + ledgerCount("manual_adjustment") + ledgerCount("ledger_reversal") } };
}

export async function loadFinancialIndicators(): Promise<FinancialIndicators> {
  const currencies = ["SYP", "USD"] as const;
  const invoiceCounts = await Promise.all(currencies.map(async (currency) => {
    const count = (status?: "open" | "partially_paid" | "paid") => {
      let query = financeClient.from("subscription_invoices").select("id", { count: "exact", head: true }).eq("currency", currency);
      if (status) query = query.eq("status", status);
      return countRows(query);
    };
    const [total, open, partiallyPaid, paid] = await Promise.all([count(), count("open"), count("partially_paid"), count("paid")]);
    return { currency, total, open, partiallyPaid, paid };
  }));
  const [dueCommissionCounts, paymentCounts] = await Promise.all([
    Promise.all(currencies.map(async (currency) => ({
      currency,
      count: await countRows(financeClient.from("store_order_commissions").select("id", { count: "exact", head: true }).eq("currency", currency).eq("status", "due")),
    }))),
    Promise.all(currencies.map(async (currency) => ({
      currency,
      count: await countRows(financeClient.from("subscription_payments").select("id", { count: "exact", head: true }).eq("currency", currency)),
    }))),
  ]);
  const [merchants, subscriptionsResult] = await Promise.all([
    loadMerchantFinanceSummaries(),
    financeClient.from("merchant_subscriptions").select("merchant_id,starts_at,expires_at"),
  ]);
  const subscriptions = asRows<{ merchant_id: string; starts_at: string; expires_at: string }>(subscriptionsResult);
  const positions = merchants.flatMap((merchant) => merchant.positions);
  const visibleCurrencies = new Set<FinanceCurrency>([
    ...positions.map((position) => position.currency),
    ...invoiceCounts.filter((item) => item.total > 0).map((item) => item.currency),
    ...dueCommissionCounts.filter((item) => item.count > 0).map((item) => item.currency),
  ]);

  const currencyIndicators = [...visibleCurrencies].map((currency) => {
    const currencyPositions = positions.filter((position) => position.currency === currency);
    const invoiceCount = invoiceCounts.find((item) => item.currency === currency);
    const dueCommissionCount = dueCommissionCounts.find((item) => item.currency === currency);
    return {
      currency,
      invoiceOutstanding: currencyPositions.reduce((total, position) => total + Number(position.invoice_outstanding ?? 0), 0),
      paymentsRecorded: currencyPositions.reduce((total, position) => total + Number(position.payments_recorded ?? 0), 0),
      commissionsDue: currencyPositions.reduce((total, position) => total + Number(position.commissions_due ?? 0), 0),
      effectiveExposure: currencyPositions.reduce((total, position) => total + Number(position.effective_exposure ?? 0), 0),
      paymentsAllocated: currencyPositions.reduce((total, position) => total + Number(position.payments_allocated ?? 0), 0),
      unappliedPaymentBalance: currencyPositions.reduce((total, position) => total + Number(position.unapplied_payment_balance ?? 0), 0),
      paymentCount: paymentCounts.find((item) => item.currency === currency)?.count ?? 0,
      invoiceCount: invoiceCount?.total ?? 0,
      openInvoiceCount: (invoiceCount?.open ?? 0) + (invoiceCount?.partiallyPaid ?? 0),
      openOnlyInvoiceCount: invoiceCount?.open ?? 0,
      partiallyPaidInvoiceCount: invoiceCount?.partiallyPaid ?? 0,
      paidInvoiceCount: invoiceCount?.paid ?? 0,
      dueCommissionCount: dueCommissionCount?.count ?? 0,
    };
  }).sort((first, second) => first.currency.localeCompare(second.currency));

  return { currencies: currencyIndicators, subscriptions: subscriptionIndicatorsFromPeriods(subscriptions) };
}

const invoicePageCache = new Map<string, { data: AdminInvoicePage; updatedAt: number }>();
const invoiceDetailCache = new Map<string, { data: AdminInvoiceDetails | null; updatedAt: number }>();
const financeCacheTtlMs = 15_000;

const invoicePageKey = (filter: AdminInvoiceListFilter, page: number, pageSize: number, search: string) =>
  `${filter}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;

function rowsOrEmpty<T>(result: { data: unknown[] | null; error: Error | null }): T[] {
  return result.error ? [] : (result.data ?? []) as T[];
}

async function merchantIdsMatchingFinanceSearch(search: string): Promise<string[]> {
  const normalizedSearch = search.trim();
  if (!normalizedSearch) return [];
  const [storesResult, profilesResult] = await Promise.all([
    financeClient.from("stores").select("merchant_id").ilike("name", `%${normalizedSearch}%`).limit(100),
    financeClient.from("profiles").select("id").ilike("full_name", `%${normalizedSearch}%`).limit(100),
  ]);
  const ownerIds = rowsOrEmpty<{ id: string }>(profilesResult).map((profile) => profile.id);
  const merchantsResult = ownerIds.length
    ? await financeClient.from("merchants").select("id").in("owner_user_id", ownerIds)
    : { data: [], error: null };
  return [...new Set([
    ...rowsOrEmpty<{ merchant_id: string }>(storesResult).map((store) => store.merchant_id),
    ...rowsOrEmpty<{ id: string }>(merchantsResult).map((merchant) => merchant.id),
  ])];
}

export function getCachedAdminInvoicePage(filter: AdminInvoiceListFilter, page: number, pageSize: number, search = "") {
  return invoicePageCache.get(invoicePageKey(filter, page, pageSize, search)) ?? null;
}

export function isCachedAdminInvoicePageFresh(filter: AdminInvoiceListFilter, page: number, pageSize: number, search = "") {
  const cached = getCachedAdminInvoicePage(filter, page, pageSize, search);
  return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs);
}

export function getCachedAdminInvoice(invoiceId: string) {
  return invoiceDetailCache.get(invoiceId) ?? null;
}

export function isCachedAdminInvoiceFresh(invoiceId: string) {
  const cached = getCachedAdminInvoice(invoiceId);
  return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs);
}

export async function getAdminInvoicePage({
  filter,
  page,
  pageSize = 20,
  force = false,
  search = "",
}: {
  filter: AdminInvoiceListFilter;
  page: number;
  pageSize?: number;
  force?: boolean;
  search?: string;
}): Promise<AdminInvoicePage> {
  const normalizedSearch = search.trim();
  const cacheKey = invoicePageKey(filter, page, pageSize, normalizedSearch);
  const cached = invoicePageCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;

  let query = financeClient
    .from("subscription_invoices")
    .select("id,invoice_number,merchant_id,subscription_id,kind,currency,total_amount,due_at,status,created_at")
    .order("created_at", { ascending: false });
  if (filter !== "all") query = query.eq("status", filter);

  if (normalizedSearch) {
    const merchantIds = await merchantIdsMatchingFinanceSearch(normalizedSearch);
    const isInvoiceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch);
    const isMerchantId = isInvoiceId;
    const clauses = [
      `invoice_number.ilike.%${normalizedSearch.replace(/[%_,()]/g, "")}%`,
      isInvoiceId ? `id.eq.${normalizedSearch}` : "",
      isMerchantId ? `merchant_id.eq.${normalizedSearch}` : "",
      merchantIds.length ? `merchant_id.in.(${merchantIds.join(",")})` : "",
    ].filter(Boolean);
    if (!clauses.length) {
      const empty = { invoices: [], hasMore: false };
      invoicePageCache.set(cacheKey, { data: empty, updatedAt: Date.now() });
      return empty;
    }
    query = query.or(clauses.join(","));
  }

  const invoiceResult = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (invoiceResult.error) throw invoiceResult.error;
  const invoices = (invoiceResult.data ?? []) as Invoice[];
  const result: AdminInvoicePage = {
    invoices: await enrichInvoiceSummaries(invoices),
    hasMore: invoices.length === pageSize,
  };
  invoicePageCache.set(cacheKey, { data: result, updatedAt: Date.now() });
  return result;
}

async function enrichInvoiceSummaries(invoices: Invoice[]): Promise<AdminInvoiceSummary[]> {
  if (!invoices.length) return [];
  const merchantIds = [...new Set(invoices.map((invoice) => invoice.merchant_id))];
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const subscriptionIds = [...new Set(invoices.map((invoice) => invoice.subscription_id))];
  const [merchantsResult, storesResult, subscriptionsResult, allocationsResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id").in("id", merchantIds),
    financeClient.from("stores").select("merchant_id,name").in("merchant_id", merchantIds),
    financeClient.from("merchant_subscriptions").select("id,plan_name_snapshot,starts_at,expires_at").in("id", subscriptionIds),
    financeClient.from("invoice_payment_allocations").select("invoice_id,amount").in("invoice_id", invoiceIds),
  ]);
  const merchants = rowsOrEmpty<{ id: string; owner_user_id: string }>(merchantsResult);
  const ownerIds = merchants.map((merchant) => merchant.owner_user_id);
  const profilesResult = ownerIds.length
    ? await financeClient.from("profiles").select("id,full_name").in("id", ownerIds)
    : { data: [], error: null };
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const profileNames = new Map(rowsOrEmpty<{ id: string; full_name: string | null }>(profilesResult).map((profile) => [profile.id, profile.full_name]));
  const storeNames = new Map(rowsOrEmpty<{ merchant_id: string; name: string }>(storesResult).map((store) => [store.merchant_id, store.name]));
  const subscriptions = new Map(rowsOrEmpty<{ id: string; starts_at: string; expires_at: string }>(subscriptionsResult).map((subscription) => [subscription.id, subscription]));
  const paidByInvoice = new Map<string, number>();
  for (const allocation of rowsOrEmpty<{ invoice_id: string; amount: number }>(allocationsResult)) {
    paidByInvoice.set(allocation.invoice_id, (paidByInvoice.get(allocation.invoice_id) ?? 0) + Number(allocation.amount));
  }
  return invoices.map((invoice) => {
    const paidAmount = paidByInvoice.get(invoice.id) ?? 0;
    const merchant = merchantById.get(invoice.merchant_id);
    const subscription = subscriptions.get(invoice.subscription_id);
    return {
      ...invoice,
      merchantName: merchant ? profileNames.get(merchant.owner_user_id) ?? null : null,
      storeName: storeNames.get(invoice.merchant_id) ?? null,
      subscriptionStartsAt: subscription?.starts_at ?? null,
      subscriptionExpiresAt: subscription?.expires_at ?? null,
      paidAmount,
      outstandingAmount: Math.max(0, Number(invoice.total_amount) - paidAmount),
    };
  });
}

export async function getAdminInvoiceDetails(invoiceId: string, force = false): Promise<AdminInvoiceDetails | null> {
  const cached = invoiceDetailCache.get(invoiceId);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  const invoiceResult = await financeClient.from("subscription_invoices")
    .select("id,invoice_number,merchant_id,subscription_id,kind,currency,total_amount,due_at,status,created_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceResult.error) throw invoiceResult.error;
  if (!invoiceResult.data) {
    invoiceDetailCache.set(invoiceId, { data: null, updatedAt: Date.now() });
    return null;
  }
  const [summary] = await enrichInvoiceSummaries([invoiceResult.data as Invoice]);
  const [merchantResult, subscriptionResult, allocationsResult, ledgerResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id,contact_phone,status").eq("id", summary.merchant_id).maybeSingle(),
    financeClient.from("merchant_subscriptions").select("id,plan_name_snapshot").eq("id", summary.subscription_id).maybeSingle(),
    financeClient.from("invoice_payment_allocations").select("invoice_id,payment_id,amount,created_at").eq("invoice_id", summary.id).order("created_at", { ascending: false }),
    financeClient.from("merchant_ledger_entries").select("id,currency,effect,source_type,source_id,amount,created_at").eq("source_type", "subscription_invoice").eq("source_id", summary.id).order("created_at", { ascending: false }),
  ]);
  const allocations = rowsOrEmpty<InvoicePaymentAllocation>(allocationsResult);
  const paymentIds = [...new Set(allocations.map((allocation) => allocation.payment_id))];
  const paymentsResult = paymentIds.length
    ? await financeClient.from("subscription_payments").select("id,merchant_id,currency,amount,method,external_reference,received_at,created_at").in("id", paymentIds)
    : { data: [], error: null };
  const payments = new Map(rowsOrEmpty<Payment>(paymentsResult).map((payment) => [payment.id, payment]));
  const merchant = merchantResult.error ? null : merchantResult.data as { owner_user_id: string; contact_phone: string | null; status: string | null } | null;
  const profileResult = merchant
    ? await financeClient.from("profiles").select("id,full_name").eq("id", merchant.owner_user_id).maybeSingle()
    : { data: null, error: null };
  const detail: AdminInvoiceDetails = {
    ...summary,
    merchantName: profileResult.error ? summary.merchantName : (profileResult.data as { full_name: string | null } | null)?.full_name ?? summary.merchantName,
    merchantPhone: merchant?.contact_phone ?? null,
    merchantStatus: merchant?.status ?? null,
    planName: subscriptionResult.error ? null : (subscriptionResult.data as { plan_name_snapshot: string | null } | null)?.plan_name_snapshot ?? null,
    allocations: allocations.map((allocation) => ({ ...allocation, payment: payments.get(allocation.payment_id) ?? null })),
    ledgerEntries: rowsOrEmpty<LedgerEntry>(ledgerResult),
  };
  invoiceDetailCache.set(invoiceId, { data: detail, updatedAt: Date.now() });
  return detail;
}

const paymentPageCache = new Map<string, { data: AdminPaymentPage; updatedAt: number }>();
const paymentDetailCache = new Map<string, { data: AdminPaymentDetails | null; updatedAt: number }>();

const paymentPageKey = (filter: AdminPaymentFilter, page: number, pageSize: number, search: string) =>
  `${filter}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;

export function getCachedAdminPaymentPage(filter: AdminPaymentFilter, page: number, pageSize: number, search = "") {
  return paymentPageCache.get(paymentPageKey(filter, page, pageSize, search)) ?? null;
}

export function isCachedAdminPaymentPageFresh(filter: AdminPaymentFilter, page: number, pageSize: number, search = "") {
  const cached = getCachedAdminPaymentPage(filter, page, pageSize, search);
  return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs);
}

export function getCachedAdminPayment(paymentId: string) {
  return paymentDetailCache.get(paymentId) ?? null;
}

export function isCachedAdminPaymentFresh(paymentId: string) {
  const cached = getCachedAdminPayment(paymentId);
  return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs);
}

export async function getAdminPaymentPage({
  filter,
  page,
  pageSize = 20,
  force = false,
  search = "",
}: {
  filter: AdminPaymentFilter;
  page: number;
  pageSize?: number;
  force?: boolean;
  search?: string;
}): Promise<AdminPaymentPage> {
  const normalizedSearch = search.trim();
  const cacheKey = paymentPageKey(filter, page, pageSize, normalizedSearch);
  const cached = paymentPageCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;

  let query = financeClient
    .from("subscription_payments")
    .select("id,merchant_id,currency,amount,method,external_reference,received_at,created_at", { count: "exact" })
    .order("received_at", { ascending: false });
  if (filter === "SYP" || filter === "USD") query = query.eq("currency", filter);
  if (filter === "cash" || filter === "external_transfer") query = query.eq("method", filter);
  if (normalizedSearch) {
    const merchantIds = await merchantIdsMatchingFinanceSearch(normalizedSearch);
    const isPaymentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch);
    const safeSearch = normalizedSearch.replace(/[%_,()]/g, "");
    const clauses = [
      safeSearch ? `external_reference.ilike.%${safeSearch}%` : "",
      isPaymentId ? `id.eq.${normalizedSearch}` : "",
      isPaymentId ? `merchant_id.eq.${normalizedSearch}` : "",
      merchantIds.length ? `merchant_id.in.(${merchantIds.join(",")})` : "",
    ].filter(Boolean);
    if (!clauses.length) {
      const empty = { payments: [], hasMore: false, totalCount: 0 };
      paymentPageCache.set(cacheKey, { data: empty, updatedAt: Date.now() });
      return empty;
    }
    query = query.or(clauses.join(","));
  }
  const paymentResult = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (paymentResult.error) throw paymentResult.error;
  const payments = (paymentResult.data ?? []) as Payment[];
  const result = { payments: await enrichPaymentSummaries(payments), hasMore: payments.length === pageSize, totalCount: paymentResult.count ?? payments.length };
  paymentPageCache.set(cacheKey, { data: result, updatedAt: Date.now() });
  return result;
}

async function enrichPaymentSummaries(payments: Payment[]): Promise<AdminPaymentSummary[]> {
  if (!payments.length) return [];
  const merchantIds = [...new Set(payments.map((payment) => payment.merchant_id))];
  const paymentIds = payments.map((payment) => payment.id);
  const [merchantsResult, storesResult, allocationsResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id").in("id", merchantIds),
    financeClient.from("stores").select("merchant_id,name").in("merchant_id", merchantIds),
    financeClient.from("invoice_payment_allocations").select("payment_id,amount").in("payment_id", paymentIds),
  ]);
  const merchants = rowsOrEmpty<{ id: string; owner_user_id: string }>(merchantsResult);
  const profilesResult = merchants.length
    ? await financeClient.from("profiles").select("id,full_name").in("id", merchants.map((merchant) => merchant.owner_user_id))
    : { data: [], error: null };
  const merchantsById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const namesByOwner = new Map(rowsOrEmpty<{ id: string; full_name: string | null }>(profilesResult).map((profile) => [profile.id, profile.full_name]));
  const storesByMerchant = new Map(rowsOrEmpty<{ merchant_id: string; name: string }>(storesResult).map((store) => [store.merchant_id, store.name]));
  const allocationsByPayment = new Map<string, number>();
  for (const allocation of rowsOrEmpty<{ payment_id: string; amount: number }>(allocationsResult)) {
    allocationsByPayment.set(allocation.payment_id, (allocationsByPayment.get(allocation.payment_id) ?? 0) + Number(allocation.amount));
  }
  return payments.map((payment) => {
    const allocatedAmount = allocationsByPayment.get(payment.id) ?? 0;
    const merchant = merchantsById.get(payment.merchant_id);
    return {
      ...payment,
      merchantName: merchant ? namesByOwner.get(merchant.owner_user_id) ?? null : null,
      storeName: storesByMerchant.get(payment.merchant_id) ?? null,
      allocatedAmount,
      unappliedAmount: allocatedAmount <= Number(payment.amount) ? Number(payment.amount) - allocatedAmount : null,
    };
  });
}

export async function getAdminPaymentDetails(paymentId: string, force = false): Promise<AdminPaymentDetails | null> {
  const cached = paymentDetailCache.get(paymentId);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  const paymentResult = await financeClient.from("subscription_payments")
    .select("id,merchant_id,currency,amount,method,external_reference,received_at,created_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentResult.error) throw paymentResult.error;
  if (!paymentResult.data) {
    paymentDetailCache.set(paymentId, { data: null, updatedAt: Date.now() });
    return null;
  }
  const [summary] = await enrichPaymentSummaries([paymentResult.data as Payment]);
  const [merchantResult, allocationsResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id,contact_phone,status").eq("id", summary.merchant_id).maybeSingle(),
    financeClient.from("invoice_payment_allocations").select("invoice_id,payment_id,amount,created_at").eq("payment_id", summary.id).order("created_at", { ascending: false }),
  ]);
  const allocations = rowsOrEmpty<InvoicePaymentAllocation>(allocationsResult);
  const invoiceIds = [...new Set(allocations.map((allocation) => allocation.invoice_id))];
  const invoicesResult = invoiceIds.length
    ? await financeClient.from("subscription_invoices").select("id,invoice_number,currency,total_amount,status").in("id", invoiceIds)
    : { data: [], error: null };
  const invoices = new Map(rowsOrEmpty<Pick<Invoice, "id" | "invoice_number" | "currency" | "total_amount" | "status">>(invoicesResult).map((invoice) => [invoice.id, invoice]));
  const merchant = merchantResult.error ? null : merchantResult.data as { contact_phone: string | null; status: string | null } | null;
  const allocationDetails = allocations.map((allocation) => ({ ...allocation, invoice: invoices.get(allocation.invoice_id) ?? null }));
  const dataIntegrityError = summary.unappliedAmount === null || allocationDetails.some((allocation) => allocation.invoice && allocation.invoice.currency !== summary.currency);
  const detail: AdminPaymentDetails = {
    ...summary,
    merchantPhone: merchant?.contact_phone ?? null,
    merchantStatus: merchant?.status ?? null,
    allocations: allocationDetails,
    dataIntegrityError,
  };
  paymentDetailCache.set(paymentId, { data: detail, updatedAt: Date.now() });
  return detail;
}

const creditPageCache = new Map<string, { data: AdminCreditPage; updatedAt: number }>();
const creditDetailCache = new Map<string, { data: AdminCreditDetails | null; updatedAt: number }>();
const creditPageKey = (filter: AdminCreditFilter, currency: AdminCreditCurrencyFilter, page: number, pageSize: number, search: string) => `${filter}:${currency}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;
export function getCachedAdminCreditPage(filter: AdminCreditFilter, currency: AdminCreditCurrencyFilter, page: number, pageSize: number, search = "") { return creditPageCache.get(creditPageKey(filter, currency, page, pageSize, search)) ?? null; }
export function isCachedAdminCreditPageFresh(filter: AdminCreditFilter, currency: AdminCreditCurrencyFilter, page: number, pageSize: number, search = "") { const cached = getCachedAdminCreditPage(filter, currency, page, pageSize, search); return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs); }
export function getCachedAdminCredit(merchantId: string, currency: FinanceCurrency) { return creditDetailCache.get(`${merchantId}:${currency}`) ?? null; }
export function isCachedAdminCreditFresh(merchantId: string, currency: FinanceCurrency) { const cached = getCachedAdminCredit(merchantId, currency); return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs); }

export async function getAdminCreditPage({ filter, currency, page, pageSize = 20, force = false, search = "" }: { filter: AdminCreditFilter; currency: AdminCreditCurrencyFilter; page: number; pageSize?: number; force?: boolean; search?: string }): Promise<AdminCreditPage> {
  const normalizedSearch = search.trim(); const cacheKey = creditPageKey(filter, currency, page, pageSize, normalizedSearch); const cached = creditPageCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  let query = financeClient.from("merchant_financial_positions").select("merchant_id,currency,invoices_total,payments_allocated,invoice_outstanding,payments_recorded,unapplied_payment_balance,commissions_due,booked_exposure,effective_exposure,credit_enabled,credit_limit,credit_used,credit_available", { count: "exact" }).order("merchant_id", { ascending: true });
  if (currency !== "all") query = query.eq("currency", currency);
  if (filter === "enabled") query = query.eq("credit_enabled", "true");
  if (filter === "disabled") query = query.eq("credit_enabled", "false");
  if (normalizedSearch) {
    const merchantIds = await merchantIdsMatchingFinanceSearch(normalizedSearch);
    const isMerchantId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch);
    const clauses = [isMerchantId ? `merchant_id.eq.${normalizedSearch}` : "", merchantIds.length ? `merchant_id.in.(${merchantIds.join(",")})` : ""].filter(Boolean);
    if (!clauses.length) { const empty = { records: [], hasMore: false, totalCount: 0 }; creditPageCache.set(cacheKey, { data: empty, updatedAt: Date.now() }); return empty; }
    query = query.or(clauses.join(","));
  }
  const positionsResult = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (positionsResult.error) throw positionsResult.error;
  const positions = (positionsResult.data ?? []) as MerchantFinancialPosition[];
  const result = { records: await enrichCreditSummaries(positions), hasMore: positions.length === pageSize, totalCount: positionsResult.count ?? positions.length };
  creditPageCache.set(cacheKey, { data: result, updatedAt: Date.now() }); return result;
}

async function enrichCreditSummaries(positions: MerchantFinancialPosition[]): Promise<AdminCreditSummary[]> {
  if (!positions.length) return [];
  const merchantIds = [...new Set(positions.map((position) => position.merchant_id))];
  const [merchantsResult, storesResult, settingsResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id").in("id", merchantIds),
    financeClient.from("stores").select("merchant_id,name").in("merchant_id", merchantIds),
    financeClient.from("merchant_billing_settings").select("merchant_id,auto_renew").in("merchant_id", merchantIds),
  ]);
  const merchants = rowsOrEmpty<{ id: string; owner_user_id: string }>(merchantsResult);
  const profilesResult = merchants.length ? await financeClient.from("profiles").select("id,full_name").in("id", merchants.map((merchant) => merchant.owner_user_id)) : { data: [], error: null };
  const merchantsById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const namesByOwner = new Map(rowsOrEmpty<{ id: string; full_name: string | null }>(profilesResult).map((profile) => [profile.id, profile.full_name]));
  const storesByMerchant = new Map(rowsOrEmpty<{ merchant_id: string; name: string }>(storesResult).map((store) => [store.merchant_id, store.name]));
  const settingsByMerchant = new Map(rowsOrEmpty<{ merchant_id: string; auto_renew: boolean }>(settingsResult).map((setting) => [setting.merchant_id, setting.auto_renew]));
  return positions.map((position) => { const merchant = merchantsById.get(position.merchant_id); const exposure = Number(position.effective_exposure ?? 0); const limit = Number(position.credit_limit ?? 0); return { ...position, merchantName: merchant ? namesByOwner.get(merchant.owner_user_id) ?? null : null, storeName: storesByMerchant.get(position.merchant_id) ?? null, autoRenew: settingsByMerchant.get(position.merchant_id) ?? false, overLimitAmount: position.credit_enabled ? Math.max(0, exposure - limit) : 0 }; });
}

export async function getAdminCreditDetails(merchantId: string, currency: FinanceCurrency, force = false): Promise<AdminCreditDetails | null> {
  const cacheKey = `${merchantId}:${currency}`; const cached = creditDetailCache.get(cacheKey); if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  const positionResult = await financeClient.from("merchant_financial_positions").select("merchant_id,currency,invoices_total,payments_allocated,invoice_outstanding,payments_recorded,unapplied_payment_balance,commissions_due,booked_exposure,effective_exposure,credit_enabled,credit_limit,credit_used,credit_available").eq("merchant_id", merchantId).eq("currency", currency).maybeSingle();
  if (positionResult.error) throw positionResult.error;
  if (!positionResult.data) { creditDetailCache.set(cacheKey, { data: null, updatedAt: Date.now() }); return null; }
  const [summary] = await enrichCreditSummaries([positionResult.data as MerchantFinancialPosition]);
  if (!summary) throw new Error("credit-position-invalid");
  const merchantResult = await financeClient.from("merchants").select("contact_phone,status").eq("id", merchantId).maybeSingle();
  const merchant = merchantResult.error ? null : merchantResult.data as { contact_phone: string | null; status: string | null } | null;
  const detail = { ...summary, merchantPhone: merchant?.contact_phone ?? null, merchantStatus: merchant?.status ?? null };
  creditDetailCache.set(cacheKey, { data: detail, updatedAt: Date.now() }); return detail;
}

const commissionPageCache = new Map<string, { data: AdminCommissionPage; updatedAt: number }>();
const commissionDetailCache = new Map<string, { data: AdminCommissionDetails | null; updatedAt: number }>();
const commissionPageKey = (filter: AdminCommissionFilter, currency: AdminCommissionCurrencyFilter, page: number, pageSize: number, search: string) => `${filter}:${currency}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;
export function getCachedAdminCommissionPage(filter: AdminCommissionFilter, currency: AdminCommissionCurrencyFilter, page: number, pageSize: number, search = "") { return commissionPageCache.get(commissionPageKey(filter, currency, page, pageSize, search)) ?? null; }
export function isCachedAdminCommissionPageFresh(filter: AdminCommissionFilter, currency: AdminCommissionCurrencyFilter, page: number, pageSize: number, search = "") { const cached = getCachedAdminCommissionPage(filter, currency, page, pageSize, search); return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs); }
export function getCachedAdminCommission(commissionId: string) { return commissionDetailCache.get(commissionId) ?? null; }
export function isCachedAdminCommissionFresh(commissionId: string) { const cached = getCachedAdminCommission(commissionId); return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs); }

export async function getAdminCommissionPage({ filter, currency, page, pageSize = 20, force = false, search = "" }: { filter: AdminCommissionFilter; currency: AdminCommissionCurrencyFilter; page: number; pageSize?: number; force?: boolean; search?: string }): Promise<AdminCommissionPage> {
  const normalizedSearch = search.trim(); const cacheKey = commissionPageKey(filter, currency, page, pageSize, normalizedSearch); const cached = commissionPageCache.get(cacheKey); if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  let query = financeClient.from("store_order_commissions").select("id,store_order_id,merchant_id,currency,commission_rate,base_amount,commission_amount,status,due_at,created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (currency !== "all") query = query.eq("currency", currency); if (filter !== "all") query = query.eq("status", filter);
  if (normalizedSearch) { const merchantIds = await merchantIdsMatchingFinanceSearch(normalizedSearch); const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch); const clauses = [isId ? `id.eq.${normalizedSearch}` : "", isId ? `store_order_id.eq.${normalizedSearch}` : "", isId ? `merchant_id.eq.${normalizedSearch}` : "", merchantIds.length ? `merchant_id.in.(${merchantIds.join(",")})` : ""].filter(Boolean); if (!clauses.length) { const empty = { commissions: [], hasMore: false, totalCount: 0 }; commissionPageCache.set(cacheKey, { data: empty, updatedAt: Date.now() }); return empty; } query = query.or(clauses.join(",")); }
  const commissionsResult = await query.range(page * pageSize, (page + 1) * pageSize - 1); if (commissionsResult.error) throw commissionsResult.error; const commissions = (commissionsResult.data ?? []) as (Commission & { merchant_id: string })[];
  const result = { commissions: await enrichCommissionSummaries(commissions), hasMore: commissions.length === pageSize, totalCount: commissionsResult.count ?? commissions.length }; commissionPageCache.set(cacheKey, { data: result, updatedAt: Date.now() }); return result;
}

async function enrichCommissionSummaries(commissions: (Commission & { merchant_id: string })[]): Promise<AdminCommissionSummary[]> {
  if (!commissions.length) return []; const merchantIds = [...new Set(commissions.map((commission) => commission.merchant_id))]; const commissionIds = commissions.map((commission) => commission.id); const storeOrderIds = commissions.map((commission) => commission.store_order_id);
  const [merchantsResult, storesResult, ordersResult, reversalsResult] = await Promise.all([financeClient.from("merchants").select("id,owner_user_id").in("id", merchantIds), financeClient.from("stores").select("merchant_id,name").in("merchant_id", merchantIds), financeClient.from("store_orders").select("id,customer_order_id").in("id", storeOrderIds), financeClient.from("store_order_commission_reversals").select("commission_id,amount").in("commission_id", commissionIds)]);
  const merchants = rowsOrEmpty<{ id: string; owner_user_id: string }>(merchantsResult); const profilesResult = merchants.length ? await financeClient.from("profiles").select("id,full_name").in("id", merchants.map((merchant) => merchant.owner_user_id)) : { data: [], error: null };
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant])); const namesByOwner = new Map(rowsOrEmpty<{ id: string; full_name: string | null }>(profilesResult).map((profile) => [profile.id, profile.full_name])); const storeNames = new Map(rowsOrEmpty<{ merchant_id: string; name: string }>(storesResult).map((store) => [store.merchant_id, store.name])); const orders = new Map(rowsOrEmpty<{ id: string; customer_order_id: string }>(ordersResult).map((order) => [order.id, order])); const reversalTotals = new Map<string, { amount: number; count: number }>(); for (const reversal of rowsOrEmpty<{ commission_id: string; amount: number }>(reversalsResult)) { const current = reversalTotals.get(reversal.commission_id) ?? { amount: 0, count: 0 }; reversalTotals.set(reversal.commission_id, { amount: current.amount + Number(reversal.amount), count: current.count + 1 }); }
  return commissions.map((commission) => { const merchant = merchantById.get(commission.merchant_id); const reversal = reversalTotals.get(commission.id) ?? { amount: 0, count: 0 }; return { ...commission, merchantName: merchant ? namesByOwner.get(merchant.owner_user_id) ?? null : null, storeName: storeNames.get(commission.merchant_id) ?? null, customerOrderId: orders.get(commission.store_order_id)?.customer_order_id ?? null, reversalTotal: reversal.amount, reversalCount: reversal.count }; });
}

export async function getAdminCommissionDetails(commissionId: string, force = false): Promise<AdminCommissionDetails | null> {
  const cached = commissionDetailCache.get(commissionId); if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  const commissionResult = await financeClient.from("store_order_commissions").select("id,store_order_id,merchant_id,currency,commission_rate,base_amount,commission_amount,status,due_at,created_at").eq("id", commissionId).maybeSingle(); if (commissionResult.error) throw commissionResult.error; if (!commissionResult.data) { commissionDetailCache.set(commissionId, { data: null, updatedAt: Date.now() }); return null; }
  const commission = commissionResult.data as Commission & { merchant_id: string }; const [summary] = await enrichCommissionSummaries([commission]); if (!summary) throw new Error("commission-invalid"); const [reversalsResult, merchantResult, orderResult] = await Promise.all([financeClient.from("store_order_commission_reversals").select("id,commission_id,amount,reason,created_at").eq("commission_id", commission.id).order("created_at", { ascending: false }), financeClient.from("merchants").select("contact_phone,status").eq("id", commission.merchant_id).maybeSingle(), financeClient.from("store_orders").select("status,delivered_at").eq("id", commission.store_order_id).maybeSingle()]);
  const merchant = merchantResult.error ? null : merchantResult.data as { contact_phone: string | null; status: string | null } | null; const order = orderResult.error ? null : orderResult.data as { status: string | null; delivered_at: string | null } | null; const detail = { ...summary, reversals: rowsOrEmpty<CommissionReversal>(reversalsResult), merchantPhone: merchant?.contact_phone ?? null, merchantStatus: merchant?.status ?? null, storeOrderStatus: order?.status ?? null, storeOrderDeliveredAt: order?.delivered_at ?? null }; commissionDetailCache.set(commissionId, { data: detail, updatedAt: Date.now() }); return detail;
}

const ledgerPageCache = new Map<string, { data: AdminLedgerPage; updatedAt: number }>(); const ledgerDetailCache = new Map<string, { data: AdminLedgerDetails | null; updatedAt: number }>();
const ledgerPageKey = (filter: AdminLedgerFilter, currency: AdminLedgerCurrencyFilter, page: number, pageSize: number, search: string) => `${filter}:${currency}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;
export function getCachedAdminLedgerPage(filter: AdminLedgerFilter, currency: AdminLedgerCurrencyFilter, page: number, pageSize: number, search = "") { return ledgerPageCache.get(ledgerPageKey(filter, currency, page, pageSize, search)) ?? null; }
export function isCachedAdminLedgerPageFresh(filter: AdminLedgerFilter, currency: AdminLedgerCurrencyFilter, page: number, pageSize: number, search = "") { const cached = getCachedAdminLedgerPage(filter, currency, page, pageSize, search); return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs); }
export function getCachedAdminLedger(id: string) { return ledgerDetailCache.get(id) ?? null; } export function isCachedAdminLedgerFresh(id: string) { const cached = getCachedAdminLedger(id); return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs); }
export async function getAdminLedgerPage({ filter, currency, page, pageSize = 20, force = false, search = "" }: { filter: AdminLedgerFilter; currency: AdminLedgerCurrencyFilter; page: number; pageSize?: number; force?: boolean; search?: string }): Promise<AdminLedgerPage> { const normalized = search.trim(); const key = ledgerPageKey(filter, currency, page, pageSize, normalized); const cached = ledgerPageCache.get(key); if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data; let query = financeClient.from("merchant_ledger_entries").select("id,merchant_id,currency,effect,source_type,source_id,amount,reversal_of,created_at", { count: "exact" }).order("created_at", { ascending: false }); if (currency !== "all") query = query.eq("currency", currency); if (filter !== "all") query = query.eq("source_type", filter); if (normalized) { const merchantIds = await merchantIdsMatchingFinanceSearch(normalized); const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized); const clauses = [isId ? `id.eq.${normalized}` : "", isId ? `source_id.eq.${normalized}` : "", isId ? `merchant_id.eq.${normalized}` : "", merchantIds.length ? `merchant_id.in.(${merchantIds.join(",")})` : ""].filter(Boolean); if (!clauses.length) { const empty = { entries: [], hasMore: false, totalCount: 0 }; ledgerPageCache.set(key, { data: empty, updatedAt: Date.now() }); return empty; } query = query.or(clauses.join(",")); } const result = await query.range(page * pageSize, (page + 1) * pageSize - 1); if (result.error) throw result.error; const entries = (result.data ?? []) as (LedgerEntry & { merchant_id: string; reversal_of: string | null })[]; const data = { entries: await enrichLedger(entries), hasMore: entries.length === pageSize, totalCount: result.count ?? entries.length }; ledgerPageCache.set(key, { data, updatedAt: Date.now() }); return data; }
async function enrichLedger(entries: (LedgerEntry & { merchant_id: string; reversal_of: string | null })[]): Promise<AdminLedgerSummary[]> { if (!entries.length) return []; const merchantIds = [...new Set(entries.map((entry) => entry.merchant_id))]; const [merchantsResult, storesResult] = await Promise.all([financeClient.from("merchants").select("id,owner_user_id").in("id", merchantIds), financeClient.from("stores").select("merchant_id,name").in("merchant_id", merchantIds)]); const merchants = rowsOrEmpty<{ id: string; owner_user_id: string }>(merchantsResult); const profilesResult = merchants.length ? await financeClient.from("profiles").select("id,full_name").in("id", merchants.map((merchant) => merchant.owner_user_id)) : { data: [], error: null }; const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant])); const names = new Map(rowsOrEmpty<{ id: string; full_name: string | null }>(profilesResult).map((profile) => [profile.id, profile.full_name])); const stores = new Map(rowsOrEmpty<{ merchant_id: string; name: string }>(storesResult).map((store) => [store.merchant_id, store.name])); return entries.map((entry) => { const merchant = merchantById.get(entry.merchant_id); return { ...entry, merchantName: merchant ? names.get(merchant.owner_user_id) ?? null : null, storeName: stores.get(entry.merchant_id) ?? null }; }); }
export async function getAdminLedgerDetails(id: string, force = false): Promise<AdminLedgerDetails | null> { const cached = ledgerDetailCache.get(id); if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data; const result = await financeClient.from("merchant_ledger_entries").select("id,merchant_id,currency,effect,source_type,source_id,amount,reversal_of,created_at").eq("id", id).maybeSingle(); if (result.error) throw result.error; if (!result.data) { ledgerDetailCache.set(id, { data: null, updatedAt: Date.now() }); return null; } const [summary] = await enrichLedger([result.data as LedgerEntry & { merchant_id: string; reversal_of: string | null }]); if (!summary) throw new Error("ledger-entry-invalid"); const merchantResult = await financeClient.from("merchants").select("contact_phone,status").eq("id", summary.merchant_id).maybeSingle(); const merchant = merchantResult.error ? null : merchantResult.data as { contact_phone: string | null; status: string | null } | null; const detail = { ...summary, merchantPhone: merchant?.contact_phone ?? null, merchantStatus: merchant?.status ?? null, invoiceId: summary.source_type === "subscription_invoice" ? summary.source_id : null, paymentId: null, commissionId: summary.source_type === "store_order_commission" ? summary.source_id : null, relatedReversalId: summary.reversal_of }; ledgerDetailCache.set(id, { data: detail, updatedAt: Date.now() }); return detail; }

const subscriptionPageCache = new Map<string, { data: AdminSubscriptionPage; updatedAt: number }>();
const subscriptionDetailCache = new Map<string, { data: AdminSubscriptionDetails | null; updatedAt: number }>();

const subscriptionPageKey = (filter: AdminSubscriptionFilter, page: number, pageSize: number, search: string) =>
  `${filter}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;

export function getCachedAdminSubscriptionPage(filter: AdminSubscriptionFilter, page: number, pageSize: number, search = "") {
  return subscriptionPageCache.get(subscriptionPageKey(filter, page, pageSize, search)) ?? null;
}

export function isCachedAdminSubscriptionPageFresh(filter: AdminSubscriptionFilter, page: number, pageSize: number, search = "") {
  const cached = getCachedAdminSubscriptionPage(filter, page, pageSize, search);
  return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs);
}

export function getCachedAdminSubscription(subscriptionId: string) {
  return subscriptionDetailCache.get(subscriptionId) ?? null;
}

export function isCachedAdminSubscriptionFresh(subscriptionId: string) {
  const cached = getCachedAdminSubscription(subscriptionId);
  return Boolean(cached && Date.now() - cached.updatedAt < financeCacheTtlMs);
}

export async function getAdminSubscriptionPage({
  filter,
  page,
  pageSize = 20,
  force = false,
  search = "",
}: {
  filter: AdminSubscriptionFilter;
  page: number;
  pageSize?: number;
  force?: boolean;
  search?: string;
}): Promise<AdminSubscriptionPage> {
  const normalizedSearch = search.trim();
  const cacheKey = subscriptionPageKey(filter, page, pageSize, normalizedSearch);
  const cached = subscriptionPageCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;

  const now = new Date();
  const nowIso = now.toISOString();
  const graceStartIso = new Date(now.getTime() - subscriptionGraceMs).toISOString();
  const expiringEndIso = new Date(now.getTime() + subscriptionGraceMs).toISOString();
  let query = financeClient.from("merchant_subscriptions")
    .select("id,merchant_id,plan_id,plan_name_snapshot,duration_months,price_snapshot,currency_snapshot,starts_at,expires_at,commission_rate_snapshot", { count: "exact" })
    .lte("starts_at", nowIso)
    .order("expires_at", { ascending: false });
  if (filter === "active") query = query.gt("expires_at", nowIso);
  if (filter === "expiring") query = query.gt("expires_at", nowIso).lte("expires_at", expiringEndIso);
  if (filter === "grace") query = query.lte("expires_at", nowIso).gt("expires_at", graceStartIso);
  if (filter === "expired") query = query.lte("expires_at", graceStartIso);
  if (normalizedSearch) {
    const merchantIds = await merchantIdsMatchingFinanceSearch(normalizedSearch);
    const isSubscriptionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch);
    const clauses = [
      isSubscriptionId ? `id.eq.${normalizedSearch}` : "",
      isSubscriptionId ? `merchant_id.eq.${normalizedSearch}` : "",
      merchantIds.length ? `merchant_id.in.(${merchantIds.join(",")})` : "",
    ].filter(Boolean);
    if (!clauses.length) {
      const empty = { subscriptions: [], hasMore: false, totalCount: 0 };
      subscriptionPageCache.set(cacheKey, { data: empty, updatedAt: Date.now() });
      return empty;
    }
    query = query.or(clauses.join(","));
  }
  const subscriptionsResult = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  const subscriptions = (subscriptionsResult.data ?? []) as MerchantSubscription[];
  const result = {
    subscriptions: await enrichSubscriptionSummaries(subscriptions, now.getTime()),
    hasMore: subscriptions.length === pageSize,
    totalCount: subscriptionsResult.count ?? subscriptions.length,
  };
  subscriptionPageCache.set(cacheKey, { data: result, updatedAt: Date.now() });
  return result;
}

async function enrichSubscriptionSummaries(subscriptions: MerchantSubscription[], now = Date.now()): Promise<AdminSubscriptionSummary[]> {
  if (!subscriptions.length) return [];
  const merchantIds = [...new Set(subscriptions.map((subscription) => subscription.merchant_id))];
  const [merchantsResult, storesResult, settingsResult, planChangesResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id").in("id", merchantIds),
    financeClient.from("stores").select("merchant_id,name").in("merchant_id", merchantIds),
    financeClient.from("merchant_billing_settings").select("merchant_id,auto_renew").in("merchant_id", merchantIds),
    financeClient.from("merchant_subscription_plan_changes").select("merchant_id,plan_name_snapshot,superseded_at,consumed_by_subscription,selected_at").in("merchant_id", merchantIds).order("selected_at", { ascending: false }),
  ]);
  const merchants = rowsOrEmpty<{ id: string; owner_user_id: string }>(merchantsResult);
  const profilesResult = merchants.length
    ? await financeClient.from("profiles").select("id,full_name").in("id", merchants.map((merchant) => merchant.owner_user_id))
    : { data: [], error: null };
  const merchantsById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const namesByOwner = new Map(rowsOrEmpty<{ id: string; full_name: string | null }>(profilesResult).map((profile) => [profile.id, profile.full_name]));
  const storesByMerchant = new Map(rowsOrEmpty<{ merchant_id: string; name: string }>(storesResult).map((store) => [store.merchant_id, store.name]));
  const settingsByMerchant = new Map(rowsOrEmpty<{ merchant_id: string; auto_renew: boolean }>(settingsResult).map((setting) => [setting.merchant_id, setting.auto_renew]));
  const plannedByMerchant = new Map<string, string>();
  for (const change of rowsOrEmpty<{ merchant_id: string; plan_name_snapshot: string; superseded_at: string | null; consumed_by_subscription: string | null }>(planChangesResult)) {
    if (!change.superseded_at && !change.consumed_by_subscription && !plannedByMerchant.has(change.merchant_id)) plannedByMerchant.set(change.merchant_id, change.plan_name_snapshot);
  }
  return subscriptions.flatMap((subscription) => {
    const periodStatus = subscriptionPeriodStatus(subscription, now);
    if (!periodStatus) return [];
    const merchant = merchantsById.get(subscription.merchant_id);
    const expiresAt = new Date(subscription.expires_at).getTime();
    const daysValue = Math.max(0, Math.ceil(Math.abs(expiresAt - now) / (24 * 60 * 60 * 1000)));
    return [{
      ...subscription,
      merchantName: merchant ? namesByOwner.get(merchant.owner_user_id) ?? null : null,
      storeName: storesByMerchant.get(subscription.merchant_id) ?? null,
      autoRenew: settingsByMerchant.get(subscription.merchant_id) ?? false,
      scheduledPlanName: plannedByMerchant.get(subscription.merchant_id) ?? null,
      periodStatus,
      daysValue,
    }];
  });
}

export async function getAdminSubscriptionDetails(subscriptionId: string, force = false): Promise<AdminSubscriptionDetails | null> {
  const cached = subscriptionDetailCache.get(subscriptionId);
  if (!force && cached && Date.now() - cached.updatedAt < financeCacheTtlMs) return cached.data;
  const subscriptionResult = await financeClient.from("merchant_subscriptions")
    .select("id,merchant_id,plan_id,plan_name_snapshot,duration_months,price_snapshot,currency_snapshot,starts_at,expires_at,commission_rate_snapshot")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subscriptionResult.error) throw subscriptionResult.error;
  if (!subscriptionResult.data) {
    subscriptionDetailCache.set(subscriptionId, { data: null, updatedAt: Date.now() });
    return null;
  }
  const subscription = subscriptionResult.data as MerchantSubscription;
  const [summary] = await enrichSubscriptionSummaries([subscription]);
  if (!summary) throw new Error("subscription-period-invalid");
  const [merchantResult, periodsResult, invoicesResult] = await Promise.all([
    financeClient.from("merchants").select("id,owner_user_id,contact_phone,status").eq("id", subscription.merchant_id).maybeSingle(),
    financeClient.from("merchant_subscriptions").select("id,merchant_id,starts_at,expires_at").eq("merchant_id", subscription.merchant_id),
    financeClient.from("subscription_invoices").select("id,invoice_number,subscription_id,currency,total_amount,status,due_at,kind,created_at").eq("subscription_id", subscription.id).order("created_at", { ascending: false }),
  ]);
  const merchant = merchantResult.error ? null : merchantResult.data as { contact_phone: string | null; status: string | null } | null;
  const currentPeriod = latestStartedSubscriptionPeriods(rowsOrEmpty<SubscriptionTiming & { id: string }>(periodsResult)).get(subscription.merchant_id) ?? null;
  const invoice = rowsOrEmpty<Pick<Invoice, "id" | "invoice_number" | "subscription_id" | "currency" | "total_amount" | "status" | "due_at" | "kind" | "created_at">>(invoicesResult)
    .find((item) => item.kind === "initial" || item.kind === "renewal") ?? null;
  const detail: AdminSubscriptionDetails = {
    ...summary,
    merchantPhone: merchant?.contact_phone ?? null,
    merchantStatus: merchant?.status ?? null,
    currentPeriodId: currentPeriod?.id ?? null,
    currentPeriodStatus: currentPeriod ? subscriptionPeriodStatus(currentPeriod) : null,
    invoice: invoice ? { id: invoice.id, invoice_number: invoice.invoice_number, currency: invoice.currency, total_amount: invoice.total_amount, status: invoice.status, due_at: invoice.due_at } : null,
  };
  subscriptionDetailCache.set(subscriptionId, { data: detail, updatedAt: Date.now() });
  return detail;
}

export async function loadMerchantFinanceDetails(merchantId: string): Promise<MerchantFinanceDetails> {
  const [summaries, subscriptionsResult, plansResult, settingsResult, scheduledPlanChangeResult] = await Promise.all([
    loadMerchantFinanceSummaries(),
    financeClient.from("merchant_subscriptions").select("id,merchant_id,plan_id,plan_name_snapshot,duration_months,price_snapshot,currency_snapshot,starts_at,expires_at,commission_rate_snapshot").eq("merchant_id", merchantId).order("expires_at", { ascending: false }),
    financeClient.from("subscription_plans").select("id,name,duration_months,price,currency,is_active,commission_rate").order("duration_months", { ascending: true }),
    financeClient.from("merchant_billing_settings").select("merchant_id,auto_renew").eq("merchant_id", merchantId),
    financeClient.from("merchant_subscription_plan_changes").select("id,plan_id,plan_name_snapshot,duration_months,price_snapshot,currency_snapshot,commission_rate_snapshot,selected_at,superseded_at,consumed_by_subscription").eq("merchant_id", merchantId).order("selected_at", { ascending: false }),
  ]);
  const merchant = summaries.find((summary) => summary.merchantId === merchantId);
  if (!merchant) throw new Error("merchant-not-found");
  return {
    merchant,
    subscriptions: asRows<MerchantSubscription>(subscriptionsResult),
    plans: asRows<SubscriptionPlan>(plansResult),
    billingAutoRenew: asRows<{ merchant_id: string; auto_renew: boolean }>(settingsResult)[0]?.auto_renew ?? false,
    invoices: [],
    payments: [],
    ledgerEntries: [],
    commissions: [],
    commissionReversals: [],
    allocations: [],
    scheduledPlanChange: asRows<ScheduledPlanChange>(scheduledPlanChangeResult).find((change) => !change.superseded_at && !change.consumed_by_subscription) ?? null,
  };
}

export type MerchantFinanceRecordSection = "invoices" | "payments" | "commissions" | "ledger";

export async function loadMerchantFinanceRecordSection(merchantId: string, section: MerchantFinanceRecordSection) {
  if (section === "invoices" || section === "payments") {
    const [invoicesResult, paymentsResult] = await Promise.all([
      financeClient.from("subscription_invoices").select("id,invoice_number,merchant_id,subscription_id,kind,currency,total_amount,due_at,status,created_at").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      financeClient.from("subscription_payments").select("id,merchant_id,currency,amount,method,external_reference,received_at,created_at").eq("merchant_id", merchantId).order("received_at", { ascending: false }),
    ]);
    const invoices = asRows<Invoice>(invoicesResult);
    const payments = asRows<Payment>(paymentsResult);
    const allocationsResult = invoices.length && payments.length
      ? await financeClient.from("invoice_payment_allocations").select("invoice_id,payment_id,amount,created_at").in("invoice_id", invoices.map((invoice) => invoice.id)).order("created_at", { ascending: false })
      : { data: [], error: null };
    return { invoices, payments, allocations: asRows<InvoicePaymentAllocation>(allocationsResult) };
  }

  if (section === "commissions") {
    const commissionsResult = await financeClient.from("store_order_commissions").select("id,store_order_id,currency,commission_rate,base_amount,commission_amount,status,due_at,created_at").eq("merchant_id", merchantId).order("created_at", { ascending: false });
    const commissions = asRows<Commission>(commissionsResult);
    const reversalsResult = commissions.length
      ? await financeClient.from("store_order_commission_reversals").select("id,commission_id,amount,reason,created_at").in("commission_id", commissions.map((commission) => commission.id)).order("created_at", { ascending: false })
      : { data: [], error: null };
    return { commissions, commissionReversals: asRows<CommissionReversal>(reversalsResult) };
  }

  const ledgerResult = await financeClient.from("merchant_ledger_entries").select("id,currency,effect,source_type,source_id,amount,created_at").eq("merchant_id", merchantId).order("created_at", { ascending: false });
  return { ledgerEntries: asRows<LedgerEntry>(ledgerResult) };
}

export async function callFinanceRpc(name: string, args: Record<string, unknown>) {
  const result = await financeClient.rpc(name, args);
  if (result.error) throw result.error;
  return result.data;
}

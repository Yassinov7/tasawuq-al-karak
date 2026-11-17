import type { AccountRoute } from "@/lib/account-routing";

export const financialDocumentTitles: Record<string, string> = {
  INV: "فاتورة شراء",
  SAL: "فاتورة مبيعات المتجر",
  DLV: "مستند تحصيل التوصيل",
  WAG: "مستند استحقاق راتب",
  SUB: "فاتورة اشتراك",
  SET: "مستند تسوية",
  COR: "مستند تصحيح",
};

export function financialDocumentTitle(kind: string) {
  return Object.hasOwn(financialDocumentTitles, kind) ? financialDocumentTitles[kind] : "مستند مالي";
}

export function financialAccountDestination(account: AccountRoute) {
  switch (account) {
    case "/home": return "/invoice";
    case "/merchant": return "/merchant/finance";
    case "/driver": return "/driver/cash-account";
    case "/admin": return "/admin/finance";
    default: return null;
  }
}

export function savedFinancialDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("ar-SY") : null;
}

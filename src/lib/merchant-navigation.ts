export type MerchantSection = "/merchant" | "/merchant/catalog" | "/merchant/orders" | "/merchant/finance" | "/merchant/account";
const pages: Record<string, { title: string; section: MerchantSection; parent?: string }> = {
  "/merchant": { title: "لوحة التاجر", section: "/merchant" },
  "/merchant/catalog": { title: "كتالوج المتجر", section: "/merchant/catalog" },
  "/merchant/products": { title: "منتجات المتجر", section: "/merchant/catalog", parent: "/merchant/catalog" },
  "/merchant/offers": { title: "عروض المتجر", section: "/merchant/catalog", parent: "/merchant/catalog" },
  "/merchant/product-editor": { title: "إضافة منتج", section: "/merchant/catalog", parent: "/merchant/catalog" },
  "/merchant/offer-editor": { title: "إنشاء عرض", section: "/merchant/catalog", parent: "/merchant/catalog" },
  "/merchant/orders": { title: "طلبات المتجر", section: "/merchant/orders" },
  "/merchant/finance": { title: "حسابي المالي", section: "/merchant/finance" },
  "/merchant/financial-sales": { title: "المبيعات والمستحقات", section: "/merchant/finance", parent: "/merchant/finance" },
  "/merchant/financial-sale-details": { title: "تفاصيل عملية البيع", section: "/merchant/finance", parent: "/merchant/financial-sales" },
  "/merchant/settlements": { title: "التسويات المستلمة", section: "/merchant/finance", parent: "/merchant/finance" },
  "/merchant/settlement-details": { title: "تفاصيل التسوية", section: "/merchant/finance", parent: "/merchant/settlements" },
  "/merchant/sales-commissions": { title: "العمولات المستحقة", section: "/merchant/finance", parent: "/merchant/finance" },
  "/merchant/subscription-invoice-details": { title: "فاتورة الاشتراك", section: "/merchant/finance", parent: "/merchant/subscription-invoices" },
  "/merchant/subscription-payment-details": { title: "دفعة الاشتراك", section: "/merchant/finance", parent: "/merchant/subscription-payments" },
  "/merchant/financial-ledger": { title: "دفتر الالتزامات", section: "/merchant/finance", parent: "/merchant/finance" },
  "/merchant/financial-ledger-details": { title: "تفاصيل القيد", section: "/merchant/finance", parent: "/merchant/financial-ledger" },
  "/merchant/subscription-invoices": { title: "فواتير الاشتراك", section: "/merchant/finance", parent: "/merchant/finance" },
  "/merchant/subscription-payments": { title: "مدفوعات الاشتراك", section: "/merchant/finance", parent: "/merchant/finance" },
  "/merchant/account": { title: "حسابي", section: "/merchant/account" },
  "/merchant/personal-info": { title: "المعلومات الشخصية", section: "/merchant/account", parent: "/merchant/account" },
  "/merchant/store-info": { title: "معلومات المتجر", section: "/merchant/account", parent: "/merchant/account" },
  "/merchant/subscription": { title: "فواتير الاشتراك", section: "/merchant/account", parent: "/merchant/account" },
  "/merchant/settings": { title: "الإعدادات", section: "/merchant/account", parent: "/merchant/account" },
  "/merchant/security": { title: "الأمان وكلمة المرور", section: "/merchant/account", parent: "/merchant/account" },
};
export function merchantNavigation(path: string, editing = false) {
  const page = pages[path] ?? { title: "مساحة التاجر", section: "/merchant/account" as const, parent: "/merchant/account" };
  const title = editing && path.endsWith("product-editor") ? "تعديل المنتج" : editing && path.endsWith("offer-editor") ? "تعديل العرض" : page.title;
  return { ...page, title };
}

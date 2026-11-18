import type { MerchantOrder } from "@/lib/merchant-orders";
import type { MoneyInvoice } from "@/lib/invoice-finance";
import { invoicePresentation } from "@/lib/invoice-presentation";

/** The current merchant projection identifies order lines, not distinct catalogue products. */
export function merchantLineSummary(items: MerchantOrder["store_order_items"]) {
  const units = new Map<string, number>();
  const count = items.length;
  const lines = count === 1 ? "بند واحد" : count === 2 ? "بندان" : `${count.toLocaleString("ar-SY")} ${count >= 3 && count <= 10 ? "بنود" : "بندًا"}`;
  for (const item of items) {
    const unit = item.selling_unit_snapshot?.trim();
    const quantity = Math.round(item.quantity * 1000);
    if (!unit || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(quantity)) return lines;
    const total = (units.get(unit) ?? 0) + quantity;
    if (!Number.isSafeInteger(total)) return lines;
    units.set(unit, total);
  }
  const quantities = [...units].map(([unit, value]) => `${(value / 1000).toLocaleString("ar-SY", { maximumFractionDigits: 3 })} ${unit}`).join(" + ");
  return quantities ? `${lines} · ${quantities}` : lines;
}

type Tone = "info" | "warning" | "success" | "muted";
export function compactInvoiceState(invoice: MoneyInvoice, role: "merchant" | "driver") {
  let document: string, tone: Tone;
  if (invoice.voided_by) { document = "أُلغي أثره بتصحيح"; tone = "muted"; }
  else if (invoice.status === "cancelled") { document = "ملغى"; tone = "muted"; }
  else if (invoice.status === "pending") { document = "بانتظار الاعتماد"; tone = "warning"; }
  else if (invoice.status === "confirmed") { document = "صادر ومعتمد"; tone = "info"; }
  else { document = "الحالة غير متاحة"; tone = "muted"; }
  // Never conflate settlement/correction effects, or driver cash custody and wages.
  const purpose = role === "merchant" ? invoice.kind === "SAL" ? "sale" : invoice.kind === "SUB" ? "subscription" : null
    : invoice.kind === "DLV" ? "collection" : invoice.kind === "WAG" ? "wage" : null;
  let payment: string | null = null;
  if (purpose && invoice.status === "confirmed" && !invoice.voided_by && invoice.dues.length > 0
    && invoice.dues.every(due => due.purpose === purpose)) {
    const state = invoicePresentation(invoice);
    const prefix = purpose === "collection" ? "توريد التحصيل" : purpose === "wage" || purpose === "sale" ? "صرف المستحقات" : "سداد الاشتراك";
    const waiting = purpose === "collection" ? "بانتظار التوريد" : purpose === "wage" || purpose === "sale" ? "بانتظار الصرف" : "بانتظار السداد";
    const wording = state.payment === "مسدد بالكامل" ? "مكتمل" : state.payment === "مسدد جزئيًا" ? "جزئي" : waiting;
    if (state.payment) payment = `${prefix} · ${wording}`;
  }
  return { document, tone, payment };
}

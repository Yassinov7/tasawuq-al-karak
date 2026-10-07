import type { Json } from "@/types/database";

export type OrderLineForDisplay = {
  id: string;
  product_title_snapshot: string;
  selling_unit_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  currency: "SYP" | "USD";
  line_total: number;
  offer_snapshot: Json | null;
};

type OfferSnapshot = {
  offer_id: string;
  title: string;
  offer_type: string;
  discount_method: string | null;
  discount_value: number | null;
  bundle_price: number | null;
  currency: "SYP" | "USD";
  original_line_total: number;
  final_line_total: number;
};

export type OrderItemGroup = {
  id: string;
  offerTitle: string | null;
  offerDescription: string | null;
  items: OrderLineForDisplay[];
  currency: "SYP" | "USD";
  originalTotal: number;
  finalTotal: number;
};

function readOfferSnapshot(value: Json | null): OfferSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { [key: string]: Json | undefined };
  const offerId = record.offer_id;
  const title = record.title;
  const offerType = record.offer_type;
  const currency = record.currency;
  const originalTotal = record.original_line_total;
  const finalTotal = record.final_line_total;
  if (
    typeof offerId !== "string" ||
    typeof title !== "string" ||
    typeof offerType !== "string" ||
    (currency !== "SYP" && currency !== "USD") ||
    typeof originalTotal !== "number" ||
    typeof finalTotal !== "number"
  ) {
    return null;
  }
  return {
    offer_id: offerId,
    title,
    offer_type: offerType,
    discount_method:
      typeof record.discount_method === "string" ? record.discount_method : null,
    discount_value:
      typeof record.discount_value === "number" ? record.discount_value : null,
    bundle_price:
      typeof record.bundle_price === "number" ? record.bundle_price : null,
    currency,
    original_line_total: originalTotal,
    final_line_total: finalTotal,
  };
}

function describeOffer(snapshot: OfferSnapshot) {
  const currency = snapshot.currency === "USD" ? "$" : "ل.س";
  if (snapshot.offer_type === "bundle" && snapshot.bundle_price !== null) {
    return `سعر الباقة ${snapshot.bundle_price.toLocaleString("ar")} ${currency}`;
  }
  if (snapshot.offer_type === "discount") {
    return snapshot.discount_method === "percentage"
      ? `خصم ${snapshot.discount_value ?? 0}%`
      : `خصم ${snapshot.discount_value?.toLocaleString("ar") ?? 0} ${currency} لكل وحدة`;
  }
  return "عرض شراء مع هدية";
}

export function groupOrderItems(items: OrderLineForDisplay[]): OrderItemGroup[] {
  const groups = new Map<string, OrderItemGroup>();
  for (const item of items) {
    const snapshot = readOfferSnapshot(item.offer_snapshot);
    const key = snapshot ? `offer:${snapshot.offer_id}` : `item:${item.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      existing.originalTotal += snapshot?.original_line_total ?? item.line_total;
      existing.finalTotal += snapshot?.final_line_total ?? item.line_total;
      continue;
    }
    groups.set(key, {
      id: key,
      offerTitle: snapshot?.title ?? null,
      offerDescription: snapshot ? describeOffer(snapshot) : null,
      items: [item],
      currency: item.currency,
      originalTotal: snapshot?.original_line_total ?? item.line_total,
      finalTotal: snapshot?.final_line_total ?? item.line_total,
    });
  }
  return Array.from(groups.values());
}

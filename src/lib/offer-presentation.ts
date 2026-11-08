import type { CustomerOffer } from "@/lib/customer-offers";
import { calculateCustomerOffer } from "@/lib/customer-offers";
import { formatSyp } from "@/lib/money";

export function formatOfferRule(offer: CustomerOffer) {
  if (offer.offer_type === "discount") {
    return offer.discount_method === "percentage"
      ? `خصم ${offer.discount_value ?? 0}%`
      : `خصم ${formatSyp(offer.discount_value ?? 0)} لكل وحدة`;
  }
  if (offer.offer_type === "bundle") {
    return `سعر الباقة ${formatSyp(offer.bundle_price ?? 0)}`;
  }
  const buy = offer.items.find((item) => item.itemRole === "buy");
  const reward = offer.items.find((item) => item.itemRole === "reward");
  return `اشترِ ${buy?.quantity ?? 0} واحصل على ${reward?.quantity ?? 0} هدية`;
}

export function getOfferPriceSummary(offer: CustomerOffer) {
  const calculation = calculateCustomerOffer(offer);
  return {
    ...calculation,
    rule: formatOfferRule(offer),
    savings: Math.max(0, calculation.originalTotal - calculation.finalTotal),
  };
}

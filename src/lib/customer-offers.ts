import type { Product } from "@/constants/catalog";
import type { PublicOffer } from "@/lib/public-catalog";

export type CustomerOfferItem = {
  id: string;
  itemRole: "discounted" | "bundle" | "buy" | "reward";
  quantity: number;
  product: Product;
};

export type CustomerOffer = PublicOffer & {
  items: CustomerOfferItem[];
};

export type CalculatedOfferItem = CustomerOfferItem & {
  originalLineTotal: number;
  finalLineTotal: number;
};

export type CalculatedOffer = {
  currency: "SYP" | "USD";
  originalTotal: number;
  finalTotal: number;
  items: CalculatedOfferItem[];
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateCustomerOffer(offer: CustomerOffer): CalculatedOffer {
  const originalTotal = roundMoney(
    offer.items.reduce(
      (total, item) => total + roundMoney(item.product.price * item.quantity),
      0,
    ),
  );
  let allocated = 0;

  const items = offer.items.map((item, index) => {
    const originalLineTotal = roundMoney(item.product.price * item.quantity);
    let finalLineTotal = originalLineTotal;

    if (offer.offer_type === "discount") {
      finalLineTotal = offer.discount_method === "percentage"
        ? roundMoney(originalLineTotal * (100 - (offer.discount_value ?? 0)) / 100)
        : roundMoney(
            Math.max(0, item.product.price - (offer.discount_value ?? 0)) *
              item.quantity,
          );
    } else if (offer.offer_type === "bundle") {
      if (index === offer.items.length - 1) {
        finalLineTotal = roundMoney((offer.bundle_price ?? 0) - allocated);
      } else if (originalTotal > 0) {
        finalLineTotal = roundMoney((offer.bundle_price ?? 0) * originalLineTotal / originalTotal);
      } else {
        finalLineTotal = 0;
      }
      allocated = roundMoney(allocated + finalLineTotal);
    } else if (item.itemRole === "reward") {
      finalLineTotal = 0;
    }

    return { ...item, originalLineTotal, finalLineTotal };
  });

  return {
    currency: offer.currency,
    originalTotal,
    finalTotal: roundMoney(items.reduce((total, item) => total + item.finalLineTotal, 0)),
    items,
  };
}

export function describeCustomerOffer(offer: CustomerOffer) {
  if (offer.offer_type === "discount") {
    return offer.discount_method === "percentage"
      ? `خصم ${offer.discount_value}%`
      : `خصم ${offer.discount_value?.toLocaleString("ar")} ${offer.currency === "USD" ? "$" : "ل.س"} لكل وحدة`;
  }

  if (offer.offer_type === "bundle") {
    return `سعر الباقة ${offer.bundle_price?.toLocaleString("ar")} ${offer.currency === "USD" ? "$" : "ل.س"}`;
  }

  const buyItem = offer.items.find((item) => item.itemRole === "buy");
  const rewardItem = offer.items.find((item) => item.itemRole === "reward");
  return `اشترِ ${buyItem?.quantity ?? 0} من ${buyItem?.product.name ?? "المنتج"} واحصل على ${rewardItem?.quantity ?? 0} من ${rewardItem?.product.name ?? "المكافأة"}`;
}

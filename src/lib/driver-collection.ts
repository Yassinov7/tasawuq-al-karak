import { c3Money, type C3Context } from "@/lib/c3-order-contract";

export type DriverCollection =
  | { state: "ready"; amount: number; source: "pricing" }
  | { state: "blocked" }
  | { state: "unavailable" };

export function collectionFromContext(context: C3Context): DriverCollection {
  if (!context.pricing) return { state: "unavailable" };
  if (context.pricing.current.review_required) return { state: "blocked" };
  return { state: "ready", amount: c3Money(context.pricing.current.total), source: "pricing" };
}

export function canProgressDriverCollection(value: DriverCollection | undefined): boolean {
  return value?.state === "ready";
}

export function driverCollectionMessage(value: DriverCollection | undefined): string {
  return value?.state === "blocked"
    ? "المهمة متوقفة بسبب مراجعة التسعير. لا تحصّل مبلغًا ولا تؤكد التسليم حتى تُحسم المراجعة."
    : "تعذر تحميل مبلغ التحصيل";
}

export class DriverCollectionError extends Error {
  readonly collection: DriverCollection;
  constructor(value: DriverCollection | undefined) {
    super(driverCollectionMessage(value));
    this.collection = value ?? { state: "unavailable" };
  }
}

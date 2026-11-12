/** Handwritten finance contracts; C4 decimal amendment is local and unapplied.
 * Replace the database-facing shapes with generated types after deployment.
 * Values use decimal strings because numeric(20 digits) exceeds JS safe integers.
 */
export const financialReferenceKinds = [
  "ORD", "SUB", "INV", "DLV", "SET", "TXN", "RCT", "PAY", "ADJ", "MSB", "SIN",
] as const;

export type FinancialReferenceKind = (typeof financialReferenceKinds)[number];
export type WholeSyp = string & { readonly wholeSyp: unique symbol };
export type SypAmount = string & { readonly sypMajorAmount: unique symbol };
export type FinancialReference = {
  kind: FinancialReferenceKind;
  documentId: string;
  publicReference: string;
};

export type C2JournalLine = {
  accountId: string;
  side: "debit" | "credit";
  amount: SypAmount;
};

export type C2LifecycleEvent = {
  id: string;
  customerOrderId: string;
  storeOrderId: string | null;
  deliveryTaskId: string | null;
  orderSequence: string;
  eventType: string;
  occurredAt: string;
  actorId: string;
  actorRole: "customer" | "merchant" | "driver" | "admin";
  correctionOf: string | null;
};

/** Validation only. Never round a monetary input silently. */
export function sypAmount(value: string): SypAmount {
  if (!/^(0|[1-9]\d{0,19})(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("أدخل مبلغًا بالليرة السورية بمنزلتين عشريتين كحد أقصى.");
  }
  return value as SypAmount;
}

/** Historical integer-only reader. Not the C4 journal-line amount contract. */
export function wholeSyp(value: string): WholeSyp {
  if (!/^(0|[1-9]\d{0,19})$/.test(value)) {
    throw new Error("المبلغ يجب أن يكون عددًا صحيحًا من الليرات السورية ضمن الحد المدعوم.");
  }
  return value as WholeSyp;
}

export function parseFinancialReference(value: string): {
  kind: FinancialReferenceKind;
  number: string;
} | null {
  const match = /^(ORD|SUB|INV|DLV|SET|TXN|RCT|PAY|ADJ|MSB|SIN)-(\d{6,})$/.exec(value);
  if (!match || BigInt(match[2]) === 0n) return null;
  const canonicalDigits = BigInt(match[2]).toString().padStart(6, "0");
  if (canonicalDigits !== match[2] || BigInt(match[2]) > 9223372036854775807n) return null;
  return { kind: match[1] as FinancialReferenceKind, number: BigInt(match[2]).toString() };
}

/** A missing or inconsistent event pair has no valid duration. */
export function lifecycleDurationMs(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return endTime - startTime;
}

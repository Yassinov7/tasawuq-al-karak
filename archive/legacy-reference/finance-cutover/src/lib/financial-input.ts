import { parseOfferDay } from '@/lib/offer-expiration';

/** Decimal validation before Number conversion; never round a submitted amount. */
export function moneyCents(value: string | number): bigint {
  const text = String(value).trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/٫/g, '.');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) throw new Error('أدخل مبلغًا بالأرقام، وبمنزلتين عشريتين كحد أقصى، دون فواصل آلاف.');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function centsAmount(value: bigint) {
  if (value < 0n || value > 99999999999999n) throw new Error('المبلغ خارج الحد المسموح.');
  return Number(value) / 100;
}
export function positiveSypAmount(value: string): number {
  const cents = moneyCents(value.trim().replace(',', '.'));
  if (cents<=0n) throw new Error('أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى.');
  return centsAmount(cents);
}
export function paymentAmount(value: string, remaining: number) {
  const cents = moneyCents(value);
  if (cents <= 0n || cents > moneyCents(remaining)) throw new Error('أدخل مبلغًا موجبًا لا يتجاوز المتبقي.');
  return centsAmount(cents);
}
export function sumMoney(values: readonly number[]) { return centsAmount(values.reduce((sum, value) => sum + moneyCents(value), 0n)); }
export function financialBoundary(value?: string, nextDay = false): string | null {
  if (!value) return null;
  const { year, month, day } = parseOfferDay(value);
  const local = new Date(0); local.setFullYear(year, month - 1, day); local.setHours(0, 0, 0, 0);
  // Midnight gaps may move to the first actual instant of the same day. A skipped whole day is invalid.
  if (local.getFullYear() !== year || local.getMonth() + 1 !== month || local.getDate() !== day) throw new Error('هذا اليوم غير موجود في توقيت الجهاز.');
  if (nextDay) { local.setDate(local.getDate() + 1); local.setHours(0, 0, 0, 0); }
  return local.toISOString();
}
export function financialPeriod(from?: string, to?: string) {
  const start = financialBoundary(from), until = financialBoundary(to, true);
  if (from && to && from > to || start && until && Date.parse(start) >= Date.parse(until)) throw new Error('تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.');
  return { from: start, until };
}
export function validFinancialId(value: string | undefined): asserts value is string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '')) throw new Error('السجل غير موجود أو غير متاح لحسابك.');
}

/** Cursor pages continue until empty, including under a server cap smaller than the requested size. */
export async function allFinancialRows<T extends { id: string | null }>(read: (after: string | null) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [], seen = new Set<string>(); let after: string | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const result = await read(after); if (result.error) throw new Error('تعذر تحميل جميع السجلات المرتبطة.');
    if (!result.data?.length) return rows;
    const next = result.data[result.data.length - 1].id;
    if (!next || next === after || result.data.some(row => !row.id || seen.has(row.id))) throw new Error('تعذر تأكيد اكتمال السجلات. أعد التحديث.');
    for (const row of result.data) { if (!row.id) throw new Error('معرّف مالي غير مكتمل.'); seen.add(row.id); rows.push(row); }
    after = next;
  }
}

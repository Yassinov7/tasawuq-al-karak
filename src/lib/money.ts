/** All application money is denominated in Syrian pounds. Keep two-decimal
 * presentation precision; changing currency must not change financial rounding. */
export function formatSyp(amount: number, ...documentCurrency: [] | [unknown]): string {
  if (documentCurrency.length) requireSyp(documentCurrency[0]);
  return `${formatSypNumber(amount)} ل.س`;
}

/** Number-only rendering where the existing layout owns the adjacent SYP label. */
export function formatSypNumber(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error("مبلغ مالي غير صالح.");
  return new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 2 }).format(amount);
}

export function requireSyp(value: unknown): "SYP" {
  if (value !== "SYP") throw new Error("وحدة المبلغ غير صالحة؛ حدّث البيانات.");
  return value;
}

/** Reject mismatched units at service/cache boundaries instead of relabelling. */
export function assertSypDocuments(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(assertSypDocuments); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (["currency", "currency_snapshot", "plan_currency_snapshot", "delivery_currency"].includes(key)) requireSyp(item);
    else assertSypDocuments(item);
  }
}

/** Exact major-SYP ledger strings, including sums beyond JavaScript Number precision. */
type ExactMoneyLocale={digits:string[];group:string;decimal:string;positive:{prefix:string;suffix:string};negative:{prefix:string;suffix:string}};
let exactMoneyLocale:ExactMoneyLocale|undefined;
function getExactMoneyLocale():ExactMoneyLocale{
  if(exactMoneyLocale)return exactMoneyLocale;
  const formatter=new Intl.NumberFormat('ar-SY');
  const digits=new Intl.NumberFormat('ar-SY',{useGrouping:false});
  const decimal=formatter.formatToParts(1.1).find(part=>part.type==='decimal')?.value;
  if(!decimal)throw new Error('تعذر تنسيق المبلغ.');
  const affixes=(value:number)=>{const parts=formatter.formatToParts(value);const first=parts.findIndex(p=>p.type==='integer');if(first<0)throw new Error('تعذر تنسيق المبلغ.');let last=first;parts.forEach((p,i)=>{if(p.type==='integer')last=i;});return{prefix:parts.slice(0,first).map(p=>p.value).join(''),suffix:parts.slice(last+1).map(p=>p.value).join('')};};
  exactMoneyLocale={digits:Array.from({length:10},(_,i)=>digits.format(i)),group:formatter.formatToParts(1000000).find(p=>p.type==='group')?.value??'',decimal,positive:affixes(1),negative:affixes(-1)};
  return exactMoneyLocale;
}
export function formatSypExact(value: string): string {
  if (typeof value!=='string'||!/^-?(?:0|[1-9]\d{0,39})(?:\.\d{1,2})?$/.test(value)) throw new Error("مبلغ مالي غير صالح.");
  const [whole, fraction = ""] = value.split(".");
  const locale=getExactMoneyLocale(),negative=whole.startsWith('-');
  const localize=(s:string)=>s.replace(/[0-9]/g,d=>locale.digits[Number(d)]);
  // ar-SY uses groups of three. Keep the whole amount as text: some phone Intl
  // implementations reject BigInt, while Number would lose large ledger amounts.
  const grouped=localize((negative?whole.slice(1):whole).replace(/\B(?=(\d{3})+(?!\d))/g,locale.group));
  const tail = fraction.replace(/0+$/, "");
  const affixes=negative?locale.negative:locale.positive;
  return `${affixes.prefix}${grouped}${tail?locale.decimal+localize(tail):''}${affixes.suffix} ل.س`;
}

/** Presentation boundary only. Invalid/unsupported amounts are explicit, never zero. */
export function financialAmountText(value:unknown):string|null{
  try{if(typeof value==='string')return formatSypExact(value);if(typeof value==='number'&&Number.isFinite(value))return formatSyp(value);}catch{/* The UI reports unavailable instead of throwing during render. */}
  return null;
}

import {handoverAmount} from '@/lib/driver-custody-c5';
export function normalizeFinancialRate(value:string):string{
 const s=value.trim().replace(',','.').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/٫/g,'.');
 if(!/^\d{1,3}(?:\.\d{1,4})?$/.test(s))throw Error('أدخل نسبة من 0 إلى 100 بأربع منازل عشرية كحد أقصى.');
 const [w,f='']=s.split('.');const n=BigInt(w)*10000n+BigInt(f.padEnd(4,'0'));if(n>1000000n)throw Error('النسبة من 0 إلى 100 فقط.');
 return `${n/10000n}.${String(n%10000n).padStart(4,'0')}`;
}
function cents(value:string):bigint{const [w,f]=handoverAmount(value,true).split('.');return BigInt(w)*100n+BigInt(f);}
function amount(value:bigint):string{if(value<0n||value>=10000000000000000000000n)throw Error('المبلغ خارج حد دفتر الحسابات.');return `${value/100n}.${String(value%100n).padStart(2,'0')}`;}
/** Matches PostgreSQL numeric round for nonnegative amounts. Used to validate DTO, never to POST an accrual. */
export function calculatePercentage(base:string,rate:string):string{
 const [w,f]=normalizeFinancialRate(rate).split('.');const units=BigInt(w)*10000n+BigInt(f);
 return amount((cents(base)*units+500000n)/1000000n);
}
export function sumFinancialAmounts(values:string[]):string{return amount(values.reduce((a,v)=>a+cents(v),0n));}
export function displayFinancialRate(value:string){return normalizeFinancialRate(value).replace(/0+$/,'').replace(/\.$/,'');}

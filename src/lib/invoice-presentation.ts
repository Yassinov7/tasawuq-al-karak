import type { MoneyInvoice } from "@/lib/invoice-finance";

const cents=(value:string)=>{const [whole,fraction=""]=value.split(".");return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));};
/** Presentation only. Issuance and payment are independent; no due means no inferred payment. */
export function invoicePresentation(invoice: Pick<MoneyInvoice,"status"|"voided_by"|"dues">) {
 if(invoice.voided_by)return {document:"أُلغي أثرها بتصحيح",payment:null,tone:"muted" as const};
 if(invoice.status==="cancelled")return {document:"ملغاة",payment:null,tone:"muted" as const};
 if(invoice.status==="pending")return {document:"معلقة حتى اكتمال الحدث",payment:null,tone:"info" as const};
 if(invoice.status!=="confirmed")return {document:"حالة المستند غير متاحة",payment:null,tone:"muted" as const};
 if(!invoice.dues.length)return {document:"مؤكدة",payment:null,tone:"info" as const};
 const total=invoice.dues.reduce((n,d)=>n+cents(d.amount),0n),remaining=invoice.dues.reduce((n,d)=>n+cents(d.remaining),0n);
 return {document:"مؤكدة",payment:remaining===0n?"مسددة":remaining<total?"مسددة جزئيًا":"غير مسددة",tone:remaining===0n?"success" as const:"info" as const};
}

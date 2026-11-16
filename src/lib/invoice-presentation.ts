import type { MoneyInvoice } from "@/lib/invoice-finance";

const cents=(value:string)=>{const [whole,fraction=""]=value.split(".");return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));};
/** Presentation only. Issuance and payment are independent; no due means no inferred payment. */
export function invoicePresentation(invoice: Pick<MoneyInvoice,"status"|"voided_by"|"dues">) {
 if(invoice.voided_by)return {document:"مصححة وملغى أثرها",payment:null,tone:"muted" as const};
 if(invoice.status==="cancelled")return {document:"ملغاة",payment:null,tone:"muted" as const};
 if(invoice.status==="pending")return {document:"بانتظار اكتمال الطلب",payment:null,tone:"info" as const};
 if(invoice.status!=="confirmed")return {document:"حالة المستند غير متاحة",payment:null,tone:"muted" as const};
 if(!invoice.dues.length)return {document:"صادرة ومعتمدة",payment:null,tone:"info" as const};
 const total=invoice.dues.reduce((n,d)=>n+cents(d.amount),0n),remaining=invoice.dues.reduce((n,d)=>n+cents(d.remaining),0n);
 return {document:"صادرة ومعتمدة",payment:remaining===0n?"مسددة بالكامل":remaining<total?"مسددة جزئيًا":"بانتظار السداد",tone:remaining===0n?"success" as const:"info" as const};
}

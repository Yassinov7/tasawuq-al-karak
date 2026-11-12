import {inspectPendingMoneyAction,readInvoice,moneyPeople,exactAmount,type MoneyAction,type ActionResult} from "@/lib/invoice-finance";
import {supabase} from "@/lib/supabase";

export type PendingMoneyReview={attemptKey:string;input:MoneyAction;label:string;party?:string;partyRole?:string;reference?:string;invoiceId?:string;amount?:string;amountLabel:string;result?:ActionResult;notice?:string};
const labels:Record<string,string>={settle:"تسوية قبض أو صرف",correct:"تصحيح مستند",policy:"تعديل أجر المهام",salary:"استحقاق راتب محفوظ سابقًا"};
/** Enriches the frozen local intent with permitted reads only. Missing context is never invented. */
export async function readPendingMoneyReview(owner:string):Promise<PendingMoneyReview|undefined>{
 const attempt=await inspectPendingMoneyAction(owner);if(!attempt)return;
 const {input,result}=attempt;
 const review:PendingMoneyReview={attemptKey:attempt.key,input,result,label:labels[input.action]??"عملية مالية محفوظة",amountLabel:input.action==="policy"&&input.mode==="percentage"?"النسبة من رسوم التوصيل":"المبلغ",notice:attempt.checkError};
 const amount=input.action==="settle"?input.amount:input.action==="policy"?input.value:undefined;
 if(amount!==undefined){try{review.amount=exactAmount(amount);}catch{review.notice="القيمة المحفوظة غير قابلة للعرض كمبلغ صحيح. راجع نتيجة المحاولة قبل أي إجراء.";}}
 try{
  let invoiceId=input.action==="correct"?input.invoice:undefined;
  if(input.action==="settle"){
   const due=await supabase.from("money_dues").select("invoice_id").eq("id",input.due).maybeSingle();
   if(due.error)throw due.error;invoiceId=due.data?.invoice_id;
  }
  let partyId=input.owner;
  if(invoiceId){const invoice=await readInvoice(invoiceId);review.invoiceId=invoice.id;review.reference=invoice.reference;review.party=invoice.owner_name;partyId=invoice.owner_id;
   if(input.action==="correct")review.amount=invoice.amount;
   if(input.action==="settle"){const due=invoice.dues.find(d=>d.id===input.due);if(due)review.label=due.direction==="in"?"قبض فعلي للمنصة":"صرف فعلي للطرف";}
  }
  if(partyId){const people=await moneyPeople(),party=people.find(p=>p.id===partyId);if(party){review.party=party.name;review.partyRole=party.role==="merchant"?"تاجر":party.role==="driver"?"سائق":undefined;if(!review.reference)review.reference=party.account_reference;}}
 }catch{review.notice=[review.notice,"بعض بيانات الطرف أو المستند غير متاحة حاليًا؛ لم نبدّل بيانات المحاولة المحفوظة."].filter(Boolean).join(" ");}
 const identity=await supabase.auth.getUser();if(identity.error||identity.data.user?.id!==owner)throw Error("تغير الحساب؛ أعد فتح المالية.");
 return review;
}

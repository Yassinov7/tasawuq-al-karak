import {useFinancialOperation} from '@/hooks/useFinancialOperation';
import {restoreC6Input,runC6Operation,finishC6Operation,type WageResult} from '@/lib/driver-wages-c6';
const api={restore:restoreC6Input,run:runC6Operation,finish:finishC6Operation};
export function useWageOperation(actor:string,scope:string,onRefresh:()=>void){return useFinancialOperation(actor,scope,onRefresh,api);}

export function wageResultMessage(result:WageResult){
 if(result.state==='unknown')return 'النتيجة غير محسومة. تحقق من المحاولة المحفوظة أو تابع بالمفتاح نفسه؛ لا نعيد الصرف تلقائيًا.';
 if(result.state==='rejected')return({policy_changed:'تغيرت السياسة؛ حدّث البيانات قبل تعديل مستقل.',payout_disabled:'الصرف غير متاح حاليًا.',ledger_requires_review:'تحتاج القيود إلى مراجعة قبل الصرف.',wage_not_available:'الأجرة غير متاحة أو صُرفت سابقًا أو لم تُغلق عهدة مهمتها.',amount_changed:'المبلغ لا يطابق الاستحقاقات المثبتة.',insufficient_treasury:'رصيد الخزينة المرحّل لا يغطي هذا الصرف.'}[result.code]??'رفض الخادم هذه المحاولة.');
 return result.kind==='policy'?'حُفظت النسبة للمهام الجديدة فقط.':`تأكد صرف الأجرة بالإيصال ${result.reference}.`;
}

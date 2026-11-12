import {useCallback,useRef,useState} from "react";
import {useFocusEffect,useRouter} from "expo-router";
import {ActivityIndicator,Text} from "react-native";
import {AppButton} from "@/components/ui/AppButton";
import {DocumentReference} from "@/components/ui/DocumentReference";
import {Typography} from "@/constants/theme";
import {useTheme} from "@/context/ThemeContext";
import {readPendingMoneyReview,type PendingMoneyReview} from "@/lib/pending-money-review";
import {FinancialAmount,FinancialFeedback,FinancialSection} from "./FinancialParts";

export function PendingMoneyCard({owner,busy,onResume,onRefresh}:{owner:string;busy:boolean;onResume:(attemptKey:string)=>Promise<void>;onRefresh:()=>Promise<void>}){
 const {colors}=useTheme(),router=useRouter();
 const [review,setReview]=useState<PendingMoneyReview>(),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const active=useRef(false),generation=useRef(0);
 const read=useCallback(async()=>{const token=++generation.current;setLoading(true);setError("");try{const value=await readPendingMoneyReview(owner);if(active.current&&generation.current===token)setReview(value);}catch{if(active.current&&generation.current===token)setError("تعذر قراءة المحاولة. تحقق من الاتصال والحساب؛ لم تُرسل أي عملية مالية.");}finally{if(active.current&&generation.current===token)setLoading(false);}},[owner]);
 useFocusEffect(useCallback(()=>{active.current=true;void read();return()=>{active.current=false;generation.current++;};},[read]));
 const body={...Typography.body,color:colors.text,textAlign:"right" as const};
 return <FinancialSection title="مراجعة العملية المحفوظة">
  <Text style={body}>فتح هذه البطاقة والتحقق فقط لا ينفذان قبضًا أو صرفًا. المحاولة محفوظة لمنع تكرار العملية؛ حفظها وحده لا يثبت نجاحها أو فشلها.</Text>
  {loading?<ActivityIndicator color={colors.primary}/>:null}
  {review?<>
   <Text style={body}>نوع العملية: {review.label}</Text>
   <Text style={body}>الطرف: {review.party??"تعذر تحديد الاسم من البيانات المتاحة"}{review.partyRole?` · ${review.partyRole}`:""}</Text>
   {review.reference?<><Text style={body}>{review.invoiceId?"مرجع الفاتورة المرتبطة":"المرجع المتاح"}</Text><DocumentReference value={review.reference}/></>:<Text style={body}>لا يتوفر مرجع مقروء مؤكد حاليًا. لم ننشئ رقمًا بديلًا.</Text>}
   {review.amount!==undefined?review.amountLabel==="النسبة من رسوم التوصيل"?<Text style={body}>{review.amountLabel}: {review.amount}٪</Text>:<FinancialAmount label={review.input.action==="correct"?"قيمة المستند المراد تصحيحه":review.amountLabel} amount={review.amount}/>:<Text style={body}>المبلغ النهائي غير متاح في البيانات المحفوظة.</Text>}
   <Text style={body}>السبب المسجل: {review.input.reason||"غير متاح"}</Text>
   <FinancialFeedback message={review.result?.state==="completed"?"الخادم يؤكد اكتمال المحاولة. حدّث الحساب أو استكمل معالجة النتيجة المحفوظة.":review.result?.state==="rejected"?`الخادم رفض المحاولة: ${review.result.message}`:"النتيجة غير محسومة. لا توجد نتيجة مؤكدة متاحة الآن؛ لا نفترض أن المال قُبض أو صُرف."}/>
   {review.notice?<FinancialFeedback message={review.notice}/>:null}
   {review.invoiceId?<AppButton title="مراجعة المستند المرتبط" variant="outline" disabled={busy} onPress={()=>router.push({pathname:"/financial-invoice",params:{id:review.invoiceId!}})}/>:null}
  </>:!loading&&!error?<Text style={body}>لا توجد محاولة محفوظة الآن؛ حدّث الشاشة قبل بدء إجراء آخر.</Text>:null}
  {error?<FinancialFeedback message={error} error/>:null}
  <AppButton title="التحقق فقط — دون تنفيذ" variant="outline" disabled={busy||loading} onPress={()=>void read()}/>
  {review?<AppButton title={review.result?"معالجة نتيجة المحاولة المحفوظة":"مراجعة واستكمال المحاولة نفسها"} disabled={busy||loading||!!error} loading={busy} onPress={()=>void onResume(review.attemptKey)}/>:null}
  <AppButton title="تحديث الحساب والفاتورة" variant="outline" disabled={busy||loading} onPress={()=>void onRefresh()}/>
 </FinancialSection>;
}

import {FinancialDatePicker} from '@/components/merchant/FinancialDatePicker';
import {localOfferFields,localOfferEndInstant} from '@/lib/offer-expiration';
import {useFocusEffect} from 'expo-router';
import {useCallback,useMemo,useState,type ReactNode} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AppButton} from '@/components/ui/AppButton';
import {AppTextField} from '@/components/ui/AppTextField';
import {AppModal} from '@/components/ui/AppModal';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {DocumentReference} from '@/components/ui/DocumentReference';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {FinancialOperationControls} from '@/components/ui/FinancialOperationControls';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {useFinancialOperation} from '@/hooks/useFinancialOperation';
import {getSubscription,restoreSubscriptionInput,runSubscriptionOperation,finishSubscriptionOperation,type SubscriptionInput,type SubscriptionInvoice} from '@/lib/subscription-accounts';
import {handoverAmount} from '@/lib/driver-custody-c5';
const api={restore:restoreSubscriptionInput,run:runSubscriptionOperation,finish:finishSubscriptionOperation};
const stateLabels={active:'نشط ومدفوع',grace_period:'فترة السماح',expired:'لا توجد فترة مدفوعة سارية',suspended:'معلق إداريًا',cancelled:'ملغى إداريًا'};
const dates=(s:string|null)=>s?new Date(s).toLocaleString('ar-SY'):'غير متوفر';
export function SubscriptionAccountPanel({merchantId=null,admin=false,legacyContent}:{merchantId?:string|null;admin?:boolean;legacyContent?:ReactNode}){
 const {user}=useAuth(),{colors}=useTheme(),actor=user?.id??'',scope=`${actor}:${merchantId??'own'}`;
 const [page,setPage]=useState(0),[reason,setReason]=useState(''),[counted,setCounted]=useState(''),[localError,setLocalError]=useState('');
 const [confirmation,setConfirmation]=useState<{scope:string;invoice:SubscriptionInvoice}|null>(null);
 const [plan,setPlan]=useState<{scope:string;id:string;name:string;description:string;price:string;months:string;available:boolean;effectiveDay:string}|null>(null);
 const read=useCallback(()=>getSubscription(actor,merchantId,page),[actor,merchantId,page]);const {data,loading,error,refresh}=useCustodyRead(`subscription:${scope}:${page}`,read);
 useFocusEffect(useCallback(()=>{const timer=setInterval(refresh,60000);return()=>clearInterval(timer);},[refresh]));
 const operation=useFinancialOperation(actor,data?.merchant_id??merchantId??'unresolved',refresh,api);
 const active=confirmation?.scope===scope?confirmation.invoice:null,p=plan?.scope===scope?plan:null;
 const disabled=operation.busy||Boolean(operation.frozen)||loading||Boolean(error)||!data?.operations_enabled;
 const run=(input:SubscriptionInput)=>{setLocalError('');return operation.run(input);};
 const subscriptions=useMemo(()=>[{table:'subscription_plan_versions' as const},{table:'subscription_memberships' as const},{table:'subscription_account_events' as const},{table:'subscription_billing_documents' as const},{table:'subscription_cash_receipts' as const}],[]);
 useOrderRealtime({channelName:`subscription:${scope}`,enabled:Boolean(actor),subscriptions,onChange:refresh});
 const tx=()=>({ ...Typography.body,color:colors.textSecondary,textAlign:'right' as const});
 return <View style={{gap:Spacing.three,padding:Spacing.four,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:16}}>
 <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>الاشتراك والفواتير</Text>
 {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
 <AppButton design="refined" title="تحديث الاشتراك" variant="outline" disabled={operation.busy} onPress={refresh}/>
 {data?<>
 {!data.operations_enabled?<FinancialStatus label="عمليات الاشتراك غير متاحة حاليًا؛ البيانات للقراءة والمراجعة." tone="info"/>:null}
 {!data.managed?<FinancialStatus label="هذا الحساب ما زال على النظام السابق؛ لا انتقال تلقائي" tone="info"/>:<>
 <FinancialStatus label={stateLabels[data.state.state]} tone={data.state.state==='active'?'success':data.state.state==='grace_period'?'warning':'error'}/>
 <Text style={tx()}>الخطة المدفوعة: {data.state.plan_name??'لا توجد فترة مدفوعة'}</Text>{data.state.paid_price!==null?<FinancialAmount label={`سعر الفترة المدفوعة — ${data.state.paid_months} شهر`} amount={data.state.paid_price}/>:null}<Text style={tx()}>نهاية الفترة المدفوعة: {dates(data.state.paid_until)}</Text>
 <Text style={tx()}>الأيام المتبقية وفق وقت الخادم: {data.state.paid_until?Math.max(0,Math.ceil((Date.parse(data.state.paid_until)-Date.parse(data.state.server_time))/86400000)):0}</Text>
 <Text style={tx()}>نهاية السماح (168 ساعة): {dates(data.state.grace_until)}</Text>
 {data.state.state==='grace_period'?<FinancialStatus label={`يبقى استقبال الطلبات متاحًا حتى ${dates(data.state.grace_until)} وفق شروط المتجر. فاتورة التجديد ليست مدفوعة بمجرد إصدارها.`} tone="warning"/>:null}
 {data.state.administrative_reason?<Text style={tx()}>سبب الإجراء الإداري: {data.state.administrative_reason}</Text>:null}
 <FinancialAmount label="ذمة الاشتراك في دفتر C2" amount={data.outstanding}/>
 {data.review_required?<FinancialStatus label="تعارض في دفتر الاشتراك؛ يحتاج مراجعة قبل التحصيل" tone="error"/>:null}
 <Text style={tx()}>طريقة التجديد: {{automatic:'إصدار فاتورة تلقائيًا عند نهاية الفترة — دون دفع تلقائي',manual:'عند طلب التجديد يدويًا',disabled:'عدم إصدار تجديد جديد'}[data.state.renewal_mode]}</Text>
 <Text style={tx()}>إيقاف التجديد لا يلغي الفترة المدفوعة أو الفواتير الصادرة. لا خصم من مستحقات المبيعات.</Text>
 {(['automatic','manual','disabled'] as const).map(mode=><AppButton key={mode} design="refined" variant="outline" title={mode==='automatic'?'تفعيل التجديد التلقائي':mode==='manual'?'التجديد يدويًا':'إيقاف التجديد'} disabled={disabled||admin&&!data.capabilities.issue||data.state.renewal_mode===mode} onPress={()=>void run({kind:'mode',merchantId:data.merchant_id,mode,reason:admin?reason:'تغيير اختيار التجديد بواسطة التاجر'})}/>)}
 {(admin&&data.capabilities.issue||!admin&&data.state.renewal_mode==='manual')?<AppButton design="refined" title="تجديد الاشتراك / عرض الفاتورة القائمة" disabled={disabled||['suspended','cancelled'].includes(data.state.state)} onPress={()=>void run({kind:'issue',merchantId:data.merchant_id,reason:admin?reason:'طلب تجديد يدوي بواسطة التاجر'})}/>:null}
 </>}
 {admin?<>
 <AppTextField design="refined" label="سبب الإجراء الإداري" value={reason} onChangeText={setReason} disabled={disabled} multiline/>
 {!data.gate_enabled?<FinancialStatus label="بوابة C8 لاستقبال الطلبات مغلقة؛ لم تُفعّل على المتاجر" tone="info"/>:null}
 {data.managed?(['suspend','resume','cancel'] as const).map(action=><AppButton key={action} design="refined" title={action==='suspend'?'تعليق استقبال الطلبات الجديدة':action==='resume'?'رفع التعليق':'إلغاء استثنائي دون حذف الدين أو رد تلقائي'} variant="outline" disabled={disabled||!data.capabilities[action]||data.state.state==='cancelled'||action==='resume'&&data.state.state!=='suspended'} onPress={()=>void run({kind:action,merchantId:data.merchant_id,reason})}/>):null}
 </>:null}
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>الخطط والأسعار المثبتة</Text>
 {data.plans.map(v=><View key={v.plan_id} style={{gap:Spacing.two,borderTopWidth:1,borderColor:colors.border,paddingTop:Spacing.three}}><Text style={tx()}>{v.name??v.base_name}</Text><Text style={tx()}>{v.description??'لم يُضبط إصدار C8 لهذه الخطة بعد.'}</Text>{v.price!==null?<FinancialAmount label={`${v.months} شهر`} amount={v.price}/>:null}<Text style={tx()}>السريان: {dates(v.effective_at)} · {v.available?'متاحة':'غير متاحة لإصدارات جديدة'}</Text>
 {admin&&data.capabilities.plans?<AppButton design="refined" title="إعداد إصدار سعر ومدة جديد" variant="outline" disabled={disabled} onPress={()=>setPlan({scope,id:v.plan_id,name:v.name??v.base_name,description:v.description??'',price:v.price??'',months:String(v.months??1),available:v.available??true,effectiveDay:''})}/>:null}
 {admin&&!data.managed&&data.capabilities.issue?<AppButton design="refined" title="إدخال صريح إلى C8 بهذه الخطة" disabled={disabled||!v.available} onPress={()=>void run({kind:'enroll',merchantId:data.merchant_id,planId:v.plan_id,reason})}/>:null}
 </View>)}
 {p?<View style={{gap:Spacing.two}}><AppTextField design="refined" label="اسم الخطة" value={p.name} onChangeText={name=>setPlan({...p,name})} disabled={disabled}/><AppTextField design="refined" label="الوصف" value={p.description} onChangeText={description=>setPlan({...p,description})} disabled={disabled}/><AppTextField design="refined" label="السعر بالليرة السورية" value={p.price} keyboardType="decimal-pad" onChangeText={price=>setPlan({...p,price})} disabled={disabled}/><AppTextField design="refined" label="المدة بالأشهر (1–60)" value={p.months} keyboardType="number-pad" onChangeText={months=>setPlan({...p,months})} disabled={disabled}/><AppButton design="refined" title={p.available?'متاحة — اضغط لإيقاف الإصدارات الجديدة':'موقوفة — اضغط للإتاحة'} variant="outline" disabled={disabled} onPress={()=>setPlan({...p,available:!p.available})}/>{!disabled?<FinancialDatePicker title="تاريخ السريان — فارغ يعني فورًا" value={p.effectiveDay} onChange={effectiveDay=>setPlan({...p,effectiveDay})}/>:null}<AppButton design="refined" title="اختيار السريان الفوري" variant="outline" disabled={disabled} onPress={()=>setPlan({...p,effectiveDay:''})}/><AppButton design="refined" title="حفظ إصدار دون تغيير الفواتير السابقة" disabled={disabled} onPress={()=>{if(!/^\d{1,2}$/.test(p.months)){setLocalError('أدخل عدد أشهر صحيحًا.');return;}let effectiveAt:string|null=null;try{if(p.effectiveDay){const today=localOfferFields(Date.now()).date;if(p.effectiveDay<today)throw Error('past');effectiveAt=p.effectiveDay===today?null:localOfferEndInstant(p.effectiveDay,'00:00');}}catch{setLocalError('اختر تاريخ سريان اليوم أو يومًا مستقبليًا صالحًا.');return;}void run({kind:'plan',merchantId:data.merchant_id,planId:p.id,name:p.name,description:p.description,price:p.price,months:Number(p.months),available:p.available,effectiveAt,reason}).then(r=>{if(r?.state==='completed')setPlan(null);});}}/><AppButton design="refined" title="إغلاق مسودة الخطة" variant="outline" disabled={operation.busy} onPress={()=>setPlan(null)}/></View>:null}
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>تاريخ تغييرات الخطط</Text>{data.plan_history.map((h,i)=><View key={`${h.effective_at}:${i}`}><Text style={tx()}>{h.name} · {h.months} شهر · {dates(h.effective_at)} · {h.reason}</Text><FinancialAmount amount={h.price}/></View>)}
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>الفواتير وإيصالات القبض</Text>
 {!data.invoices.length?<Text style={tx()}>لا توجد فواتير C8 في هذه الصفحة.</Text>:null}
 {data.invoices.map(i=><View key={i.id} style={{gap:Spacing.two,borderTopWidth:1,borderColor:colors.border,paddingTop:Spacing.three}}><DocumentReference value={i.reference}/><Text style={tx()}>{i.plan_name} · {i.months} شهر</Text><FinancialAmount label="مبلغ الفاتورة المثبت" amount={i.amount}/><FinancialStatus label={i.status==='voided'?'معكوسة محاسبيًا — دون افتراض استرداد نقدي':i.status==='paid'?'مسددة بقبض مؤكد':'صادرة وغير مدفوعة'} tone={i.status==='voided'?'error':i.status==='paid'?'success':'warning'}/><Text style={tx()}>الفترة المجدولة المثبتة: {dates(i.period_start_snapshot)} — {dates(i.period_end_snapshot)}</Text>{i.receipt_reference?<><DocumentReference value={i.receipt_reference}/><FinancialAmount label="المقبوض" amount={i.paid_amount!}/><Text style={tx()}>الفترة المدفوعة الفعلية: {dates(i.starts_at)} — {dates(i.expires_at)}</Text></>:null}{admin&&data.capabilities.collect&&i.status==='unpaid'?<AppButton design="refined" title="تأكيد قبض كامل الفاتورة نقدًا" disabled={disabled||data.review_required} onPress={()=>{setCounted('');setConfirmation({scope,invoice:i});}}/>:null}</View>)}
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>سجل اختيار التجديد والإجراءات</Text>{data.events.map((e,index)=><Text key={`${e.at}:${index}`} style={tx()}>{dates(e.at)} · {e.kind==='renewal'?({automatic:'تجديد تلقائي',manual:'تجديد يدوي',disabled:'إيقاف التجديد'} as Record<string,string>)[e.value]??e.value:stateLabels[e.value as keyof typeof stateLabels]??e.value} · {e.reason}</Text>)}
 <AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading||operation.busy} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data.has_more||loading||operation.busy} onPress={()=>setPage(p=>p+1)}/>
 </>:null}
 {localError?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{localError}</Text>:null}
 <FinancialOperationControls busy={operation.busy} error={operation.error} frozen={Boolean(operation.frozen)} result={operation.result} message={operation.result?.state==='completed'?`أكد الخادم العملية${operation.result.reference?` — ${operation.result.reference}`:''}.`:operation.result?.state==='rejected'?({voided_period_requires_review:'الفترة مرتبطة بعكس محاسبي؛ يلزم إجراء تصحيح مستقل قبل إعادة الفوترة.',gate_not_enabled:'يلزم تفعيل بوابة C8 قبل الإدخال الصريح.',transition_required:'تعذر الانتقال: توجد فترة أو مديونية أو رصيد سابق يحتاج تسوية مستقلة.',plan_unavailable:'الخطة غير متاحة أو غير مضبوطة.',invalid_effective_time:'تاريخ السريان لم يعد صالحًا.',administrative_state:'الإجراء غير متاح للحالة الإدارية الحالية.',renewal_not_due:'الفترة المدفوعة القادمة لم تبدأ بعد.',subscription_stopped:'الحساب متوقف إداريًا.',amount_mismatch:'المبلغ المعدود لا يطابق الفاتورة.',ledger_requires_review:'دفتر الاشتراك يحتاج مراجعة.',invoice_unavailable:'قيد الفاتورة غير متاح للتحصيل.'}[operation.result.code]??'رفض الخادم المحاولة. تحقق من المحاولة النهائية قبل إجراء مستقل.'):'النتيجة غير محسومة. تحقق من المحاولة دون تكرار القبض الفعلي.'} onRecover={()=>void operation.run(undefined,true)} onResume={()=>void operation.run()} onFinish={()=>void operation.finish()}/>
 <AppModal design="refined" visible={Boolean(active)} title="تأكيد القبض النقدي الفعلي" message="أكد بعد عد كامل المبلغ فقط. إصدار الفاتورة لا يعني قبضها." confirmText="تأكيد كامل المقبوض" cancelText="إلغاء" busy={operation.busy} onCancel={()=>{if(!operation.busy)setConfirmation(null);}} onConfirm={()=>{if(active&&data){try{if(handoverAmount(counted)!==handoverAmount(active.amount)){setLocalError('المبلغ المعدود يجب أن يطابق كامل الفاتورة.');return;}}catch{setLocalError('أدخل المبلغ المعدود بدقة منزلتين.');return;}void run({kind:'collect',merchantId:data.merchant_id,invoiceId:active.id,amount:counted,reason}).then(r=>{if(r)setConfirmation(null);});}}}>{active?<><DocumentReference value={active.reference}/><FinancialAmount amount={active.amount}/><AppTextField design="refined" label="المبلغ المعدود فعليًا" value={counted} onChangeText={setCounted} keyboardType="decimal-pad" disabled={operation.busy}/>{localError?<Text style={{color:colors.errorForeground}}>{localError}</Text>:null}{operation.error?<Text style={{color:colors.errorForeground}}>{operation.error}</Text>:null}</>:null}</AppModal>
 {legacyContent&&(!data||!data.managed)?<><Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>النظام السابق — معلومات مستقلة</Text>{legacyContent}</>:null}
 </View>;
}

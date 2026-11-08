import {useCallback,useMemo,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {DocumentReference} from '@/components/ui/DocumentReference';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {FinancialOperationControls} from '@/components/ui/FinancialOperationControls';
import {AppButton} from '@/components/ui/AppButton';
import {AppModal} from '@/components/ui/AppModal';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {useFinancialOperation} from '@/hooks/useFinancialOperation';
import {sumFinancialAmounts,displayFinancialRate} from '@/lib/financial-decimal';
import {getC7Settlements,restoreC7Input,runC7Operation,finishC7Operation,type MerchantSub,type MerchantSettlement,type SettlementResult} from '@/lib/merchant-settlements-c7';
const api={restore:restoreC7Input,run:runC7Operation,finish:finishC7Operation};
function resultMessage(r:SettlementResult){if(r.state==='unknown')return 'النتيجة غير محسومة. تحقق من المحاولة؛ لا تكرر الدفع الفعلي.';if(r.state==='completed')return r.kind==='settlement'?`أُعدت التسوية ${r.reference}؛ لم يسجل صرف نقدي.`:`تأكد الصرف بالمرجع ${r.reference}.`;return({settlements_disabled:'إعداد التسويات متوقف حاليًا.',payout_disabled:'الصرف متوقف حاليًا.',ledger_requires_review:'تحتاج المستحقات إلى مراجعة قبل الصرف.',sub_not_available:'أحد المستحقات غير متاح أو مدرج سابقًا.',amount_changed:'المبلغ لا يطابق المستندات المعتمدة.',insufficient_treasury:'رصيد خزينة C2 لا يغطي الصرف.'}[r.code]??'رفض الخادم المحاولة.');}
export function MerchantSettlementPanel({storeId=null,admin=false}:{storeId?:string|null;admin?:boolean}){
 const {user}=useAuth(),{colors}=useTheme(),actor=user?.id??'',scope=`${actor}:${storeId??'own'}`;
 const [page,setPage]=useState(0),[selection,setSelection]=useState<{scope:string;rows:MerchantSub[]}>({scope:'',rows:[]}),[confirm,setConfirm]=useState<{scope:string;row:MerchantSettlement}|null>(null);
 const read=useCallback(()=>getC7Settlements(actor,storeId,page),[actor,storeId,page]);const {data,loading,error,refresh}=useCustodyRead(`c7:${scope}:${page}`,read);
 const operation=useFinancialOperation(actor,data?.store_id??storeId??'unresolved',refresh,api);
 const selected=selection.scope===scope?selection.rows:[],active=confirm?.scope===scope?confirm.row:null;
 let selectedTotal='',selectionError='';try{if(selected.length)selectedTotal=sumFinancialAmounts(selected.map(s=>s.net));}catch{selectionError='مجموع الاختيار يتجاوز حد المستند؛ اختر عددًا أقل من المستحقات.';}
 const toggle=(row:MerchantSub)=>setSelection(previous=>{const rows=previous.scope===scope?previous.rows:[];return{scope,rows:rows.some(r=>r.store_order_id===row.store_order_id)?rows.filter(r=>r.store_order_id!==row.store_order_id):[...rows,row]};});
 const subscriptions=useMemo(()=>[{table:'merchant_delivery_positions' as const,...(data?{filter:`store_id=eq.${data.store_id}`}:{})},{table:'merchant_settlement_documents' as const,...(data?{filter:`store_id=eq.${data.store_id}`}:{})},{table:'c7_merchant_settlement_payments' as const,...(data?{filter:`store_id=eq.${data.store_id}`}:{})},{table:'driver_cash_handover_attempts' as const}],[data]);
 useOrderRealtime({channelName:`c7:${scope}`,enabled:Boolean(actor),subscriptions,onChange:refresh});
 const disabled=loading||Boolean(error)||operation.busy||Boolean(operation.frozen)||data?.position.review_required;
 const labels={available:'جاهز لإعداد تسوية',pending:'قيد التسوية — لم يصرف',paid:'مصروف',zero_net:'لا يوجد صافي قابل للصرف',review:'يحتاج مراجعة'};
 return <View style={{gap:Spacing.three,padding:Spacing.four,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.surface}}>
 <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>مبيعات المتجر ومستحقاته — النظام الجديد</Text>
 <Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>المبالغ من تسليم C4 المعتمد. الاشتراكات منفصلة، وإعداد التسوية لا يعني صرفها.</Text>
 {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}<AppButton design="refined" title="تحديث المستحقات" variant="outline" disabled={operation.busy} onPress={refresh}/>
 {data?<>
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{data.store_name}</Text>
 <FinancialAmount label="إجمالي المبيعات المسلّمة" amount={data.position.gross}/><FinancialAmount label="عمولة المنصة المكتسبة" amount={data.position.commission}/><FinancialAmount label="صافي المستحق المكتسب" amount={data.position.net}/><FinancialAmount label="قيد التسوية" amount={data.position.pending}/><FinancialAmount label="المصروف" amount={data.position.paid}/><FinancialAmount label="المتاح لإعداد تسوية" amount={data.position.available}/>
 {admin&&data.treasury_balance!==null?<FinancialAmount label="رصيد خزينة C2 المرحل" amount={data.treasury_balance}/>:null}
 {data.position.review_required?<FinancialStatus tone="error" label="يوجد تعارض مالي؛ إعداد التسويات وصرفها متوقفان للمراجعة"/>:null}
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>الطلبات الفرعية المسلّمة</Text>
 {!data.subs.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد مبيعات C4 مسلّمة في هذه الصفحة.</Text>:null}
 {data.subs.map(s=><View key={s.store_order_id} style={{gap:Spacing.two,paddingVertical:Spacing.three,borderTopWidth:1,borderColor:colors.border}}><DocumentReference value={s.order_reference}/><DocumentReference value={s.sub_reference}/><FinancialStatus label={labels[s.status]} tone={s.status==='review'?'error':s.status==='pending'?'warning':s.status==='paid'?'success':'info'}/><FinancialAmount label="قيمة البضائع المسلّمة" amount={s.gross}/><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>النسبة المثبتة: {displayFinancialRate(s.commission_rate)}٪</Text><FinancialAmount label="العمولة" amount={s.commission}/><FinancialAmount label="الصافي" amount={s.net}/>
 {admin?<AppButton design="refined" title={selected.some(r=>r.store_order_id===s.store_order_id)?'إزالة من الاختيار':'إضافة إلى التسوية'} variant="outline" disabled={Boolean(disabled)||!data.can_prepare||s.status!=='available'||(selected.length>=100&&!selected.some(r=>r.store_order_id===s.store_order_id))} onPress={()=>toggle(s)}/>:null}</View>)}
 {admin&&selected.length?<><Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{selectionError}</Text>{selectedTotal?<FinancialAmount label={`مجموع ${selected.length} مستحقات مختارة`} amount={selectedTotal}/>:null}<AppButton design="refined" title="إعداد تسوية دون صرف نقدي" disabled={Boolean(disabled)||!data.can_prepare||Boolean(selectionError)} onPress={()=>void operation.run({kind:'prepare',storeId:data.store_id,subs:selected.map(s=>s.store_order_id),amount:selectedTotal}).then(r=>{if(r?.state==='completed')setSelection({scope,rows:[]});})}/><AppButton design="refined" title="مسح الاختيار" variant="outline" disabled={operation.busy} onPress={()=>setSelection({scope,rows:[]})}/></>:null}
 <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>التسويات ومراجع الصرف</Text>
 {!data.settlements.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد تسويات في هذه الصفحة.</Text>:null}
 {data.settlements.map(s=><View key={s.id} style={{gap:Spacing.two,paddingVertical:Spacing.three,borderTopWidth:1,borderColor:colors.border}}><DocumentReference value={s.reference}/><FinancialStatus label={s.status==='paid'?'مصروفة':'معدة — بانتظار الصرف'} tone={s.status==='paid'?'success':'warning'}/><FinancialAmount amount={s.amount}/>{s.items.map(i=><View key={i.sub_reference}><DocumentReference value={i.sub_reference}/><FinancialAmount amount={i.amount}/></View>)}{s.pay_reference?<DocumentReference value={s.pay_reference}/>:null}<Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{new Date(s.paid_at??s.prepared_at).toLocaleString('ar-SY')}</Text>{admin?<AppButton design="refined" title="تأكيد صرف التسوية كاملة" disabled={Boolean(disabled)||!data.can_pay||s.status==='paid'} onPress={()=>setConfirm({scope,row:s})}/>:null}</View>)}
 {admin&&(!data.can_prepare||!data.can_pay)?<Text style={{...Typography.body,color:colors.warningForeground,textAlign:'right'}}>الإعداد والصرف يحتاجان التفعيل وتفويضين مستقلين.</Text>:null}
 <AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading||operation.busy} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data.has_more||loading||operation.busy} onPress={()=>setPage(p=>p+1)}/>
 </>:null}
 {admin?<FinancialOperationControls busy={operation.busy} error={operation.error} frozen={Boolean(operation.frozen)} result={operation.result} message={operation.result?resultMessage(operation.result):''} onRecover={()=>void operation.run(undefined,true)} onResume={()=>void operation.run()} onFinish={()=>void operation.finish()}/>:null}
 <AppModal design="refined" visible={Boolean(active)} title="تأكيد صرف مستحقات المتجر" message="أكد فقط بعد تسليم المبلغ كاملًا للتاجر. سيسجل قيد صرف من خزينة المكتب ومرجع PAY." confirmText="تأكيد الصرف الفعلي كاملًا" cancelText="إلغاء" busy={operation.busy} onCancel={()=>{if(!operation.busy)setConfirm(null);}} onConfirm={()=>{if(active&&data)void operation.run({kind:'pay',storeId:data.store_id,settlementId:active.id,amount:active.amount}).then(r=>{if(r)setConfirm(null);});}}>{active?<><DocumentReference value={active.reference}/><FinancialAmount amount={active.amount}/></>:null}{operation.error?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{operation.error}</Text>:null}</AppModal>
 </View>;
}

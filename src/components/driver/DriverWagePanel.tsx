import {useCallback,useMemo,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {DocumentReference} from '@/components/ui/DocumentReference';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {AppButton} from '@/components/ui/AppButton';
import {AppModal} from '@/components/ui/AppModal';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {useWageOperation} from '@/hooks/useWageOperation';
import {WageOperationControls} from '@/components/driver/WageOperationControls';
import {getC6Wages,displayWageRate,type WageTask} from '@/lib/driver-wages-c6';
export function DriverWagePanel({driverId,admin=false}:{driverId:string;admin?:boolean}){
 const {user}=useAuth(),{colors}=useTheme(),actor=user?.id??'';
 const [page,setPage]=useState(0),[selected,setSelected]=useState<{scope:string;task:WageTask}|null>(null);const scope=`${actor}:${driverId}`;
 const read=useCallback(()=>getC6Wages(driverId,actor,page),[driverId,actor,page]);
 const {data,loading,error,refresh}=useCustodyRead(`c6-wages:${scope}:${page}`,read);
 const operation=useWageOperation(actor,`pay:${driverId}`,refresh),active=selected?.scope===scope?selected.task:null;
 const subscriptions=useMemo(()=>[{table:'delivery_collection_results' as const,filter:`driver_id=eq.${driverId}`},{table:'driver_wage_entitlements' as const,filter:`driver_id=eq.${driverId}`},{table:'driver_cash_receipt_allocations' as const,filter:`driver_id=eq.${driverId}`},{table:'driver_wage_payments' as const,filter:`driver_id=eq.${driverId}`}],[driverId]);
 useOrderRealtime({channelName:`c6-wages:${scope}`,enabled:Boolean(actor),subscriptions,onChange:refresh});
 const labels={zero_wage:'أجرة صفرية — دون قيد مالي',paid:'مصروفة',available:'متاحة للصرف',blocked:'محجوزة بسبب عهدة المهمة',review:'تحتاج مراجعة مالية'};
 return <View style={{padding:Spacing.four,gap:Spacing.three,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.surface}}>
  <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>{admin?'أجور السائق':'أجوري'}</Text>
  <Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>الأجرة مستقلة عن النقد المقبوض. لا تُخصم من العهدة، وإتاحتها تعتمد على إغلاق عهدة مهمتها بإيصالات مؤكدة.</Text>
  {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
  <AppButton design="refined" title="تحديث الأجور" variant="outline" disabled={loading||operation.busy} onPress={refresh}/>
  {data?<>
   <FinancialAmount label="أجوري المستحقة — إجمالي المكتسب" amount={data.position.earned}/>
   <FinancialAmount label="أجوري المحجوزة أو قيد المراجعة" amount={data.position.blocked}/>
   <FinancialAmount label="أجوري المتاحة للصرف" amount={data.position.available}/>
   <FinancialAmount label="أجوري المصروفة" amount={data.position.paid}/>
   <FinancialAmount label="المستحق المتبقي في الدفتر" amount={data.position.outstanding}/>
   {admin&&data.treasury_balance!==null?<FinancialAmount label="رصيد الخزينة المرحّل" amount={data.treasury_balance}/>:null}
   {data.position.review_required?<FinancialStatus label="توجد حركات أو لقطات تحتاج مراجعة؛ الصرف متوقف" tone="error"/>:null}
   {data.uncovered_count>0?<><FinancialStatus label={`${data.uncovered_count} مهمة دون نسبة أجرة مثبتة؛ لم يُفترض لها أجر بأثر رجعي`} tone="warning"/>{data.uncovered.map(t=><DocumentReference key={t.task_id} value={t.reference}/>)}</>:null}
   <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>سجل المهام والأجور</Text>
   {!data.tasks.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد استحقاقات في هذه الصفحة.</Text>:null}
   {data.tasks.map(t=><View key={t.task_id} style={{gap:Spacing.two,paddingVertical:Spacing.three,borderBottomWidth:1,borderColor:colors.border}}>
    <DocumentReference value={t.reference}/><FinancialStatus label={labels[t.status]} tone={t.status==='review'?'error':t.status==='blocked'?'warning':t.status==='available'||t.status==='paid'?'success':'info'}/>
    <FinancialAmount label="رسوم التوصيل النهائية المثبتة" amount={t.fee_amount}/><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>نسبة الأجرة المثبتة: {displayWageRate(t.percentage)}٪</Text><FinancialAmount label="الأجرة" amount={t.amount}/>
    <FinancialAmount label="النقد المقبوض من هذه المهمة" amount={t.cash_total}/><FinancialAmount label="عهدة المهمة المتبقية" amount={t.cash_remaining}/>
    {t.allocations.map((a,i)=><View key={`${a.reference}:${i}`} style={{gap:Spacing.one}}><DocumentReference value={a.reference}/><FinancialAmount label="المخصص لهذه المهمة من الإيصال" amount={a.amount}/></View>)}
    <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{new Date(t.accrued_at).toLocaleString('ar-SY')}</Text>
    {admin?<AppButton design="refined" title="صرف هذه الأجرة كاملة" disabled={loading||Boolean(error)||operation.busy||Boolean(operation.frozen)||!data.can_pay||data.position.review_required||t.status!=='available'} onPress={()=>setSelected({scope,task:t})}/>:null}
   </View>)}
   <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>سجل المدفوعات</Text>
   {!data.payments.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد أجور مصروفة في هذه الصفحة.</Text>:null}
   {data.payments.map(p=><View key={p.id} style={{gap:Spacing.one}}><DocumentReference value={p.reference}/><FinancialAmount amount={p.amount}/><Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{new Date(p.paid_at).toLocaleString('ar-SY')} · الموظف {p.paid_by.slice(0,8)}</Text></View>)}
   {admin&&!data.can_pay?<Text style={{...Typography.body,color:colors.warningForeground,textAlign:'right'}}>الصرف يحتاج تفعيله وتفويض صرف مستقلًا للموظف.</Text>:null}
   <AppButton design="refined" title="السابق" variant="outline" disabled={page===0||loading||operation.busy} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data.has_more||loading||operation.busy} onPress={()=>setPage(p=>p+1)}/>
  </>:null}
  {admin?<WageOperationControls operation={operation}/>:null}
  <AppModal design="refined" visible={Boolean(active)} title="تأكيد صرف الأجرة فعليًا" message="أكد فقط بعد تسليم المبلغ كاملًا للسائق. الصرف من الخزينة ولا يخصم من عهدته." confirmText="تأكيد صرف المبلغ كاملًا" cancelText="إلغاء" busy={operation.busy} onCancel={()=>{if(!operation.busy)setSelected(null);}} onConfirm={()=>{if(active)void operation.run({kind:'pay',driverId,tasks:[active.task_id],amount:active.amount}).then(r=>{if(r)setSelected(null);});}}>
   {active?<><DocumentReference value={active.reference}/><FinancialAmount label="المبلغ المطلوب صرفه" amount={active.amount}/></>:null}
   {operation.error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{operation.error}</Text>:null}
  </AppModal>
 </View>;
}

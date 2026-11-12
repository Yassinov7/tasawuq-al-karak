import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Spacing,Typography} from '@/constants/theme';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {AppButton} from '@/components/ui/AppButton';
import {AppTextField} from '@/components/ui/AppTextField';
import {AppModal} from '@/components/ui/AppModal';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {getC5Custody,restoreC5Input,finishC5Handover,runC5Handover,type HandoverInput,type HandoverRequest,type HandoverResult} from '@/lib/driver-custody-c5';

export function DriverCustodyPanel({driverId,admin=false}:{driverId:string;admin?:boolean}){
  const {user}=useAuth(),{colors}=useTheme();const actor=user?.id??'';
  const [page,setPage]=useState(0);const scope=`${actor}:${driverId}`;
  const current=useRef(''),lock=useRef(false);
  useLayoutEffect(()=>{current.current=scope;return()=>{current.current='';};},[scope]);
  const [form,setForm]=useState<{scope:string;amount:string;selected?:HandoverRequest;frozen?:HandoverInput;message:string}>({scope:'',amount:'',message:''});
  const active=form.scope===scope?form:{scope,amount:'',message:''};
  const [busy,setBusy]=useState(false);
  const read=useCallback(()=>getC5Custody(driverId,actor,page),[actor,driverId,page]);
  const {data,loading,error,refresh}=useCustodyRead(`${scope}:${page}`,read);
  useFocusEffect(useCallback(()=>{let live=true;if(actor)void restoreC5Input(actor,driverId).then(frozen=>{if(live&&current.current===scope)setForm(previous=>({... (previous.scope===scope?previous:{amount:'',message:''}),scope,frozen,selected:frozen?undefined:(previous.scope===scope?previous.selected:undefined),amount:frozen?.amount??(previous.scope===scope?previous.amount:'')}));}).catch(()=>{if(live&&current.current===scope)setForm({scope,amount:'',message:'تعذر قراءة المحاولة المحفوظة؛ تحقق قبل أي إرسال.'});});return()=>{live=false;};},[actor,driverId,scope]));
  const subscriptions=useMemo(()=>[
    {table:'driver_cash_handover_requests' as const,filter:`driver_id=eq.${driverId}`},
    {table:'driver_cash_handover_attempts' as const,filter:`driver_id=eq.${driverId}`},
    {table:'delivery_collection_results' as const,filter:`driver_id=eq.${driverId}`},
  ],[driverId]);
  useOrderRealtime({channelName:`c5-custody:${scope}`,enabled:Boolean(actor),subscriptions,onChange:refresh});
  const submit=async(input?:HandoverInput,readOnly=false)=>{
    if(!actor||lock.current||current.current!==scope)return;lock.current=true;setBusy(true);
    try{
      const result=await runC5Handover(actor,driverId,input,readOnly);
      if(current.current!==scope)return;
      const frozen=await restoreC5Input(actor,driverId);
      if(current.current!==scope)return;
      const message=resultMessage(result);
      setForm({scope,amount:frozen?.amount??'',frozen,message});refresh();
    }catch(cause){if(current.current===scope){let frozen:HandoverInput|undefined;try{frozen=await restoreC5Input(actor,driverId);}catch{/* No write is allowed when persistence cannot be verified. */}if(current.current===scope)setForm(previous=>({... (previous.scope===scope?previous:{amount:'',message:''}),scope,frozen:frozen??(previous.scope===scope?previous.frozen:undefined),message:cause instanceof Error?cause.message:'تعذر حسم العملية. تحقق من المحاولة المحفوظة.'}));}}
    finally{lock.current=false;setBusy(false);}
  };
  const startIndependent=async()=>{
    if(!actor||lock.current||current.current!==scope)return;lock.current=true;setBusy(true);
    try{await finishC5Handover(actor,driverId);if(current.current===scope)setForm({scope,amount:'',message:'يمكنك الآن بدء عملية مستقلة.'});}
    catch(cause){if(current.current===scope)setForm(previous=>({...previous,message:cause instanceof Error?cause.message:'تعذر التحقق من المحاولة.'}));}
    finally{lock.current=false;setBusy(false);}
  };
  const label={cash_delivery:'قبض نقد من توصيل',zero_cash_delivery:'تسليم دون قبض نقدي',confirmed:'استلام المكتب مؤكد',discrepancy:'اختلاف في العدّ — يحتاج مراجعة'};
  return <View style={{gap:Spacing.three,padding:Spacing.four,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.surface}}>
    <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>{admin?'عهدة السائق الحالية':'عهدتي الحالية'}</Text>
    <Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>كامل النقد المقبوض؛ دون خصم أجر السائق أو عمولة التاجر. السجل القديم معروض منفصلًا.</Text>
    {loading?<ActivityIndicator color={colors.primary}/>:null}
    {error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
    <AppButton design="refined" title="تحديث العهدة" variant="outline" onPress={refresh} disabled={busy||loading}/>
    {data?<>
      <FinancialAmount label="إجمالي النقد المقبوض" amount={data.position.collected}/>
      <FinancialAmount label="ما استلمه المكتب وأُكد" amount={data.position.confirmed}/>
      <FinancialAmount label="العهدة المتبقية" amount={data.position.remaining}/>
      <FinancialAmount label="محجوز للطلبات المعلقة" amount={data.position.reserved}/>
      <FinancialAmount label="المتاح لطلب جديد" amount={data.position.available}/>
      {data.position.ledger_requires_review?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>تحتاج حركات العهدة إلى مراجعة؛ الطلب والتأكيد المالي متوقفان.</Text>:null}
      {!admin?<>
        <AppTextField design="refined" label="مبلغ طلب تسليم نقد (ل.س)" keyboardType="decimal-pad" value={active.amount} disabled={busy||Boolean(active.frozen)||!data.can_request||loading||Boolean(error)} onChangeText={amount=>setForm({...active,amount,message:''})}/>
        <AppButton design="refined" title="طلب تسليم نقد" disabled={busy||Boolean(active.frozen)||!data.can_request||loading||Boolean(error)} onPress={()=>void submit({kind:'request',driverId,amount:active.amount})}/>
        {!data.can_request?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>استقبال طلبات تسليم النقد غير متاح حاليًا لهذا الحساب.</Text>:null}
      </>:!data.can_confirm?<Text style={{...Typography.body,color:colors.warningForeground,textAlign:'right'}}>العرض متاح؛ تأكيد الاستلام يحتاج تفويض استلام نقدي للإدارة.</Text>:null}
      <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>طلبات بانتظار تأكيد المكتب ({data.position.pending_count})</Text>
      {!data.requests.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد طلبات معلقة في هذه الصفحة.</Text>:null}
      {data.requests.map(r=><View key={r.id} style={{gap:Spacing.two,paddingVertical:Spacing.two}}>
        <FinancialAmount label={r.needs_review?'اختلاف يحتاج مراجعة':'طلب تسليم'} amount={r.amount}/>
        {r.last_counted!==null?<FinancialAmount label="آخر مبلغ معدود للمراجعة" amount={r.last_counted}/>:null}
        <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{new Date(r.requested_at).toLocaleString('ar-SY')} · {r.id.slice(0,8)}</Text>
        {admin?<AppButton design="refined" title="تأكيد الاستلام" variant="outline" disabled={busy||Boolean(active.frozen)||!data.can_confirm||data.position.ledger_requires_review||loading||Boolean(error)} onPress={()=>setForm({scope,amount:'',selected:r,message:''})}/>:null}
      </View>)}
      <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>عمليات التسليم السابقة والحركات</Text>
      {!data.history.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد حركات في هذه الصفحة.</Text>:null}
      {data.history.map(h=><View key={h.id} style={{gap:Spacing.one}}><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{label[h.kind as keyof typeof label]} · {h.reference??'دون إيصال مؤكد'}</Text><FinancialAmount amount={h.amount}/><Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{new Date(h.at).toLocaleString('ar-SY')}</Text></View>)}
      <View style={{gap:Spacing.two}}><AppButton design="refined" title="الصفحة السابقة" variant="outline" disabled={page===0||busy||loading} onPress={()=>setPage(p=>Math.max(0,p-1))}/><AppButton design="refined" title="المزيد من السجلات" variant="outline" disabled={!data.has_more||busy||loading} onPress={()=>setPage(p=>p+1)}/></View>
    </>:null}
    {active.frozen?<Text style={{...Typography.body,color:colors.warningForeground,textAlign:'right'}}>هناك محاولة محفوظة: {active.frozen.kind==='request'?'طلب تسليم':'تأكيد استلام'}. تحقق من نتيجتها قبل عملية مستقلة.</Text>:null}
    <AppButton design="refined" title="التحقق من المحاولة المحفوظة" variant="outline" disabled={busy} onPress={()=>void submit(undefined,true)}/>
    {active.frozen?<AppButton design="refined" title="متابعة المحاولة المحفوظة بالمفتاح نفسه" variant="outline" disabled={busy} onPress={()=>void submit()}/>:null}
    {active.frozen?<AppButton design="refined" title="بدء عملية مستقلة بعد التحقق" variant="outline" disabled={busy} onPress={()=>void startIndependent()}/>:null}
    {active.message?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.text,textAlign:'right'}}>{active.message}</Text>:null}
    <AppModal design="refined" visible={Boolean(active.selected)} title="تأكيد استلام النقد فعليًا" message="أدخل ما عُدّ فعليًا. اختلافه عن الطلب يسجل للمراجعة دون نقل النقد إلى الخزينة." confirmText="تأكيد المبلغ المعدود" cancelText="إلغاء" busy={busy} onCancel={()=>{if(!busy)setForm({...active,selected:undefined});}} onConfirm={()=>{if(active.selected)void submit({kind:'confirm',driverId,requestId:active.selected.id,amount:active.amount});}}>
      {active.selected?<FinancialAmount label="المبلغ المطلوب" amount={active.selected.amount}/>:null}
      <AppTextField design="refined" label="المبلغ المعدود فعليًا (ل.س)" value={active.amount} keyboardType="decimal-pad" disabled={busy} onChangeText={amount=>setForm({...active,amount,message:''})}/>
      {active.message?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{active.message}</Text>:null}
    </AppModal>
  </View>;
}
function resultMessage(r:HandoverResult){
  if(r.state==='unknown')return 'النتيجة غير محسومة؛ تحقق أو أعد المحاولة بالمفتاح المحفوظ نفسه.';
  if(r.state==='rejected')return ({intake_disabled:'استقبال الطلبات الجديدة مغلق.',ledger_requires_review:'تحتاج حركات العهدة إلى مراجعة.',insufficient_available:'المبلغ يتجاوز العهدة المتاحة بعد الحجز.',already_confirmed_different_count:'هذا الطلب مؤكد بمبلغ آخر؛ لم نغير الإيصال.'}[r.code]??'رفض الخادم المحاولة؛ حدّث البيانات.');
  if(r.kind==='request')return `سُجل طلب التسليم ${r.requestId.slice(0,8)}؛ لم ينتقل نقد إلى الخزينة.`;
  if(r.kind==='discrepancy')return 'سُجل اختلاف العدّ للمراجعة؛ الطلب ما زال محجوزًا ولم يترحل نقد.';
  return `تأكد الاستلام بالإيصال ${r.reference}.`;
}

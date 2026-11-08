import {useCallback,useMemo,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useRouter} from 'expo-router';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AppButton} from '@/components/ui/AppButton';
import {AppTextField} from '@/components/ui/AppTextField';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {WageOperationControls} from '@/components/driver/WageOperationControls';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useWageOperation} from '@/hooks/useWageOperation';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {getC6Policy,getC6Overview,displayWageRate,type WagePolicy} from '@/lib/driver-wages-c6';
export function DriverWageAdministration(){
 const {user}=useAuth(),{colors}=useTheme(),router=useRouter(),actor=user?.id??'';
 const [policyPage,setPolicyPage]=useState(0),[page,setPage]=useState(0);
 const [draft,setDraft]=useState<{actor:string;base:WagePolicy;rate:string;reason:string}|null>(null);
 const read=useCallback(()=>getC6Policy(actor,policyPage),[actor,policyPage]);
 const policy=useCustodyRead(`c6-policy:${actor}:${policyPage}`,read);
 const readOverview=useCallback(()=>getC6Overview(actor,page),[actor,page]);
 const overview=useCustodyRead(`c6-overview:${actor}:${page}`,readOverview);
 const refreshPolicy=policy.refresh,refreshOverview=overview.refresh;
 const refresh=useCallback(()=>{refreshPolicy();refreshOverview();},[refreshPolicy,refreshOverview]);
 const operation=useWageOperation(actor,'policy',refresh);
 const currentDraft=draft?.actor===actor?draft:null;
 const change=(field:'rate'|'reason',value:string)=>{if(policy.data)setDraft(previous=>({... (previous?.actor===actor?previous:{actor,base:policy.data!.current,rate:policy.data!.current.percentage,reason:''}),[field]:value}));};
 const subscriptions=useMemo(()=>[{table:'delivery_collection_results' as const},{table:'driver_wage_policies' as const},{table:'driver_wage_entitlements' as const},{table:'driver_wage_payments' as const},{table:'driver_cash_receipt_allocations' as const}],[]);
 useOrderRealtime({channelName:`c6-admin:${actor}`,enabled:Boolean(actor),subscriptions,onChange:refresh});
 const disabled=operation.busy||Boolean(operation.frozen)||policy.loading||Boolean(policy.error)||!policy.data?.can_edit;
 return <View style={{gap:Spacing.three,padding:Spacing.four,borderWidth:1,borderRadius:16,borderColor:colors.border,backgroundColor:colors.surface}}>
  <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>سياسة أجور السائقين</Text>
  <Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>تُثبت النسبة عند إنشاء مهمة جديدة مؤهلة. تُحسب الأجرة من رسوم التوصيل النهائية فقط، وتُقرب إلى منزلتين عند الاستحقاق.</Text>
  {policy.loading?<ActivityIndicator color={colors.primary}/>:null}{policy.error?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{policy.error}</Text>:null}
  <AppButton design="refined" title="تحديث السياسة والأجور" variant="outline" disabled={operation.busy} onPress={refresh}/>
  {policy.data?<>
   <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>النسبة الحالية: {displayWageRate(policy.data.current.percentage)}٪</Text>
   <AppTextField design="refined" label="نسبة الأجرة (%)" keyboardType="decimal-pad" value={currentDraft?.rate??policy.data.current.percentage} onChangeText={v=>change('rate',v)} disabled={disabled} helperText="من 0 إلى 100، حتى أربع منازل عشرية؛ يسري التعديل على المهام الجديدة فقط."/>
   <AppTextField design="refined" label="سبب تعديل السياسة" value={currentDraft?.reason??''} onChangeText={v=>change('reason',v)} disabled={disabled} multiline/>
   {currentDraft&&currentDraft.base.id!==policy.data.current.id?<FinancialStatus label="تغيرت السياسة أثناء التحرير؛ أعد ضبط المسودة قبل عملية مستقلة" tone="warning"/>:null}
   <AppButton design="refined" title="حفظ النسبة للمهام الجديدة" disabled={disabled||!currentDraft} onPress={()=>{if(currentDraft)void operation.run({kind:'policy',policyId:currentDraft.base.id,percentage:currentDraft.rate,reason:currentDraft.reason}).then(r=>{if(r?.state==='completed')setDraft(null);});}}/>
   {currentDraft?<AppButton design="refined" title="تجاهل مسودة النسبة" variant="outline" disabled={operation.busy||Boolean(operation.frozen)} onPress={()=>setDraft(null)}/>:null}
   {!policy.data.can_edit?<Text style={{...Typography.body,color:colors.warningForeground,textAlign:'right'}}>تعديل السياسة يحتاج تفويضًا إداريًا مستقلًا.</Text>:null}
   <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>تاريخ تغييرات النسبة</Text>
   {policy.data.history.map(p=><View key={p.id} style={{gap:Spacing.one}}><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{displayWageRate(p.percentage)}٪ · {new Date(p.effective_at).toLocaleString('ar-SY')}</Text><Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{p.reason}</Text></View>)}
   <AppButton design="refined" title="السياسات السابقة" variant="outline" disabled={!policy.data.has_more||operation.busy||policy.loading} onPress={()=>setPolicyPage(p=>p+1)}/><AppButton design="refined" title="السياسات الأحدث" variant="outline" disabled={!policyPage||operation.busy||policy.loading} onPress={()=>setPolicyPage(p=>p-1)}/>
  </>:null}
  <WageOperationControls operation={operation}/>
  <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>أجور السائقين والمراجعة المالية</Text>
  {overview.loading?<ActivityIndicator color={colors.primary}/>:null}{overview.error?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{overview.error}</Text>:null}
  {overview.data?.rows.map(r=><View key={r.driver_id} style={{gap:Spacing.two,borderTopWidth:1,borderColor:colors.border,paddingTop:Spacing.three}}>
   <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{r.full_name}</Text>
   <FinancialAmount label="المكتسب" amount={r.position.earned}/><FinancialAmount label="المحجوز أو قيد المراجعة" amount={r.position.blocked}/><FinancialAmount label="المتاح" amount={r.position.available}/><FinancialAmount label="المصروف" amount={r.position.paid}/>
   {r.position.review_required?<FinancialStatus label="يحتاج مراجعة قبل الصرف" tone="error"/>:null}
   <AppButton design="refined" title="تفاصيل الأجور والعهدة والصرف" variant="outline" onPress={()=>router.push({pathname:'/admin/driver-custody-details',params:{driverId:r.driver_id}})}/>
  </View>)}
  {overview.data&&!overview.data.rows.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد مهام أو أجور جديدة مسجلة في هذه الصفحة.</Text>:null}
  <AppButton design="refined" title="السائقون السابقون" variant="outline" disabled={!page||overview.loading} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="السائقون التاليون" variant="outline" disabled={!overview.data?.has_more||overview.loading} onPress={()=>setPage(p=>p+1)}/>
 </View>;
}

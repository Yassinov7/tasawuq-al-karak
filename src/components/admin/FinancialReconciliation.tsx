import {useCallback,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AccountShell} from '@/components/account/AccountShell';
import {AppButton} from '@/components/ui/AppButton';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {getReconciliation,reconciliationScopes,type ReconciliationScope} from '@/lib/financial-reconciliation';
const scopes:Record<ReconciliationScope,string>={all:'الكل',ledger:'الدفتر',orders:'الطلبات',references:'المراجع',wages:'الأجور',custody:'العهدة',merchants:'التجار',subscriptions:'الاشتراكات',treasury:'الخزينة'};
const issues:Record<string,string>={journal_reference_mismatch:'مرجع القيد لا يطابق الحدث',lifecycle_parent_mismatch:'مرجع الحدث التشغيلي لا يطابق الطلب الأب',pickup_reference_mismatch:'مرجع الاستلام لا يطابق المتجر أو المهمة',task_without_active_stores:'مهمة دون متاجر نشطة',task_progressed_during_review:'تقدمت المهمة أثناء مراجعة التسعير',account_mismatch:'اختلاف بين المستندات والرصيد الدفتري',journal_invalid:'قيد غير متوازن أو دقة غير صالحة',event_not_posted:'حدث مالي بلا ترحيل مكتمل',pending_operation:'عملية معلقة تحتاج مراجعة',missing_reference:'مرجع مالي مفقود',collection_context_mismatch:'سياق التحصيل لا يطابق المهمة أو السعر',premature_delivery_task:'مهمة قبل جاهزية المتاجر',delivery_before_pickups:'تقدم المهمة دون اكتمال الاستلام',zero_delivery_has_cash:'تسليم صفري له أثر مالي',legacy_double_writer:'وجود أثر legacy لطلب الكاتب الجديد',wage_snapshot_not_enrolled:'مهمة غير مشمولة بلقطة أجور C6',wage_accrual_missing:'لقطة أجور بلا استحقاق',wage_snapshot_mismatch:'الأجرة لا تطابق اللقطة',wage_paid_before_custody:'أجرة صُرفت قبل اكتمال تسليم عهدة المهمة',receipt_allocation_mismatch:'الإيصال لا يطابق تخصيصاته',task_overallocated:'تخصيص زائد لعهدة المهمة',delivered_sub_missing:'طلب فرعي مسلّم بلا تفصيل استحقاق',commission_snapshot_mismatch:'اختلاف لقطة العمولة أو بضائع المتجر',receipt_period_mismatch:'قبض الاشتراك لا يطابق الفترة المدفوعة',posting_stage_mismatch:'مرحلة سند الخزينة لا تطابق الترحيل',stale_pending_correction:'طلب تصحيح جرد فقد صلاحية نقطة القطع'};
export function FinancialReconciliation(){const {user}=useAuth();return user?<OwnedReconciliation key={user.id} actor={user.id}/>:null;}
function OwnedReconciliation({actor}:{actor:string}){
 const {colors}=useTheme(),router=useRouter(),[filter,setFilter]=useState<ReconciliationScope>('all'),[page,setPage]=useState(0);
 const read=useCallback(()=>getReconciliation(actor,filter,page),[actor,filter,page]);const {data,error,loading,refresh}=useCustodyRead(`reconciliation:${actor}:${filter}:${page}`,read);
 useFocusEffect(useCallback(()=>{const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[refresh]));
 const text=(s:string)=><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{s}</Text>;
 return <AccountShell header={null}><View style={{gap:Spacing.three}}>{text('مطابقة العمليات مع دفتر C2 — قراءة فقط')}
 {text('لا يُرحّل هذا التقرير تصحيحًا ولا يغير الأرصدة. النتيجة تخص فحوص التقرير ولقطة القراءة، ولا تثبت نجاح اختبارات التشغيل.')}
 <AppButton design="refined" title="العودة إلى المالية" variant="outline" onPress={()=>router.push('/admin/finance')}/><AppButton design="refined" title="تحديث المطابقة" variant="outline" onPress={refresh}/>
 <View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:8}}>{reconciliationScopes.map(s=><AppButton key={s} design="refined" title={scopes[s]} variant={filter===s?'primary':'outline'} onPress={()=>{setFilter(s);setPage(0);}}/>)}</View>
 {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
 {data?<>{text(`نتائج جميع النطاقات: ${data.errors} اختلاف · ${data.warnings} تنبيه`)}{text(`وقت اللقطة: ${new Date(data.at).toLocaleString('ar-SY')}`)}
 {data.rows.map((r,i)=><View key={`${r.scope}:${r.code}:${r.entityId}:${i}`} style={{padding:16,gap:8,borderRadius:16,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface}}>
 <FinancialStatus label={r.severity==='error'?'اختلاف يحتاج مراجعة':'تنبيه يحتاج تفسيرًا'} tone={r.severity==='error'?'error':'warning'}/>{text(issues[r.code]??r.code)}{text(`النطاق: ${scopes[r.scope]}`)}
 {r.entityId?text(`السجل: ${r.entityId}`):null}{typeof r.details.account==='string'?text(`الحساب: ${r.details.account}`):null}
 {r.expected!==null?<FinancialAmount amount={r.expected} label={r.code==='account_mismatch'?'الرصيد المتوقع — مدين ناقص دائن':'القيمة المتوقعة من المصدر'}/>:null}{r.actual!==null?<FinancialAmount amount={r.actual} label={r.code==='account_mismatch'?'الرصيد المثبت — مدين ناقص دائن':'القيمة المثبتة'}/>:null}
 </View>)}{!data.rows.length?text('لا توجد نتائج في هذه الصفحة والنطاق ضمن فحوص التقرير الحالية.'):null}
 <AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data.hasMore||loading} onPress={()=>setPage(p=>p+1)}/></>:null}
 </View></AccountShell>;
}

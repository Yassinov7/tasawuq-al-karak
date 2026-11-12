import {useCallback,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {AccountShell} from '@/components/account/AccountShell';
import {AppButton} from '@/components/ui/AppButton';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography} from '@/constants/theme';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {readFinanceTransition,type TransitionPath} from '@/lib/finance-transition';
const paths:Record<TransitionPath,string>={new_orders:'طلبات جديدة',delivery:'تسليم C4',custody:'عهد C5',wages:'أجور C6',settlements:'تسويات C7',subscriptions:'اشتراكات C8',treasury:'خزينة C9',reconciliation:'مطابقة C10'};
const kinds:Record<string,string>={driver_custody:'عهدة قديمة بصيغتها التاريخية',driver_credit:'رصيد سائق قديم',merchant_payable:'مستحق تاجر قديم',subscription_debt:'فاتورة اشتراك قديمة',subscription_credit:'دفعة اشتراك قديمة غير مخصصة',legacy_wage_embedded:'أجر قديم محسوب ضمن معادلة العهدة — ليس مستحق C6'};
export function FinanceTransitionReview(){const{user}=useAuth();return user?<OwnedReview key={user.id} actor={user.id}/>:null;}
function OwnedReview({actor}:{actor:string}){
 const{colors}=useTheme(),[page,setPage]=useState(0);const reader=useCallback(()=>readFinanceTransition(actor,page),[actor,page]);const{data,error,loading,refresh}=useCustodyRead(`c11:${actor}:${page}`,reader);
 const text=(s:string)=><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{s}</Text>;
 return <AccountShell header={null}><View style={{gap:12}}>{text('مراجعة الانتقال المالي — قراءة فقط')}{text('الأرصدة القديمة مستقلة. لا تُرحّل هذه الشاشة قيودًا ولا تفعّل بوابات. إيقاف القبول لا يغيّر كاتب العمليات القائمة.')}
 <AppButton title="تحديث التقرير" design="refined" variant="outline" onPress={refresh}/>{loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
 {data?<>{text(`وقت القراءة: ${new Date(data.at).toLocaleString('ar-SY')}`)}{data.gates.map(g=><View key={g.path} style={{padding:12,borderRadius:16,backgroundColor:colors.surface,borderColor:colors.borderStrong,borderWidth:1,gap:8}}>{text(`${paths[g.path]}: ${g.admit?'القبول مفتوح':'القبول مغلق'}`)}{text(g.ready?'الفحص البنيوي مستوفى؛ لا يثبت الاختبارات السلوكية':'متطلبات بنيوية أو تفويضات غير مستوفاة')}{g.problems.map(p=><View key={p}>{text(`رمز المراجعة: ${p}`)}</View>)}</View>)}
 {text('التزامات وسجلات قديمة تحتاج قرارًا مستقلًا؛ لا تجمع مبالغ هذه الأقسام.')}{data.rows.map(r=><View key={`${r.kind}:${r.entityId}`} style={{padding:12,gap:8,backgroundColor:colors.surface,borderRadius:16}}>{text(kinds[r.kind]??r.kind)}{text(`السجل: ${r.entityId}`)}<FinancialAmount amount={r.amount}/></View>)}{!data.rows.length?text('لا توجد سجلات قديمة في هذه الصفحة ضمن فحوص التقرير.'):null}
 <AppButton title="السابق" design="refined" variant="outline" disabled={!page||loading} onPress={()=>setPage(p=>p-1)}/><AppButton title="التالي" design="refined" variant="outline" disabled={!data.hasMore||loading} onPress={()=>setPage(p=>p+1)}/></>:null}</View></AccountShell>;
}

import {useCallback,useMemo,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useRouter,useFocusEffect} from 'expo-router';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AppButton} from '@/components/ui/AppButton';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {SubscriptionAccountPanel} from '@/components/merchant/SubscriptionAccountPanel';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {listSubscriptionAccounts} from '@/lib/subscription-accounts';
export function SubscriptionAdministration(){const {user}=useAuth();return user?<OwnedSubscriptions key={user.id} actor={user.id}/>:null;}
function OwnedSubscriptions({actor}:{actor:string}){
 const {colors}=useTheme(),router=useRouter(),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const read=useCallback(()=>listSubscriptionAccounts(actor,page),[actor,page]);const {data,loading,error,refresh}=useCustodyRead(`subscription-admin:${actor}:${page}`,read);
 useFocusEffect(useCallback(()=>{const timer=setInterval(refresh,60000);return()=>clearInterval(timer);},[refresh]));
 const subscriptions=useMemo(()=>[{table:'subscription_memberships' as const},{table:'subscription_account_events' as const},{table:'subscription_billing_documents' as const},{table:'subscription_cash_receipts' as const}],[]);
 useOrderRealtime({channelName:`subscription-admin:${actor}`,enabled:true,subscriptions,onChange:refresh});
 return <View style={{gap:Spacing.three}}><Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>إدارة الاشتراكات والفواتير — النظام الجديد</Text>
 <AppButton design="refined" title="إنشاء تعريف خطة أصلية / إدارة التعريفات" variant="outline" onPress={()=>router.push('/admin/plans')}/><AppButton design="refined" title="تحديث حسابات الاشتراك" variant="outline" onPress={refresh}/>
 {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
 {data?.rows.map(r=><View key={r.merchant_id} style={{gap:Spacing.two,padding:Spacing.three,borderWidth:1,borderColor:colors.border,borderRadius:16}}><Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{r.store_name}</Text><FinancialStatus label={r.managed?({active:'نشط',grace_period:'ضمن السماح',expired:'منتهٍ',suspended:'معلق',cancelled:'ملغى'}[r.state.state]):'غير منتقل إلى C8'} tone={r.managed&&r.state.state==='active'?'success':'info'}/><Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>التجديد: {{automatic:'تلقائي',manual:'يدوي',disabled:'متوقف'}[r.state.renewal_mode]} · نهاية الفترة الحالية: {r.state.paid_until?new Date(r.state.paid_until).toLocaleString('ar-SY'):'بعد تفعيل فترة مدفوعة'}</Text><AppButton design="refined" title="التفاصيل والخطط والفواتير والتحصيل" variant="outline" onPress={()=>setSelected(r.merchant_id)}/></View>)}
 {data&&!data.rows.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد حسابات في هذه الصفحة.</Text>:null}
 <AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data?.has_more||loading} onPress={()=>setPage(p=>p+1)}/>
 {selected?<><AppButton design="refined" title="إغلاق تفاصيل الحساب" variant="outline" onPress={()=>setSelected(null)}/><SubscriptionAccountPanel key={`${actor}:${selected}`} merchantId={selected} admin/></>:null}</View>;
}

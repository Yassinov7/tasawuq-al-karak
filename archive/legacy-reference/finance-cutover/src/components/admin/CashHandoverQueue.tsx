import {useCallback,useMemo,useState} from 'react';
import {type Href,useRouter} from 'expo-router';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AppButton} from '@/components/ui/AppButton';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {getC5Queue} from '@/lib/driver-custody-c5';
export function CashHandoverQueue(){
  const {user}=useAuth(),{colors}=useTheme(),router=useRouter();const actor=user?.id??'';
  const [filter,setFilter]=useState<'pending'|'review'>('pending'),[page,setPage]=useState(0);
  const read=useCallback(()=>getC5Queue(actor,filter,page),[actor,filter,page]);
  const {data,loading,error,refresh}=useCustodyRead(`c5-queue:${actor}:${filter}:${page}`,read);
  const subscriptions=useMemo(()=>[{table:'driver_cash_handover_requests' as const},{table:'driver_cash_handover_attempts' as const}],[]);
  useOrderRealtime({channelName:`c5-office:${actor}`,enabled:Boolean(actor),subscriptions,onChange:refresh});
  return <View style={{padding:Spacing.four,gap:Spacing.three,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.surface}}>
    <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>طلبات استلام النقد</Text>
    <AppButton design="refined" title="طلبات بانتظار المكتب" variant={filter==='pending'?'primary':'outline'} onPress={()=>{setFilter('pending');setPage(0);}}/>
    <AppButton design="refined" title="الاختلافات التي تحتاج مراجعة" variant={filter==='review'?'primary':'outline'} onPress={()=>{setFilter('review');setPage(0);}}/>
    {loading?<ActivityIndicator color={colors.primary}/>:null}
    {error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
    <AppButton design="refined" title="تحديث الطلبات" variant="outline" onPress={refresh} disabled={loading}/>
    {data?.rows.map(r=><View key={r.id} style={{gap:Spacing.two}}>
      <Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{r.full_name}{r.needs_review?' · اختلاف يحتاج مراجعة':''}</Text>
      <FinancialAmount label="المطلوب" amount={r.amount}/>{r.last_counted!==null?<FinancialAmount label="آخر مبلغ معدود" amount={r.last_counted}/>:null}
      <Text style={{...Typography.caption,color:colors.textSecondary,textAlign:'right'}}>{new Date(r.requested_at).toLocaleString('ar-SY')}</Text>
      <AppButton design="refined" title="عرض العهدة وطلبات الاستلام" variant="outline" onPress={()=>router.push(`/admin/driver-custody-details?driverId=${r.driver_id}` as Href)}/>
    </View>)}
    {data&&!data.rows.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد طلبات مطابقة في هذه الصفحة.</Text>:null}
    <AppButton design="refined" title="السابق" variant="outline" disabled={page===0||loading} onPress={()=>setPage(p=>p-1)}/>
    <AppButton design="refined" title="التالي" variant="outline" disabled={!data?.has_more||loading} onPress={()=>setPage(p=>p+1)}/>
  </View>;
}

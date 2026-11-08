import {useCallback,useMemo,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AppButton} from '@/components/ui/AppButton';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {MerchantSettlementPanel} from '@/components/merchant/MerchantSettlementPanel';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useOrderRealtime} from '@/hooks/useOrderRealtime';
import {getC7Overview} from '@/lib/merchant-settlements-c7';
export function MerchantSettlementAdministration(){const {user}=useAuth();return user?<OwnedSettlementAdministration key={user.id} actor={user.id}/>:null;}
function OwnedSettlementAdministration({actor}:{actor:string}){
 const {colors}=useTheme(),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const read=useCallback(()=>getC7Overview(actor,page),[actor,page]);const {data,loading,error,refresh}=useCustodyRead(`c7-admin:${actor}:${page}`,read);
 const subscriptions=useMemo(()=>[{table:'merchant_delivery_positions' as const},{table:'merchant_settlement_documents' as const},{table:'c7_merchant_settlement_payments' as const}],[]);
 useOrderRealtime({channelName:`c7-admin:${actor}`,enabled:true,subscriptions,onChange:refresh});
 return <View style={{gap:Spacing.three}}>
 <Text style={{...Typography.sectionTitle,color:colors.text,textAlign:'right'}}>مستحقات جميع المتاجر — C7</Text>
 {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}<AppButton design="refined" title="تحديث مستحقات المتاجر" variant="outline" onPress={refresh}/>
 {data?.rows.map(r=><View key={r.store_id} style={{padding:Spacing.four,borderWidth:1,borderColor:colors.border,borderRadius:16,gap:Spacing.two,backgroundColor:colors.surface}}><Text style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{r.store_name}</Text><FinancialAmount label="المبيعات المسلّمة" amount={r.position.gross}/><FinancialAmount label="عمولة المنصة" amount={r.position.commission}/><FinancialAmount label="الجاهز للتسوية" amount={r.position.available}/><FinancialAmount label="قيد التسوية" amount={r.position.pending}/><FinancialAmount label="المصروف" amount={r.position.paid}/>{r.position.review_required?<FinancialStatus label="تحتاج مراجعة مالية" tone="error"/>:null}<AppButton design="refined" title="تفاصيل المستحقات وإعداد التسوية والصرف" variant="outline" onPress={()=>setSelected(r.store_id)}/></View>)}
 {data&&!data.rows.length?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>لا توجد مبيعات مسلّمة في النظام الجديد بعد.</Text>:null}
 <AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data?.has_more||loading} onPress={()=>setPage(p=>p+1)}/>
 {selected?<><AppButton design="refined" title="إغلاق تفاصيل المتجر" variant="outline" onPress={()=>setSelected(null)}/><MerchantSettlementPanel key={`${actor}:${selected}`} storeId={selected} admin/></>:null}
 </View>;
}

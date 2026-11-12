import { formatSypNumber } from "@/lib/money";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { getUnsettledEntitlements, type SettlementEntitlement } from "@/lib/merchant-settlements";
import { createSettlementAttemptController, type SettlementAttempt } from '@/lib/settlement-attempt';
import { sumMoney } from '@/lib/financial-input';
export default function CreateMerchantSettlement(){const{user}=useAuth();return user?<CreateForm key={user.id} ownerId={user.id}/>:null;}
function CreateForm({ownerId}:{ownerId:string}){
 const{colors}=useTheme(),router=useRouter();
 const[rows,setRows]=useState<SettlementEntitlement[]>([]),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[ready,setReady]=useState(false),[attempt,setAttempt]=useState<SettlementAttempt|null>(null);
 const lock=useRef(false),sequence=useRef(0),active=useRef(false);const controller=useMemo(()=>createSettlementAttemptController(ownerId,'create'),[ownerId]);
 const load=useCallback(async()=>{const request=++sequence.current;setLoading(true);try{const saved=await controller.restore();if(request!==sequence.current)return;setAttempt(saved);setReady(true);if(saved?.kind==='batch')setSelected(saved.input.ids);const next=await getUnsettledEntitlements();if(request===sequence.current){setRows(next);setError('');}}catch{if(request===sequence.current)setError('تعذر تحميل المستحقات أو محاولة الإنشاء المحفوظة. أعد المحاولة.');}finally{if(request===sequence.current)setLoading(false);}},[controller]);
 const cancelLoad=useCallback(()=>{sequence.current++;},[]);
 useEffect(()=>{active.current=true;const timer=setTimeout(()=>void load(),0);return()=>{active.current=false;clearTimeout(timer);cancelLoad();};},[load,cancelLoad]);
 const chosen=useMemo(()=>rows.filter(item=>selected.includes(item.merchant_order_entitlement_id)),[rows,selected]);const total=sumMoney(chosen.map(item=>item.remaining_amount));
 const toggle=(item:SettlementEntitlement)=>{if(lock.current||busy||attempt)return;if(chosen.some(choice=>choice.merchant_id!==item.merchant_id)){setError('اختر مستحقات تاجر واحد؛ ألغِ الاختيار الحالي قبل التبديل.');return;}setSelected(current=>current.includes(item.merchant_order_entitlement_id)?current.filter(id=>id!==item.merchant_order_entitlement_id):[...current,item.merchant_order_entitlement_id]);};
 const submit=async(readOnly=false)=>{if(lock.current||!ready||(!attempt&&!chosen.length))return;lock.current=true;setBusy(true);try{const operation=attempt??{kind:'batch' as const,input:{merchantId:chosen[0].merchant_id,ids:selected}};const result=await controller.run(operation,readOnly);const saved=await controller.restore();if(!active.current)return;setAttempt(saved);if(result.kind==='confirmed'){await controller.finish();if(!active.current)return;router.replace(`/admin/merchant-settlement-details?batchId=${result.id}` as Href);}else setError(result.message);}catch{setError('تعذر استكمال المحاولة. تحقق من السجل؛ لن ننشئ مفتاحًا بديلًا تلقائيًا.');}finally{lock.current=false;setBusy(false);}};
 if(loading&&!rows.length)return <View style={styles.center}><ActivityIndicator color={colors.primary}/></View>;
 return <ScrollView style={[styles.screen,{backgroundColor:colors.background}]} contentContainerStyle={styles.content}>
  {error?<><Text style={[styles.meta,{color:colors.error}]}>{error}</Text><AppButton title="إعادة التحميل" variant="outline" disabled={busy} onPress={()=>void load()}/></>:null}
  {attempt?<><Text style={[styles.meta,{color:colors.textSecondary}]}>محاولة محفوظة؛ المتابعة تستخدم المدخلات والمفتاح نفسيهما.</Text><AppButton title="التحقق بالقراءة فقط" variant="outline" disabled={busy} onPress={()=>void submit(true)}/>{attempt.phase==='rejected'?<AppButton title="إنهاء المحاولة المرفوضة" variant="outline" disabled={busy} onPress={()=>{void controller.finish().then(()=>{setAttempt(null);setSelected([]);setError('');}).catch(()=>setError('تعذر إنهاء المحاولة محليًا.'));}}/>:null}</>:null}
  <Text style={[styles.meta,{color:colors.textSecondary}]}>اختر مستحقات تاجر واحد بالليرة السورية. إنشاء التسوية لا يسجل دفعًا.</Text>
  {!rows.length&&!attempt?<Text style={[styles.meta,{color:colors.textSecondary}]}>لا توجد مستحقات غير مدفوعة وغير محجوزة متاحة للتسوية.</Text>:null}
  {rows.map(item=><Pressable key={item.merchant_order_entitlement_id} disabled={busy||Boolean(attempt)} onPress={()=>toggle(item)} style={[styles.card,{backgroundColor:selected.includes(item.merchant_order_entitlement_id)?colors.primaryLight:colors.surface,borderColor:colors.border}]}><Text style={[styles.title,{color:colors.text}]}>طلب {item.store_order_id.slice(0,8)} · {item.currency}</Text><Text style={[styles.meta,{color:colors.textSecondary}]}>التسليم {new Date(item.delivered_at).toLocaleDateString('ar-SY')} · المتاح {formatSypNumber(item.remaining_amount)}</Text></Pressable>)}
  {selected.length&&!attempt?<AppButton title="إلغاء الاختيار" variant="outline" disabled={busy} onPress={()=>setSelected([])}/>:null}
  <AppButton title={attempt?'متابعة المحاولة بالمفتاح المحفوظ':`إنشاء تسوية بمجموع ${formatSypNumber(total)}`} loading={busy} disabled={!ready||(!attempt&&!chosen.length)||attempt?.phase==='rejected'} onPress={()=>void submit()}/>
 </ScrollView>;
}
const styles=StyleSheet.create({screen:{flex:1},center:{flex:1,justifyContent:'center'},content:{padding:Spacing.five,gap:Spacing.three,paddingBottom:Spacing.ten},card:{borderWidth:1,borderRadius:Radius.lg,padding:Spacing.four,gap:Spacing.one},title:{fontFamily:Fonts.bold,fontSize:FontSizes.md,textAlign:'right'},meta:{fontFamily:Fonts.regular,fontSize:FontSizes.sm,textAlign:'right',lineHeight:22}});

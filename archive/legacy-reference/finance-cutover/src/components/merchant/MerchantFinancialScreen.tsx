import { MerchantSettlementPanel } from "@/components/merchant/MerchantSettlementPanel";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { FinancialCard, FinancialLink, FinancialMetrics, FinancialRecord, FinancialShare, FinancialText, ledgerSources } from "@/components/merchant/MerchantFinancialCards";
import { FinancialDatePicker } from "@/components/merchant/FinancialDatePicker";
import { Typography, Radius } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { financialIdentity, loadFinancialView, type FinancialView, type FinancialViewData, type FinancialViewFilter } from "@/lib/merchant-financial-details";
import { createFinancialReader, type FinancialReadState } from "@/lib/financial-reader";
import { financialPeriod } from "@/lib/financial-input";
import { formatSyp } from "@/lib/money";

const labels:Record<string,string>={open:'مفتوحة',partially_paid:'جزئية',completed:'مكتملة',unsettled:'غير مدرجة بتسوية',paid:'مسددة',void:'ملغاة',cash:'نقدي',external_transfer:'حوالة خارجية',increase_exposure:'زيادة الالتزامات',decrease_exposure:'خفض الالتزامات'};
export function MerchantFinancialScreen({section}:{section:FinancialView}) {
 const{user}=useAuth(); const params=useLocalSearchParams<{storeOrderId?:string;batchId?:string;invoiceId?:string;paymentId?:string;entryId?:string}>();
 const recordId=section==='sale'?params.storeOrderId:section==='settlement'?params.batchId:section==='invoice'?params.invoiceId:section==='payment'?params.paymentId:section==='entry'?params.entryId:undefined;
 return user?<OwnedFinance key={`${user.id}:${section}:${recordId??''}`} ownerId={user.id} section={section} recordId={typeof recordId==='string'?recordId:undefined}/>:null;
}
function OwnedFinance({ownerId,section,recordId}:{ownerId:string;section:FinancialView;recordId?:string}){
 const{colors}=useTheme();
 const[from,setFrom]=useState(''),[to,setTo]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[effect,setEffect]=useState(''),[source,setSource]=useState(''),[error,setError]=useState('');
 const[applied,setApplied]=useState<FinancialViewFilter>({}),[page,setPage]=useState(0),[paymentsPage,setPaymentsPage]=useState(0);
 const list=['sales','settlements','commissions','invoices','payments','ledger'].includes(section);
 const filter=useMemo(()=>({...applied,recordId,page,paymentsPage}),[applied,recordId,page,paymentsPage]);
 const choices=section==='sales'?['unsettled','open','partially_paid','completed']:section==='settlements'?['open','partially_paid','completed']:section==='invoices'?['open','partially_paid','paid','void']:section==='payments'?['cash','external_transfer']:[];
 const apply=()=>{try{financialPeriod(from,to);setError('');setPage(0);setPaymentsPage(0);setApplied({from,to,status,effect,source,...(section==='sales'||section==='commissions'?{order:search}:{search})});}catch(failure){setError(failure instanceof Error?failure.message:'راجع الفترة.');}};
 return <View style={[styles.screen,{backgroundColor:colors.background}]}>
  <FinanceResults key={JSON.stringify(filter)} ownerId={ownerId} section={section} filter={filter} page={page} paymentsPage={paymentsPage} setPage={setPage} setPaymentsPage={setPaymentsPage} header={list?<View style={styles.stack}>
   <FinancialDatePicker title="من تاريخ" value={from} onChange={setFrom}/><FinancialDatePicker title="إلى تاريخ" value={to} onChange={setTo}/>
   <FinancialText>الفترة حسب توقيت جهازك، وتشمل يوم النهاية كاملًا. اختر الفلاتر ثم اضغط تطبيق.</FinancialText>
   {section!=='settlements'?<AppTextField design="refined" label={section==='ledger'?'بحث بمعرّف المصدر الكامل':section==='invoices'?'بحث برقم الفاتورة':section==='payments'?'بحث بمرجع الدفعة':'بحث برقم الطلب الكامل'} value={search} onChangeText={setSearch} placeholder="بحث"/>:null}
   {choices.length?<View style={styles.choices}>{['',...choices].map(value=><Choice key={value} title={labels[value]??'كل الحالات'} selected={status===value} onPress={()=>setStatus(value)}/>)}</View>:null}
   {section==='ledger'?<><View style={styles.choices}>{['','increase_exposure','decrease_exposure'].map(value=><Choice key={value} title={labels[value]??'كل الآثار'} selected={effect===value} onPress={()=>setEffect(value)}/>)}</View><View style={styles.choices}>{['',...Object.keys(ledgerSources)].map(value=><Choice key={value} title={ledgerSources[value]??'كل المصادر'} selected={source===value} onPress={()=>setSource(value)}/>)}</View></>:null}
   {error?<FinancialText>{error}</FinancialText>:null}<AppButton design="refined" title="تطبيق البحث والفلاتر" onPress={apply}/>
  </View>:null}/>
 </View>;
}
function FinanceResults({ownerId,section,filter,page,paymentsPage,setPage,setPaymentsPage,header}:{ownerId:string;section:FinancialView;filter:FinancialViewFilter;page:number;paymentsPage:number;setPage:(page:number)=>void;setPaymentsPage:(page:number)=>void;header:React.ReactNode}){
 const{colors}=useTheme();const[state,setState]=useState<FinancialReadState<FinancialViewData>|null>(null);
 const controller=useMemo(()=>createFinancialReader(signal=>financialIdentity(ownerId,signal),(identity,signal)=>loadFinancialView(identity,section,filter,signal),setState),[ownerId,section,filter]);
 useFocusEffect(useCallback(()=>{controller.activate();void controller.load();return()=>controller.deactivate();},[controller]));
 const data=state&&!state.validating?state.data:null;
 return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={Boolean(state?.loading&&state.data)} onRefresh={()=>void controller.load()} tintColor={colors.primary} colors={[colors.primary]}/> }>
  {section==='overview'?<><MerchantSettlementPanel/><FinancialText title>السجل السابق والالتزامات المنفصلة</FinancialText></>:null}
  {header}
  <FinancialText>{section==='ledger'||section==='entry'?'دفتر الالتزامات منفصل عن مستحقات المبيعات؛ ليس محفظة أو رصيدًا للسحب.':'مستحقات المبيعات منفصلة عن التزامات الاشتراك والعمولات. السجلات للقراءة فقط.'}</FinancialText>
  {section==='commissions'?<FinancialText title>العمولات المستحقة فقط</FinancialText>:null}
  {section==='sales'?<FinancialText>الفترة بتاريخ التسليم. الإجماليات الخادمية تشمل جميع النتائج؛ المدفوع والتعديلات يعكسان الوضع الحالي حتى لو سُجلا لاحقًا.</FinancialText>:null}
  {section==='settlements'?<FinancialText>الفترة بتاريخ إنشاء التسوية. إنشاؤها لا يعني دفعها؛ الحالة المعروضة مشتقة من المدفوع والمتبقي.</FinancialText>:null}
  {section==='commissions'?<FinancialText>الفترة بتاريخ استحقاق العمولة. النسبة وأساس الحساب محفوظان وقت الطلب، وليسا من الخطة الحالية.</FinancialText>:null}
  {state?.error?<View style={[styles.message,{backgroundColor:colors.errorSurface,borderColor:colors.errorBorder}]}><Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{state.error}</Text><AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={()=>void controller.load()}/></View>:null}
  {!state||state.loading?<View style={styles.stack}><ActivityIndicator color={colors.primary}/><FinancialText>{data?'جارٍ تحديث آخر قراءة…':'جارٍ التحقق وتحميل الحساب المالي…'}</FinancialText></View>:null}
  {data?<>
   {section==='overview'?<Overview data={data}/>:null}
   {section==='sales'?data.summary.map((row,index)=><FinancialCard key={index} title="إجمالي جميع المبيعات المطابقة"><FinancialMetrics row={row}/><FinancialShare row={row} title="ملخص المبيعات" scope={`من ${filter.from||'البداية'} إلى ${filter.to||'الآن'}؛ حالة ${labels[filter.status??'']??'الكل'}؛ طلب ${filter.order||'الكل'}؛ إجماليات الخادم لجميع النتائج`}/></FinancialCard>):null}
   {data.record?<FinancialRecord key={String(data.record.id??data.record.store_order_id)} row={data.record} section={section} detail/>:null}
   {section==='sale'?<><FinancialText>العكس وزيادة المستحق وجهان لنفس التصحيح؛ لا تجمع سجل الأحداث كمؤشر مالي.</FinancialText><FinancialText title>عناصر طلب متجرك المثبتة</FinancialText>{data.orderItems?.map(item=><FinancialCard key={item.id} title={item.product_title_snapshot}><FinancialText>{item.quantity.toLocaleString('ar-SY',{maximumFractionDigits:3})} × {item.selling_unit_snapshot}</FinancialText><FinancialText>سعر الوحدة المثبت: {formatSyp(item.unit_price_snapshot,item.currency)}</FinancialText><FinancialText>إجمالي السطر المثبت: {formatSyp(item.line_total,item.currency)}</FinancialText>{item.offer_snapshot&&typeof item.offer_snapshot==='object'&&!Array.isArray(item.offer_snapshot)&&typeof item.offer_snapshot.title==='string'?<FinancialText>العرض المثبت: {item.offer_snapshot.title}</FinancialText>:null}</FinancialCard>)}</>:null}
   {section==='settlement'?<FinancialText title>الطلبات المشمولة — مبالغ الإدراج المثبتة</FinancialText>:null}
   {section==='invoice'||section==='payment'?<FinancialText>التخصيصات والمتبقي وفق قراءة جميع التخصيصات المتاحة، وليست إجماليات الصفحة فقط. المدفوعات المسجلة ليست إثباتًا مصرفيًا مستقلًا.</FinancialText>:null}
   {section!=='overview'&&section!=='entry'?<>
    {data.rows.map((row,index)=><FinancialRecord key={`${row.event_type??'row'}:${row.id??row.store_order_id??index}`} row={row} section={section}/>)}
    {!data.rows.length?<FinancialText>{section==='invoice'||section==='payment'?'لا توجد تخصيصات مسجلة.':'لا توجد سجلات مطابقة.'}</FinancialText>:null}
    <Pagination page={page} count={data.count} change={setPage}/>
   </>:null}
   {section==='settlement'?<><FinancialText title>دفعات المكتب المسجلة</FinancialText>{data.payments.map(row=><FinancialRecord key={String(row.id)} row={row} section="settlement"/>)}{!data.payments.length?<FinancialText>لم يسجل المكتب دفعات لهذه التسوية.</FinancialText>:null}<Pagination page={paymentsPage} count={data.payments_count} change={setPaymentsPage}/></>:null}
  </>:null}
 </ScrollView>;
}
function Overview({data}:{data:FinancialViewData}){
 const sales=data.summary[0],obligations=data.obligations[0];
 const pick=(row:NonNullable<typeof sales>,keys:string[])=>Object.fromEntries(Object.entries(row).filter(([key])=>key==='currency'||keys.includes(key)));
 return <>
  <FinancialCard title="مستحقات المبيعات">{sales?<FinancialMetrics row={pick(sales,['current_entitlement_amount','paid_amount','remaining_amount'])}/>:<FinancialText>لا توجد مبيعات مسلّمة مسجلة.</FinancialText>}<FinancialLink title="المبيعات والمستحقات" href="/merchant/financial-sales"/><FinancialLink title="التسويات ودفعات المكتب" href="/merchant/settlements"/></FinancialCard>
  <FinancialCard title="حالة التسويات">{sales?<FinancialMetrics row={pick(sales,['open_count','partial_count','completed_count'])}/>:<FinancialText>لا توجد تسويات مسجلة.</FinancialText>}<FinancialText>المفتوحة تشمل الجزئية. إنشاء التسوية ليس دفعًا.</FinancialText></FinancialCard>
  <FinancialCard title="التزامات الحساب">{obligations?<FinancialMetrics row={pick(obligations,['invoice_outstanding','effective_exposure','credit_enabled','credit_limit','credit_available'])}/>:<FinancialText>لا توجد التزامات أو إعدادات ائتمانية مسجلة.</FinancialText>}<FinancialText>الائتمان مساحة مسموحة للالتزامات، وليس مالًا للسحب. دفع التسوية لا يغلق هذه القيود تلقائيًا.</FinancialText><FinancialLink title="دفتر الالتزامات" href="/merchant/financial-ledger"/></FinancialCard>
  <FinancialLink title="العمولات المستحقة" href="/merchant/sales-commissions"/><FinancialLink title="فواتير الاشتراك" href="/merchant/subscription-invoices"/><FinancialLink title="دفعات الاشتراك" href="/merchant/subscription-payments"/><FinancialLink title="الاشتراك والخطط" href="/merchant/subscription"/>
 </>;
}
function Pagination({page,count,change}:{page:number;count:number;change:(page:number)=>void}){return <><FinancialText>الصفحة {(page+1).toLocaleString('ar-SY')} · {count.toLocaleString('ar-SY')} سجل مطابق</FinancialText><View style={styles.choices}><AppButton design="refined" title="السابق" variant="outline" fullWidth={false} disabled={!page} onPress={()=>change(page-1)}/><AppButton design="refined" title="التالي" variant="outline" fullWidth={false} disabled={(page+1)*20>=count} onPress={()=>change(page+1)}/></View></>;}
function Choice({title,selected,onPress}:{title:string;selected:boolean;onPress:()=>void}){const{colors}=useTheme();return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[styles.choice,{borderColor:selected?colors.primary:colors.borderStrong,backgroundColor:selected?colors.surfaceSelected:colors.surface}]}><Text style={[styles.body,{color:selected?colors.primary:colors.text}]}>{title}</Text></Pressable>;}
const styles=StyleSheet.create({screen:{flex:1},content:{width:'100%',maxWidth:800,alignSelf:'center',padding:16,paddingBottom:24,gap:12},stack:{gap:12},choices:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},choice:{minHeight:48,padding:10,borderWidth:1,borderRadius:Radius.md,justifyContent:'center'},body:{...Typography.body,textAlign:'right'},message:{padding:12,borderWidth:1,borderRadius:Radius.md,gap:12}});

import { userErrorMessage } from "@/lib/user-error-message";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { PendingMoneyCard } from "@/components/finance/PendingMoneyCard";
import { FinancialAmount, FinancialFeedback, FinancialSection } from "@/components/finance/FinancialParts";
import { InvoiceStatus } from "@/components/finance/InvoiceStatus";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { useAuth } from "@/context/AuthContext";
import { useAppDialog } from "@/context/AppDialogContext";
import { useTheme } from "@/context/ThemeContext";
import { Typography } from "@/constants/theme";
import { formatSypExact } from "@/lib/money";
import { findOrderInvoice, invoiceKindLabels, moneyAction, pendingMoneyAction, purposeLabels, readInvoice, type InvoiceDetail, type MoneyAction, type MoneyDue } from "@/lib/invoice-finance";

export function InvoiceScreen({ order = false }: { order?: boolean }) {
  const { user,loading:authLoading } = useAuth();
  const router=useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; orderId?: string }>();
  const id = order ? params.orderId ?? params.id : params.id;
  if(authLoading)return <View style={{flex:1,backgroundColor:colors.background,justifyContent:"center"}}><LoadingSkeleton cards={1} label="جارٍ التحقق من الحساب"/></View>;
  if(!user||!id)return <View style={{flex:1,padding:20,gap:16,backgroundColor:colors.background}}><FinancialFeedback message={!user?"سجّل الدخول لعرض الفاتورة.":"لم تُحدد فاتورة. افتحها من قائمة الفواتير أو من الطلب المرتبط بها."}/><AppButton title={!user?"تسجيل الدخول":"قائمة الفواتير"} onPress={()=>router.replace(!user?"/login":"/invoice")}/></View>;
  return user && id ? <OwnedInvoice key={`${user.id}:${id}`} owner={user.id} id={id} order={order}/> : null;
}
function OwnedInvoice({ owner, id, order }: { owner: string; id: string; order: boolean }) {
  const { colors } = useTheme(), router = useRouter(), dialog = useAppDialog();
  const [data, setData] = useState<InvoiceDetail | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [due, setDue] = useState<MoneyDue | null>(null), [amount, setAmount] = useState(""), [settlementReason, setSettlementReason] = useState("");
  const [correctionReason,setCorrectionReason]=useState(""),[correcting,setCorrecting]=useState(false);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false);
  const [reviewReady,setReviewReady]=useState(false),[partialError,setPartialError]=useState("");
  const alive = useRef(false), generation = useRef(0), lock = useRef(false);
  const load = useCallback(async () => {
    const token = ++generation.current;
    try {
      const actual = order ? await findOrderInvoice(id) : id;
      const next=await readInvoice(actual);
      if (!alive.current || token !== generation.current) return;
      setData(next);setError("");
      try{
        const attempt=await pendingMoneyAction(owner);
        if(alive.current&&token===generation.current){setPending(!!attempt);setReviewReady(true);setPartialError("");}
      }catch{if(alive.current&&token===generation.current){setReviewReady(false);setPartialError("الفاتورة معروضة، لكن تعذر التحقق من العملية المحفوظة. حدّث البيانات قبل أي إجراء مالي.");}}
    } catch (e) { if (alive.current && token === generation.current) setError(userErrorMessage(e, "تعذر تحميل الفاتورة.")); }
  }, [id, order, owner]);
  useFocusEffect(useCallback(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [load]));
  const live = useOrderRealtime({channelName:`invoice:${owner}:${id}`,enabled:true,subscriptions:data?[{table:"money_invoices",filter:`id=eq.${data.id}`},{table:"money_invoices",filter:`owner_id=eq.${data.owner_id}`},{table:"money_allocations"}]:[{table:"money_invoices",filter:`owner_id=eq.${owner}`}],onChange:load});
  const admin = data?.admin === true;
  const currentDue=data?.dues.find(d=>d.id===due?.id);
  const dueSettled=currentDue?/^0(?:\.0{1,2})?$/.test(currentDue.remaining):false;
  const execute = async (input?: MoneyAction, expectedAttemptKey?:string) => {
    if (lock.current) return;
    if(!reviewReady){setError("حدّث الفاتورة للتحقق من العملية المحفوظة قبل المتابعة.");return;}
    if (input && input.reason.trim().length < 3) { setError("أدخل سببًا واضحًا."); return; }
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (input && !await dialog.confirm({ title: input.action === "settle" ? "تأكيد قبض أو صرف فعلي" : "تصحيح موثق", message: input.action === "settle" ? `${data?.reference} — ${data?.owner_name??"الطرف المرتبط بالفاتورة"}\n${due?.direction === "in" ? "تؤكد المنصة استلام" : "تؤكد المنصة تسليم"} ${input.amount} ل.س فعلًا.\nالسبب: ${input.reason}` : `${data?.reference}\nسيبقى المستند الأصلي ظاهرًا مع إلغاء أثره ومرجع التصحيح. لا يغير هذا حالة الطلب أو التسليم.\nالسبب: ${input.reason}`, confirmText: "تأكيد" })) return;
      if (!input && !await dialog.confirm({title:"استكمال المحاولة المحفوظة؟",message:"سنقرأ نتيجتها أولًا. إذا لم توجد نتيجة، فقد نرسل العملية المحفوظة نفسها بالمبلغ والطرف والمفتاح السابقين. لا تدخل بيانات بديلة ولا تسلّم المال مرة ثانية.",confirmText:"متابعة المحاولة نفسها"})) return;
      const result = await moneyAction(owner, input, expectedAttemptKey);
      if (alive.current) { setMessage(result.state === "completed" ? "تم اعتماد العملية." : "لم تُنفذ العملية: " + result.message); if(result.state==="completed"){setDue(null); setCorrecting(false); setSettlementReason(""); setCorrectionReason("");} await load(); }
    } catch (e) { if (alive.current) { setError(userErrorMessage(e, "النتيجة غير مؤكدة.")); setPending(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="تفاصيل الفاتورة" showBack showNotifications={false}/>
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, gap: 16, width:"100%",maxWidth:800,alignSelf:"center" }}>
      <LiveStatus state={live}/>
      {pending ? <PendingMoneyCard key={owner} owner={owner} busy={busy} onResume={key=>execute(undefined,key)} onRefresh={load}/> : null}
      {!data && !error ? <LoadingSkeleton label="جارٍ تحميل الفاتورة"/> : null}
      {partialError?<FinancialFeedback message={partialError} error/>:null}
      {data ? <>
        <DocumentReference value={data.reference}/>
        <Text style={{ ...Typography.cardTitle, color: colors.text, textAlign: "right" }}>{data.title}</Text>
        <Text style={{ ...Typography.body, color: colors.text, textAlign: "right" }}>{invoiceKindLabels[data.kind]}</Text>
        <Text style={{ ...Typography.pageTitle, color: colors.text, textAlign: "right" }}>{formatSypExact(data.amount)}</Text>
        {Object.entries(data.references).map(([key, value]) => <Text selectable key={key} style={{ ...Typography.body, color: colors.primary }}>{value}</Text>)}
        <InvoiceStatus invoice={data}/>
        {data.dues.length>0&&data.status==="confirmed"&&!data.voided_by?<Text style={{...Typography.body,color:colors.textSecondary,textAlign:"right"}}>تأكيد المستند يعني اعتماده. حالة السداد تتغير عند تسجيل القبض أو الصرف الفعلي.</Text>:null}
        <InvoiceDetails details={data.details}/>
        {data.dues.map(d => <FinancialSection key={d.id}>
          <Text style={{ ...Typography.bodyStrong, color: colors.text, textAlign: "right" }}>{purposeLabels[d.purpose]} · {d.direction === "in" ? admin?"عليه للمنصة":"عليك للمنصة" : admin?"حق له لدى المنصة":"حق لك لدى المنصة"}</Text>
          <FinancialAmount label="القيمة الأصلية" amount={d.amount}/><FinancialAmount label="المتبقي للتسوية" amount={d.remaining}/>
          {admin && !data.voided_by && data.status === "confirmed" && !/^0(?:\.0{1,2})?$/.test(d.remaining) ? <AppButton title={d.direction === "in" ? "تسجيل قبض فعلي" : "تسجيل صرف فعلي"} variant="outline" disabled={busy || pending || !reviewReady} onPress={() => { setCorrecting(false); setCorrectionReason(""); setDue(d); setAmount(d.remaining); setSettlementReason(""); }}/>: null}
        </FinancialSection>)}
        {due && !data.voided_by && data.status === "confirmed" ? <FinancialSection title={due.direction==="in"?"قبض فعلي للمنصة":"صرف فعلي للطرف"}>
          <DocumentReference value={data.reference}/>
          {currentDue?<FinancialAmount label="المتبقي حاليًا على المستحق" amount={currentDue.remaining}/>:<FinancialFeedback message="المستحق المحدد لم يعد متاحًا في البيانات الحالية. أغلق النموذج وراجع الفاتورة."/>}
          {dueSettled?<FinancialFeedback message="سُدد هذا المستحق بالكامل. لم نغيّر المبلغ الذي كتبته؛ لا تعتمد تسوية أخرى له."/>:null}
          <AppTextField label="مبلغ التسوية ل.س — يمكن دفع جزء" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" disabled={busy || pending || !reviewReady}/>
          <AppTextField label="سبب التسوية / مرجع التسليم" value={settlementReason} onChangeText={setSettlementReason} disabled={busy || pending || !reviewReady}/>
          <AppButton title="اعتماد فاتورة التسوية" loading={busy} disabled={pending||!reviewReady||!currentDue||dueSettled} onPress={() => void execute({ action: "settle", due: due.id, amount, reason:settlementReason })}/>
          <AppButton title="إغلاق النموذج" variant="outline" disabled={busy} onPress={() => {setDue(null);setSettlementReason("");setAmount("");}}/>
        </FinancialSection> : null}
        {data.settlements.length?<FinancialSection title="التسويات المرتبطة">{data.settlements.map(s => <AppButton key={s.id} title={`${s.reference} · ${formatSypExact(s.amount)}${s.voided ? " · ملغاة" : ""}`} variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: s.id } })}/>)}</FinancialSection>:null}
        {data.voided_by ? <AppButton title="فتح فاتورة التصحيح" variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: data.voided_by! } })}/> : null}
        {data.corrects ? <AppButton title="فتح المستند الأصلي" variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: data.corrects! } })}/> : null}
        {admin && data.status === "confirmed" && !data.voided_by && !["INV", "COR"].includes(data.kind) ? <>
          <AppButton title={correcting?"إغلاق الإجراءات الإضافية":"إجراءات إضافية — تصحيح المستند"} variant="outline" disabled={busy||pending} onPress={()=>{setCorrecting(!correcting);setCorrectionReason("");setDue(null);setSettlementReason("");}}/>
          {correcting?<View style={{gap:12,padding:16,borderWidth:1,borderColor:colors.warningBorder,borderRadius:12,backgroundColor:colors.warningSurface}}>
            <Text style={{...Typography.body,color:colors.warningForeground,textAlign:"right"}}>التصحيح يلغي الأثر المالي لهذا المستند مع الاحتفاظ بالأصل ومرجع التصحيح. لا يغيّر حالة الطلب أو التسليم. قد يلزم تصحيح تسوياته المرتبطة أولًا.</Text>
            <AppTextField label="سبب التصحيح" value={correctionReason} onChangeText={setCorrectionReason} multiline maxLength={1000} disabled={busy||pending}/>
            <AppButton title="مراجعة التصحيح واعتماده" variant="danger" loading={busy} disabled={pending||!reviewReady} onPress={()=>void execute({action:"correct",invoice:data.id,reason:correctionReason})}/>
          </View>:null}
        </> : null}
      </> : null}
      {error ? <FinancialFeedback message={error} error/> : null}
      {message ? <FinancialFeedback message={message}/> : null}
      <AppButton title="تحديث" variant="outline" disabled={busy} onPress={() => void load()}/>
    </KeyboardAwareScrollView>
  </View>;
}
const detailLabels: Record<string, string> = { recipient: "المستلم", address: "العنوان", phone: "الهاتف", delivery_fee: "رسوم التوصيل", commission_rate: "نسبة العمولة ٪", commission: "حق المنصة — العمولة", merchant_net: "حق التاجر", expected_collection: "التحصيل المتوقع", collected: "المقبوض من العميل", wage: "أجر المهمة", plan: "الخطة", months: "المدة بالشهور", product_limit: "حد المنتجات", reason: "السبب", original_reference: "المستند الأصلي", from: "من تاريخ", until: "حتى تاريخ غير شامل", policy_value: "قيمة سياسة الراتب" };
const monetary = new Set(["delivery_fee", "commission", "merchant_net", "expected_collection", "collected", "wage", "policy_value"]);
function InvoiceDetails({ details }: { details: Record<string, unknown> }) {
  const { colors } = useTheme();
  const body = { ...Typography.body, color: colors.text, textAlign: "right" as const };
  const items = (values: unknown) => Array.isArray(values) ? values.map((v, index) => {
    if (!v || typeof v !== "object") return null;
    const item = v as Record<string, unknown>;
    return <Text key={index} style={body}>{String(item.title ?? "منتج")} · الكمية {String(item.quantity ?? "")} · {typeof item.total === "string" ? formatSypExact(item.total) : ""}</Text>;
  }) : null;
  return <View style={{ gap: 10 }}>
    {Object.entries(details).filter(([key, value]) => key in detailLabels && (typeof value === "string" || typeof value === "number")).map(([key, value]) => <Text key={key} selectable style={body}>{detailLabels[key]}: {monetary.has(key) ? formatSypExact(String(value)) : String(value)}</Text>)}
    {details.wage_policy && typeof details.wage_policy === "object" ? <Text style={body}>سياسة الأجر: {({fixed:"مبلغ لكل مهمة",percentage:"نسبة من رسوم التوصيل",salary:"راتب مستقل"} as Record<string,string>)[String((details.wage_policy as Record<string,unknown>).mode)]} · {String((details.wage_policy as Record<string,unknown>).value)}</Text> : null}
    {items(details.items)}
    {Array.isArray(details.features) ? details.features.filter((v): v is string => typeof v === "string").map((v, i) => <Text key={i} style={body}>• {v}</Text>) : null}
    {Array.isArray(details.stores) ? details.stores.map((v, i) => {
      if (!v || typeof v !== "object") return null;const store = v as Record<string, unknown>;
      return <View key={i} style={{ gap: 6 }}><Text style={{ ...body, ...Typography.bodyStrong }}>{String(store.name)} · {String(store.reference ?? "")} · {store.status === "rejected" || store.status === "cancelled" ? "مستبعد من الإجمالي" : "ضمن الطلب"}</Text>{items(store.items)}</View>;
    }) : null}
  </View>;
}

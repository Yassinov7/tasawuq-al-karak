import { userErrorMessage } from "@/lib/user-error-message";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { PendingMoneyCard } from "@/components/finance/PendingMoneyCard";
import { FinancialAmount, FinancialFeedback, FinancialSection } from "@/components/finance/FinancialParts";
import { InvoiceStatus } from "@/components/finance/InvoiceStatus";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, type ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { AppIcon } from "@/components/ui/AppIcon";
import { useAuth } from "@/context/AuthContext";
import { useAppDialog } from "@/context/AppDialogContext";
import { useTheme } from "@/context/ThemeContext";
import { FontSizes, Fonts, Radius, RtlText, Spacing, Typography } from "@/constants/theme";
import { formatSypExact } from "@/lib/money";
import { findOrderInvoice, invoiceKindLabels, InvoiceUnavailableError, moneyAction, pendingMoneyAction, purposeLabels, readInvoice, type InvoiceDetail, type MoneyAction, type MoneyDue } from "@/lib/invoice-finance";
import { financialAccountDestination, financialDocumentTitle, savedFinancialDate } from "@/lib/shared-financial-presentation";

type OrderInvoiceSnapshot = { data: InvoiceDetail; loadedAt: number; scrollOffset: number };
const orderInvoiceSnapshots = new Map<string, OrderInvoiceSnapshot>();
const orderInvoiceFreshnessMs = 30_000;

export function InvoiceScreen({ order = false, customer = false, account }: { order?: boolean; customer?: boolean; account?: "/home" | "/driver" | "/admin" }) {
  const { user,loading:authLoading } = useAuth();
  const router=useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; orderId?: string }>();
  const id = order ? params.orderId ?? params.id : params.id;
  if(authLoading)return <View style={{flex:1,backgroundColor:colors.background,justifyContent:"center"}}><LoadingSkeleton cards={1} label="جارٍ التحقق من الحساب"/></View>;
  if(!user||!id)return <View style={{flex:1,padding:20,gap:16,backgroundColor:colors.background}}><FinancialFeedback message={!user?"سجّل الدخول لعرض الفاتورة.":"لم تُحدد فاتورة. افتحها من قائمة الفواتير أو من الطلب المرتبط بها."}/><AppButton title={!user?"تسجيل الدخول":"قائمة الفواتير"} onPress={()=>router.replace(!user?"/login":"/invoice")}/></View>;
  if (typeof id !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="المستند المالي" showBack showNotifications={false} onBack={() => router.canGoBack() ? router.back() : router.replace(account ? financialAccountDestination(account) ?? "/" : "/invoice")} />
    <View style={{ padding: Spacing.four }}><FinancialFeedback message="رابط المستند غير صالح. افتحه من القائمة المالية." error /></View>
  </View>;
  return user && id ? <OwnedInvoice key={`${user.id}:${account ?? "order"}:${id}`} owner={user.id} id={id} order={order} customer={customer} account={account}/> : null;
}
function OwnedInvoice({ owner, id, order, customer, account }: { owner: string; id: string; order: boolean; customer: boolean; account?: "/home" | "/driver" | "/admin" }) {
  const { colors } = useTheme(), router = useRouter(), dialog = useAppDialog();
  const customerView = order || customer;
  const snapshotKey = `${owner}:${id}`;
  const initialSnapshot = customerView ? orderInvoiceSnapshots.get(snapshotKey) : undefined;
  const [data, setData] = useState<InvoiceDetail | null>(initialSnapshot?.data ?? null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [due, setDue] = useState<MoneyDue | null>(null), [amount, setAmount] = useState(""), [settlementReason, setSettlementReason] = useState("");
  const [correctionReason,setCorrectionReason]=useState(""),[correcting,setCorrecting]=useState(false);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false), [refreshing, setRefreshing] = useState(false);
  const [reviewReady,setReviewReady]=useState(false),[partialError,setPartialError]=useState("");
  const [unavailable,setUnavailable]=useState(false);
  const alive = useRef(false), generation = useRef(0), lock = useRef(false);
  const scrollRef = useRef<ScrollView>(null), scrollOffset = useRef(initialSnapshot?.scrollOffset ?? 0), restoredScroll = useRef(false);
  const load = useCallback(async (force = false) => {
    const cached = customerView ? orderInvoiceSnapshots.get(snapshotKey) : undefined;
    if (!force && cached && Date.now() - cached.loadedAt < orderInvoiceFreshnessMs) {
      setData(cached.data); setError(""); setReviewReady(true); return;
    }
    const token = ++generation.current;
    if (force) setRefreshing(true);
    try {
      const actual = order ? await findOrderInvoice(id) : id;
      const next=await readInvoice(actual);
      if (!alive.current || token !== generation.current) return;
      if (next.id.toLowerCase() !== actual.toLowerCase() ||
          (account && next.admin !== (account === "/admin")) || (!next.admin && next.owner_id !== owner)) throw new InvoiceUnavailableError();
      setData(next);setError("");setUnavailable(false);
      if (customerView) orderInvoiceSnapshots.set(snapshotKey, { data: next, loadedAt: Date.now(), scrollOffset: scrollOffset.current });
      if (customerView || !next.admin) { setPending(false); setReviewReady(true); setPartialError(""); return; }
      try{
        const attempt=await pendingMoneyAction(owner);
        if(alive.current&&token===generation.current){setPending(!!attempt);setReviewReady(true);setPartialError("");}
      }catch{if(alive.current&&token===generation.current){setReviewReady(false);setPartialError("الفاتورة معروضة، لكن تعذر التحقق من العملية المحفوظة. حدّث البيانات قبل أي إجراء مالي.");}}
    } catch (e) {
      if (alive.current && token === generation.current) {
        setReviewReady(false);
        if (e instanceof InvoiceUnavailableError) {
          orderInvoiceSnapshots.delete(snapshotKey);
          setData(null);setPending(false);setPartialError("");setDue(null);setCorrecting(false);setUnavailable(true);
          setError("المستند غير موجود أو غير متاح لهذا الحساب.");
        } else {
          setError(dataErrorText);
        }
      }
    } finally { if (alive.current && token === generation.current) setRefreshing(false); }
  }, [account, customerView, id, order, owner, snapshotKey]);
  useFocusEffect(useCallback(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [load]));
  const refreshLive = useCallback(() => load(true), [load]);
  useOrderRealtime({channelName:`invoice:${owner}:${id}`,enabled:!unavailable,subscriptions:order?[{table:"money_invoices",filter:`owner_id=eq.${owner}`},{table:"money_allocations"}]:[{table:"money_invoices",filter:`id=eq.${id}`},{table:"money_allocations"}],onChange:refreshLive});
  const admin = data?.admin === true;
  const title = order ? "فاتورة الطلب" : data ? financialDocumentTitle(data.kind) : "المستند المالي";
  const back = () => router.canGoBack() ? router.back() : router.replace(account ? financialAccountDestination(account) ?? "/" : "/invoice");
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
    <AppHeader title={title} showBack onBack={back} showNotifications={false}/>
    <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={customerView ? styles.content : styles.sharedContent} showsVerticalScrollIndicator={false}
      onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; const snapshot = orderInvoiceSnapshots.get(snapshotKey); if (customerView && snapshot) snapshot.scrollOffset = scrollOffset.current; }}
      onContentSizeChange={() => { if (!customerView || restoredScroll.current || scrollOffset.current <= 0) return; restoredScroll.current = true; scrollRef.current?.scrollTo({ y: scrollOffset.current, animated: false }); }}>
      {pending ? <PendingMoneyCard key={owner} owner={owner} busy={busy} onResume={key=>execute(undefined,key)} onRefresh={load}/> : null}
      {!data && !error ? <LoadingSkeleton label="جارٍ تحميل الفاتورة"/> : null}
      {partialError?<FinancialFeedback message={partialError} error/>:null}
      {data && customerView ? <CustomerInvoiceDocument invoice={data} refreshing={refreshing} onRefresh={() => void load(true)} /> : null}
      {data && !customerView ? <>
        <FinancialSection>
          <DocumentReference value={data.reference}/>
          <InvoiceStatus invoice={data}/>
          <FinancialAmount label={data.kind === "SET" ? "مبلغ التسوية" : "قيمة المستند"} amount={data.amount} />
          {savedFinancialDate(data.confirmedAt) ? <DocumentRow label="تاريخ الاعتماد" value={savedFinancialDate(data.confirmedAt)!} />
            : savedFinancialDate(data.created_at) ? <DocumentRow label="تاريخ الإنشاء" value={savedFinancialDate(data.created_at)!} /> : null}
          {data.owner_name ? <DocumentRow label="الحساب المرتبط" value={data.owner_name} /> : null}
          {data.voided_by ? <FinancialFeedback message="أُلغي الأثر المالي لهذا المستند. يبقى ظاهرًا في السجل." /> : null}
        </FinancialSection>
        <InvoiceDetails details={data.details} cashDirection={data.cashDirection}/>
        {Object.keys(data.references).length ? <FinancialSection title="السجلات المرتبطة">
          {data.references.ORD ? <DocumentRow label="مرجع الطلب"><DocumentReference value={data.references.ORD} /></DocumentRow> : null}
          {data.references.SOR ? <DocumentRow label="مرجع طلب المتجر"><DocumentReference value={data.references.SOR} /></DocumentRow> : null}
          {data.references.TSK ? <DocumentRow label="مرجع المهمة"><DocumentReference value={data.references.TSK} /></DocumentRow> : null}
          {admin && data.customer_order_id ? <AppButton compact title="فتح تفاصيل الطلب" variant="outline"
            onPress={() => router.push({ pathname: "/admin/order-details", params: { orderId: data.customer_order_id! } })} /> : null}
          {account === "/driver" && data.task_id ? <AppButton compact title="فتح مهمة التوصيل" variant="outline"
            onPress={() => router.push({ pathname: "/driver/task-details", params: { taskId: data.task_id! } })} /> : null}
        </FinancialSection> : null}
        {!data.voided_by && data.status === "confirmed" ? data.dues.map(d => <FinancialSection key={d.id} title={purposeLabels[d.purpose] ?? "المستحق المرتبط"}>
          <Text style={{ ...Typography.bodyStrong, ...RtlText, color: colors.text }}>{d.direction === "in" ? admin?"على الطرف للمنصة":"عليك للمنصة" : admin?"مستحق للطرف من المنصة":"مستحق لك من المنصة"}</Text>
          <FinancialAmount label="القيمة الأصلية" amount={d.amount}/><FinancialAmount label="المتبقي للتسوية" amount={d.remaining}/>
          {admin && !data.voided_by && data.status === "confirmed" && !/^0(?:\.0{1,2})?$/.test(d.remaining) ? <AppButton title={d.direction === "in" ? "تسجيل قبض فعلي" : "تسجيل صرف فعلي"} variant="outline" disabled={busy || pending || !reviewReady} onPress={() => { setCorrecting(false); setCorrectionReason(""); setDue(d); setAmount(d.remaining); setSettlementReason(""); }}/>: null}
        </FinancialSection>) : null}
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
        {data.voided_by ? <AppButton title="فتح مستند التصحيح" variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: data.voided_by! } })}/> : null}
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
      {error ? <FinancialFeedback message={data && error === dataErrorText ? `تظهر آخر قراءة ناجحة. ${error}` : error} error/> : null}
      {message ? <FinancialFeedback message={message}/> : null}
      {!unavailable && (!customerView || (!data && error)) ? <AppButton compact title={error ? "إعادة المحاولة" : "تحديث المستند"} variant="outline" loading={refreshing} disabled={busy} onPress={() => void load(true)}/> : null}
    </KeyboardAwareScrollView>
  </View>;
}

const objectValue = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const stringValue = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const moneySum = (values: unknown[]) => {
  if (!values.length) return null;
  let cents = 0n;
  for (const value of values) {
    if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
    const [whole, fraction = ""] = value.split(".");
    cents += BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
};

function CustomerInvoiceDocument({ invoice, refreshing, onRefresh }: { invoice: InvoiceDetail; refreshing: boolean; onRefresh: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const details = invoice.details;
  const stores = Array.isArray(details.stores) ? details.stores.map(objectValue).filter((value): value is Record<string, unknown> => Boolean(value)) : [];
  const orderReference = invoice.references.ORD;
  const deliveryFee = stringValue(details.delivery_fee);
  const itemTotals = stores.flatMap(store => Array.isArray(store.items) ? store.items.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item)).map(item => item.total) : []);
  const productsTotal = moneySum(itemTotals);
  const paidTotal = moneySum(invoice.settlements.filter(settlement => !settlement.voided).map(settlement => settlement.amount));
  const remainingTotal = moneySum(invoice.dues.map(due => due.remaining));
  const isOrderInvoice = invoice.kind === "INV" && Boolean(invoice.customer_order_id);
  const deliverySummary = [stringValue(details.recipient), stringValue(details.address)].filter(Boolean).join(" · ");

  return <View style={[styles.document, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
    <View style={styles.documentHeader}>
      <View style={styles.referenceBlock}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>رقم الفاتورة</Text>
        <DocumentReference value={invoice.reference}/>
        <Text style={[styles.invoiceDate, { color: colors.textMuted }]}>{new Date(invoice.created_at).toLocaleString("ar-SY")}</Text>
      </View>
      <View style={styles.headerAside}>
        <InvoiceStatus invoice={invoice}/>
        <AppButton title="تحديث" icon="refresh-outline" variant="outline" compact fullWidth={false} loading={refreshing} disabled={refreshing} onPress={onRefresh}/>
      </View>
    </View>

    <View style={[styles.amountPanel, { backgroundColor: colors.surfaceSelected }]}>
      <View style={styles.amountPrimary}>
        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>إجمالي الفاتورة</Text>
        <Text selectable style={[styles.invoiceAmount, { color: colors.primary }]}>{formatSypExact(invoice.amount)}</Text>
      </View>
      {(remainingTotal || paidTotal) ? <View style={[styles.balanceMetrics, { borderStartColor: colors.border }]}>
        {remainingTotal ? <View style={styles.balanceMetric}><Text style={[styles.metricLabel, { color: colors.textMuted }]}>المتبقي</Text><Text style={[styles.metricValue, { color: colors.text }]}>{formatSypExact(remainingTotal)}</Text></View> : null}
        {paidTotal ? <View style={styles.balanceMetric}><Text style={[styles.metricLabel, { color: colors.textMuted }]}>المسدد</Text><Text style={[styles.metricValue, { color: colors.text }]}>{formatSypExact(paidTotal)}</Text></View> : null}
      </View> : null}
    </View>

    <View style={[styles.referenceSummary, { borderTopColor: colors.border }]}>
      {orderReference && invoice.customer_order_id ? <DocumentRow label="مرجع الطلب"><CustomerReferenceLink value={orderReference} label="تفاصيل الطلب" onPress={() => router.push({ pathname: "/order-details", params: { id: invoice.customer_order_id! } })}/></DocumentRow> : null}
      {!isOrderInvoice ? <DocumentRow label="نوع المستند" value={invoiceKindLabels[invoice.kind] ?? "مستند مالي"}/> : null}
      {stores.length ? <DocumentRow label="المتاجر" value={`${stores.length} ${stores.length === 1 ? "متجر" : "متاجر"}`}/> : null}
      {deliverySummary ? <DocumentRow label="التوصيل" value={deliverySummary}/> : null}
      {stringValue(details.phone) ? <DocumentRow label="التواصل" value={String(details.phone)}/> : null}
    </View>

    {stores.length ? <DocumentSection title="محتويات الفاتورة">
      {stores.map((store, storeIndex) => {
        const items = Array.isArray(store.items) ? store.items.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
        return <View key={stringValue(store.reference) ?? `${storeIndex}`} style={[styles.storeGroup, storeIndex > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.storeHeading}>
            <Text style={[styles.storeName, { color: colors.text }]}>{stringValue(store.name) ?? "متجر"}</Text>
          </View>
          {items.map((item, itemIndex) => <View key={`${storeIndex}:${itemIndex}`} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{stringValue(item.title) ?? "منتج"}</Text>
              {(stringValue(item.quantity) || stringValue(item.unit_price)) ? <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                {[stringValue(item.quantity) ? `الكمية: ${String(item.quantity)}` : null, stringValue(item.unit_price) ? `سعر الوحدة: ${formatSypExact(String(item.unit_price))}` : null].filter(Boolean).join(" · ")}
              </Text> : null}
            </View>
            {stringValue(item.total) ? <Text style={[styles.itemTotal, { color: colors.text }]}>{formatSypExact(String(item.total))}</Text> : null}
          </View>)}
        </View>;
      })}
    </DocumentSection> : null}

    {(productsTotal || deliveryFee) ? <DocumentSection title="تفصيل المبلغ">
      {productsTotal ? <DocumentRow label="المنتجات والعروض" value={formatSypExact(productsTotal)}/> : null}
      {deliveryFee ? <DocumentRow label="التوصيل" value={formatSypExact(deliveryFee)}/> : null}
      <DocumentRow label="الإجمالي النهائي" value={formatSypExact(invoice.amount)} strong/>
    </DocumentSection> : null}

    {invoice.settlements.length || invoice.voided_by || invoice.corrects ? <DocumentSection title="المستندات المرتبطة">
      <View style={styles.relatedActions}>
        {invoice.settlements.map(settlement => <AppButton key={settlement.id} title={`${settlement.reference} · ${formatSypExact(settlement.amount)}${settlement.voided ? " · ملغاة" : ""}`} variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: settlement.id } })}/>)}
        {invoice.voided_by ? <AppButton title="فتح فاتورة التصحيح" variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: invoice.voided_by! } })}/> : null}
        {invoice.corrects ? <AppButton title="فتح المستند الأصلي" variant="outline" onPress={() => router.push({ pathname: "/financial-invoice", params: { id: invoice.corrects! } })}/> : null}
      </View>
    </DocumentSection> : null}

  </View>;
}

function CustomerReferenceLink({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${value}`} accessibilityHint={`يفتح ${label}`}
    onPress={onPress} style={({ pressed }) => [styles.referenceLink, { opacity: pressed ? 0.62 : 1 }]}>
    <DocumentReference value={value}/>
    <AppIcon name="open-outline" size={15} color={colors.primary}/>
  </Pressable>;
}

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.documentSection, { borderTopColor: colors.border }]}>
    <Text style={[styles.sectionLabel, { color: colors.text }]}>{title}</Text>
    {children}
  </View>;
}

function DocumentRow({ label, value, strong = false, children }: { label: string; value?: string; strong?: boolean; children?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.documentRow}>
    <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
    {children ?? <Text selectable style={[styles.rowValue, { color: strong ? colors.primary : colors.text }, strong && styles.rowValueStrong]}>{value}</Text>}
  </View>;
}
const detailLabels: Record<string, string> = { recipient: "المستلم", address: "العنوان", phone: "الهاتف", delivery_fee: "رسوم التوصيل", commission_rate: "نسبة العمولة ٪", commission: "حق المنصة — العمولة", merchant_net: "حق التاجر", expected_collection: "التحصيل المتوقع", collected: "المقبوض من العميل", wage: "أجر المهمة", plan: "الخطة", months: "المدة بالشهور", product_limit: "حد المنتجات", reason: "السبب", original_reference: "المستند الأصلي", from: "من تاريخ", until: "حتى تاريخ غير شامل", policy_value: "قيمة سياسة الراتب" };
const monetary = new Set(["delivery_fee", "commission", "merchant_net", "expected_collection", "collected", "wage", "policy_value"]);
const dataErrorText = "تعذر تحميل المستند. تحقق من الاتصال ثم أعد المحاولة.";
function InvoiceDetails({ details, cashDirection }: { details: Record<string, unknown>; cashDirection?: "in" | "out" }) {
  const { colors } = useTheme();
  const body = { ...Typography.body, ...RtlText, color: colors.text };
  const fields = Object.entries(details).filter(([key, value]) => Object.hasOwn(detailLabels, key) &&
    (typeof value === "number" || (typeof value === "string" && value.trim())) &&
    (!monetary.has(key) || /^-?\d+(?:\.\d{1,2})?$/.test(String(value))));
  const items = (values: unknown) => Array.isArray(values) ? values.map((v, index) => {
    if (!v || typeof v !== "object") return null;
    const item = v as Record<string, unknown>;
    return <Text key={index} style={body}>{String(item.title ?? "منتج")} · الكمية {String(item.quantity ?? "")} · {typeof item.total === "string" ? formatSypExact(item.total) : ""}</Text>;
  }) : null;
  const wagePolicy = objectValue(details.wage_policy);
  const wageMode = wagePolicy?.mode === "fixed" ? "مبلغ لكل مهمة" : wagePolicy?.mode === "percentage"
    ? "نسبة من رسوم التوصيل" : wagePolicy?.mode === "salary" ? "راتب مستقل" : null;
  if (!fields.length && !cashDirection && !wageMode && !["items","features","stores"].some(key => Array.isArray(details[key]) && details[key].length > 0)) return null;
  return <FinancialSection title="تفاصيل المستند">
    {cashDirection ? <DocumentRow label="اتجاه التسوية" value={cashDirection === "in" ? "قبض للمنصة" : "صرف من المنصة"} /> : null}
    {fields.map(([key, value]) => <DocumentRow key={key} label={detailLabels[key]} value={monetary.has(key) ? formatSypExact(String(value)) : String(value)} />)}
    {wageMode ? <DocumentRow label="سياسة الأجر المثبتة" value={wageMode} /> : null}
    {items(details.items)}
    {Array.isArray(details.features) ? details.features.filter((v): v is string => typeof v === "string").map((v, i) => <Text key={i} style={body}>• {v}</Text>) : null}
    {Array.isArray(details.stores) ? details.stores.map((v, i) => {
      if (!v || typeof v !== "object") return null;const store = v as Record<string, unknown>;
      return <View key={i} style={{ gap: 6 }}><Text style={{ ...body, ...Typography.bodyStrong }}>{String(store.name)} · {String(store.reference ?? "")} · {store.status === "rejected" || store.status === "cancelled" ? "مستبعد من الإجمالي" : "ضمن الطلب"}</Text>{items(store.items)}</View>;
    }) : null}
  </FinancialSection>;
}

const styles = StyleSheet.create({
  content: { alignSelf: "center", gap: Spacing.four, maxWidth: 800, paddingBottom: Spacing.eight, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, width: "100%" },
  sharedContent: { alignSelf: "center", gap: 16, maxWidth: 800, padding: 20, width: "100%" },
  document: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden", padding: Spacing.three },
  documentHeader: { alignItems: "flex-start", flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, justifyContent: "space-between" },
  referenceBlock: { alignItems: "flex-end", gap: Spacing.half },
  headerAside: { alignItems: "flex-start", gap: Spacing.one },
  eyebrow: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  amountPanel: { alignItems: "center", borderRadius: Radius.md, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, marginTop: Spacing.two, padding: Spacing.two },
  amountPrimary: { alignItems: "flex-end", flex: 1, gap: Spacing.half, minWidth: 150 },
  amountLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  invoiceAmount: { fontFamily: Fonts.bold, fontSize: FontSizes.xxl, textAlign: "right", writingDirection: "ltr" },
  invoiceDate: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  balanceMetrics: { borderStartWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, paddingStart: Spacing.two },
  balanceMetric: { alignItems: "flex-end", gap: Spacing.half, minWidth: 88 },
  metricLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  metricValue: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  referenceSummary: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.one, marginTop: Spacing.two, paddingTop: Spacing.two },
  documentSection: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.one, marginTop: Spacing.two, paddingTop: Spacing.two },
  sectionLabel: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  documentRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two, justifyContent: "space-between", minHeight: 23 },
  rowLabel: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },
  rowValue: { flex: 1.4, fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "left" },
  rowValueStrong: { fontFamily: Fonts.bold, fontSize: FontSizes.md },
  storeGroup: { gap: Spacing.one, paddingVertical: Spacing.one },
  storeHeading: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, justifyContent: "space-between" },
  storeName: { flex: 1, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  referenceLink: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 44 },
  itemRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two, justifyContent: "space-between", paddingStart: Spacing.two, paddingVertical: Spacing.half },
  itemCopy: { alignItems: "flex-end", flex: 1, gap: Spacing.half, minWidth: 0 },
  itemTitle: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  itemMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  itemTotal: { flexShrink: 0, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "left" },
  relatedActions: { gap: Spacing.two },
});

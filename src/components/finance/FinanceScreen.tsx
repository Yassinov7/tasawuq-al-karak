import { userErrorMessage } from "@/lib/user-error-message";
import { LoadingSkeleton, RefreshStatus } from "@/components/ui/LoadingState";
import { PendingMoneyCard } from "@/components/finance/PendingMoneyCard";
import { FinancialAccountSummary } from "@/components/finance/FinancialAccountSummary";
import { InvoiceListItem, FinancialFeedback } from "@/components/finance/FinancialParts";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { AppHeader } from "@/components/navigation/AppHeader";
import { useCallback, useRef, useState, type ComponentType } from "react";
import type { MerchantFinanceViewProps } from "./MerchantFinanceView";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { useAuth } from "@/context/AuthContext";
import { useAppDialog } from "@/context/AppDialogContext";
import { useTheme } from "@/context/ThemeContext";
import { Typography } from "@/constants/theme";
import { moneyAction, moneyPeople, pendingMoneyAction, readMerchantMoney, readMoney, type MerchantInvoiceCursor, type MerchantInvoiceKind, type MoneyAction, type MoneyOverview, type MoneyPerson } from "@/lib/invoice-finance";

type FinanceScreenProps = { MerchantView?: ComponentType<MerchantFinanceViewProps> };

export function FinanceScreen({ MerchantView }: FinanceScreenProps = {}) {
  const { user,loading:authLoading } = useAuth(); const pathname = usePathname(), router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { colors } = useTheme();
  if(authLoading)return <View style={{flex:1,backgroundColor:colors.background,justifyContent:"center"}}><LoadingSkeleton cards={1} label="جارٍ التحقق من الحساب"/></View>;
  if(!user)return <View style={{flex:1,padding:20,gap:16,backgroundColor:colors.background}}><FinancialFeedback message="سجّل الدخول لعرض حسابك وفواتيرك."/><AppButton title="تسجيل الدخول" onPress={()=>router.replace("/login")}/></View>;
  return user ? <View style={{flex:1,backgroundColor:colors.background}}>{pathname === "/wallet" || pathname === "/invoice" || pathname.startsWith("/driver/") ? <AppHeader title={pathname === "/driver/cash-account" ? "المالية" : "الفواتير والحساب"} showBack={pathname !== "/driver/cash-account"} showNotifications={false}/> : null}<OwnedFinance key={`${user.id}:${params.search === "SUB-" ? "subscription" : "all"}`} owner={user.id} MerchantView={MerchantView}/></View> : null;
}
function OwnedFinance({ owner, MerchantView }: FinanceScreenProps & { owner: string }) {
  const { colors } = useTheme(), router = useRouter(), dialog = useAppDialog();
  const pathname=usePathname();
  const { search: initialSearch } = useLocalSearchParams<{ search?: string }>();
  const subscriptionSearch = pathname === "/merchant/finance" && initialSearch === "SUB-" ? "SUB-" : "";
  const driverView=pathname.startsWith("/driver"),merchantView=pathname.startsWith("/merchant"),adminView=pathname.startsWith("/admin");
  const [showPeople,setShowPeople]=useState(false),[peopleQuery,setPeopleQuery]=useState(""),[showPolicy,setShowPolicy]=useState(false);
  const [snapshot, setSnapshot] = useState<{scope:string;value:MoneyOverview;hasMore:boolean} | null>(null), [people, setPeople] = useState<MoneyPerson[]>([]);
  const [search, setSearch] = useState(MerchantView ? "" : subscriptionSearch), [query, setQuery] = useState(MerchantView ? "" : subscriptionSearch), [page, setPage] = useState(0), [person, setPerson] = useState("");
  const [kind, setKind] = useState<MerchantInvoiceKind>(subscriptionSearch ? "SUB" : "ALL");
  const [cursors, setCursors] = useState<MerchantInvoiceCursor[]>([]);
  const cursor = page > 0 ? cursors[page - 1] : undefined;
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [pending, setPending] = useState(false);
  const [mode, setMode] = useState("fixed"), [value, setValue] = useState(""), [reason, setReason] = useState("");
  const [reviewReady,setReviewReady]=useState(false),[partialError,setPartialError]=useState(""),[refreshing,setRefreshing]=useState(false);
  const scope = JSON.stringify([owner,person,query,page,kind,cursor]);
  const data = snapshot?.scope === scope ? snapshot.value : null;
  const alive = useRef(false), generation = useRef(0), lock = useRef(false);
  const load = useCallback(async () => {
    const token = ++generation.current;
    setRefreshing(true);
    try {
      const merchantPage = MerchantView ? await readMerchantMoney(query, kind, cursor) : null;
      const next = merchantPage ? merchantPage.overview : await readMoney(query, page, person || undefined);
      if (!alive.current || token !== generation.current) return;
      if (MerchantView && (next.admin || next.owner !== owner || next.rows.some(row => row.owner_id !== owner))) {
        setSnapshot(null);
        throw Error("تعذر التحقق من حساب المتجر.");
      }
      setSnapshot({scope,value:next,hasMore:merchantPage?.hasMore ?? false});setError("");setLoading(false);
      const [directory,attempt]=await Promise.allSettled([next.admin?moneyPeople():Promise.resolve([]),pendingMoneyAction(owner)]);
      if (!alive.current || token !== generation.current) return;
      if(directory.status==="fulfilled")setPeople(directory.value);
      if(attempt.status==="fulfilled"){setPending(!!attempt.value);setReviewReady(true);}else setReviewReady(false);
      setPartialError(attempt.status==="rejected"?"تعذر التحقق من العملية المحفوظة؛ عرض الحساب متاح، والإجراءات المالية متوقفة حتى إعادة التحقق.":directory.status==="rejected"?"الحساب معروض، لكن تعذر تحديث قائمة الأطراف. أعد المحاولة قبل اختيار حساب آخر.":"");
    } catch (e) { if (alive.current && token === generation.current) setError(userErrorMessage(e, "تعذر تحميل المالية.")); }
    finally { if (alive.current && token === generation.current) {setLoading(false);setRefreshing(false);} }
  }, [MerchantView, cursor, kind, owner, page, person, query, scope]);
  useFocusEffect(useCallback(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [load]));
  const live = useOrderRealtime({channelName:`money:${owner}`,enabled:true,subscriptions:[{table:"money_invoices"},{table:"money_allocations"},{table:"money_driver_policies"}],onChange:load});
  const execute = async (input?: MoneyAction, expectedAttemptKey?:string) => {
    if (lock.current) return;
    if(!reviewReady){setError("أعد تحديث الحساب للتحقق من العملية المحفوظة قبل تنفيذ إجراء مالي.");return;}
    if(input&&!data){setError("انتظر تحميل الحساب المحدد قبل تنفيذ إجراء.");return;}
    if (input && reason.trim().length < 3) { setError("أدخل سببًا واضحًا للعملية."); return; }
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (input && !await dialog.confirm({ title: "تأكيد العملية", message: `${selected?.name??"السائق المحدد"} · ${selected?.account_reference??""}\n${mode==="percentage"?"النسبة من رسوم التوصيل":"أجر المهمة"}: ${value}${mode==="percentage"?"٪":" ل.س"}\nالسبب: ${input.reason}`, confirmText: "اعتماد" })) return;
      if (!input && !await dialog.confirm({title:"استكمال المحاولة المحفوظة؟",message:"سنقرأ نتيجتها أولًا. إذا لم توجد نتيجة، فقد نرسل العملية المحفوظة نفسها بالمبلغ والطرف والمفتاح السابقين. لا تدخل بيانات بديلة ولا تسلّم المال مرة ثانية.",confirmText:"متابعة المحاولة نفسها"})) return;
      const result = await moneyAction(owner, input, expectedAttemptKey);
      if (alive.current) { setMessage(result.state === "completed" ? "تم اعتماد العملية." : "لم تُنفذ العملية: " + result.message); await load(); }
    } catch (e) { if (alive.current) { setError(userErrorMessage(e, "تعذر تأكيد العملية.")); setPending(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const selected = data && people.find(p => p.id === person);
  if (MerchantView) {
    const applySearch = (value: string) => {
      setSearch(value);
      if (page === 0 && query === value) {
        void load();
      } else {
        resetMerchantPage();
        setQuery(value);
      }
    };
    const resetMerchantPage = () => {
      generation.current++;
      setError("");
      setCursors([]);
      setPage(0);
    };
    const navigatePage = (nextPage: number) => {
      if (nextPage === page + 1) {
        const last = data?.rows.at(-1);
        if (!last || !snapshot?.hasMore) return;
        setCursors(previous => [...previous.slice(0, page), { createdAt: last.created_at, id: last.id }]);
      } else if (nextPage !== page - 1 || nextPage < 0) {
        return;
      }
      generation.current++;
      setError("");
      setPage(nextPage);
    };
    return <MerchantView
      account={snapshot?.value ?? null} data={data} search={search} query={query} page={page}
      kind={kind} hasNext={!!data && !!snapshot?.hasMore}
      busy={busy} refreshing={refreshing} live={live} error={error} partialError={partialError} message={message}
      onChangeSearch={setSearch} onSearch={applySearch} onRefresh={load}
      onKind={nextKind => {
        if (nextKind === kind) return;
        resetMerchantPage();
        setKind(nextKind);
      }}
      onPage={navigatePage}
      onInvoice={id => router.push({pathname:"/financial-invoice", params:{id}})}
      pendingReview={pending ? <PendingMoneyCard owner={owner} busy={busy} onResume={key=>execute(undefined,key)} onRefresh={load}/> : null}
    />;
  }
  return <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 36, width:"100%",maxWidth:800,alignSelf:"center" }}>
    <Text style={{ ...Typography.pageTitle, color: colors.text, textAlign: "right" }}>{adminView || snapshot?.value.admin ? person ? selected ? `حساب ${selected.name}` : "الحساب المحدد" : "خزينة المنصة والفواتير" : driverView ? "تحصيلاتي وأجري" : merchantView ? "حساب متجري وفواتيري" : "فواتير طلباتي"}</Text>
    {data && (data.admin || data.account_reference) ? <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>{data.admin?person?"مستحقات هذا الطرف وفواتيره. يُسجل القبض والصرف من الفاتورة المعنية.":"نقد الخزينة هو المقبوض فعليًا بعد الصرف. المستحقات أدناه منفصلة عنه.":driverView?"سلّم كامل تحصيل العملاء للمنصة. يُصرف أجر التوصيل لك منفصلًا دون مقاصة.":"تابع مستحقات متجرك ورسوم اشتراكك من الفواتير المرتبطة بها. الرصيد الموجب حق لك، والسالب عليك للمنصة."}</Text> : null}
    {data?<FinancialAccountSummary data={data} selected={selected||undefined} targeted={!!person} view={driverView?"driver":merchantView?"merchant":"customer"}/>:null}
    {data && !/^0(?:\.0{1,2})?$/.test(data.subscription_due) ? <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>تبدأ فترة الاشتراك ويُتاح استقبال الطلبات بعد سداد فاتورة الاشتراك كاملة.</Text> : null}
    {snapshot?.value.admin ? <View style={{ gap: 8 }}>
      <AppButton title={person ? "عرض جميع الحسابات" : "جميع الحسابات"} variant="outline" disabled={busy} onPress={() => { setPerson(""); setPage(0);setShowPolicy(false);setReason(""); }}/>
      <AppButton title={showPeople?"إغلاق اختيار الحساب":"اختيار حساب تاجر أو سائق"} variant="outline" disabled={busy} onPress={()=>setShowPeople(!showPeople)}/>
      {showPeople?<AppTextField label="اسم الطرف أو رمز حسابه" value={peopleQuery} onChangeText={setPeopleQuery}/>:null}
      {showPeople?people.filter(p=>[p.name,p.account_reference].some(value=>value.toLocaleLowerCase("ar").includes(peopleQuery.trim().toLocaleLowerCase("ar")))).map(p => <Pressable key={p.id} disabled={busy} onPress={() => { setPerson(p.id); setPage(0);setShowPeople(false);setShowPolicy(false);setReason(""); setValue(p.policy && p.policy.mode !== "salary" ? String(p.policy.value) : ""); setMode(p.policy?.mode === "percentage" ? "percentage" : "fixed"); }} style={{ minHeight: 48, padding: 12, backgroundColor: p.id === person ? colors.surfaceSelected : colors.surface }}><Text style={{ ...Typography.body, color: colors.text, textAlign: "right" }}>{p.name} · {p.role === "driver" ? "سائق" : "تاجر"} · {p.account_reference}</Text></Pressable>):null}
      <AppButton title="إدارة خطط اشتراك التجار" variant="outline" onPress={() => router.push("/admin/plans")}/>
    </View> : null}
    {pending ? <PendingMoneyCard key={owner} owner={owner} busy={busy} onResume={key=>execute(undefined,key)} onRefresh={load}/> : null}
    {selected?.role === "driver" ? <AppButton title={showPolicy?"إغلاق إعداد الأجر":"إعداد أجر المهام التالية"} variant="outline" disabled={busy||pending||!reviewReady} onPress={()=>setShowPolicy(!showPolicy)}/>:null}
    {selected?.role === "driver" && showPolicy ? <View style={{ gap: 12 }}>
      <Text style={{ ...Typography.cardTitle, color: colors.text, textAlign: "right" }}>أجر {selected.name}</Text>
      <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>تُثبت سياسة أجر المهمة عند قبولها. تغييرها يخص المهام التالية. النسبة من رسوم التوصيل. تحصيل العملاء منفصل عن الأجر.</Text>
      {[["fixed", "مبلغ لكل مهمة"], ["percentage", "نسبة من رسوم التوصيل"]].map(([key, label]) => <AppButton key={key} title={`${mode === key ? "✓ " : ""}${label}`} variant="outline" disabled={busy || pending || !reviewReady} onPress={() => setMode(key)}/>)}
      <AppTextField label={mode === "percentage" ? "النسبة ٪" : "المبلغ ل.س"} value={value} onChangeText={setValue} keyboardType="decimal-pad" disabled={busy || pending || !reviewReady}/>
      <AppTextField label="سبب الإجراء" value={reason} onChangeText={setReason} disabled={busy || pending || !reviewReady}/>
      <AppButton title="حفظ سياسة الأجر للمهام التالية" disabled={pending||!reviewReady} loading={busy} onPress={() => void execute({ action: "policy", owner: person, mode, value, reason })}/>
      {selected.policy?.mode === "salary" ? <Text style={{...Typography.body,color:colors.infoForeground,textAlign:"right"}}>هذا الحساب لديه سياسة راتب سابقة. الراتب مؤجل عن الإطلاق؛ يمكنك اختيار أجر للمهام التالية واعتماده صراحة.</Text> : null}
    </View> : null}
    {subscriptionSearch && query === "SUB-" ? <FinancialFeedback message="البحث مضبوط على رموز فواتير الاشتراك SUB-. الأرصدة أعلاه تخص حساب متجرك كاملًا. امسح البحث لعرض بقية الفواتير."/> : null}
    <AppTextField label="البحث برمز الفاتورة أو الطلب أو المهمة أو الرقم" value={search} onChangeText={setSearch}/>
    <AppButton title="بحث وتحديث" variant="outline" disabled={busy} onPress={() => { if (page === 0 && query === search) void load(); else { setPage(0); setQuery(search); } }}/>
    <LiveStatus state={live}/>
    <RefreshStatus busy={refreshing}/>
    {!data && (loading || !error) ? <LoadingSkeleton label="جارٍ تحميل الحساب والفواتير"/> : null}
    {partialError?<FinancialFeedback message={partialError} error/>:null}
    {error ? <FinancialFeedback message={`${data?"المعروض آخر بيانات متاحة؛ ":""}${error}`} error/> : null}
    {message ? <FinancialFeedback message={message}/> : null}
    {data?.rows.slice(0,50).map(i=><InvoiceListItem key={i.id} invoice={i} showOwner={data.admin} onPress={()=>router.push({pathname:"/financial-invoice",params:{id:i.id}})}/>)}
    {data && !data.rows.length ? <Text style={{ ...Typography.body, color: colors.text, textAlign: "right" }}>لا توجد فواتير مطابقة.</Text> : null}
    <View style={{ gap: 12 }}><AppButton title="السابق" disabled={page === 0 || busy} variant="outline" onPress={() => setPage(p => p - 1)}/><AppButton title="التالي" disabled={!data || data.rows.length <= 50 || busy} variant="outline" onPress={() => setPage(p => p + 1)}/></View>
  </KeyboardAwareScrollView>;
}

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { setStringAsync } from "expo-clipboard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { useLongWait } from "@/components/ui/LoadingState";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { ControlSizes, MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { difference, invoiceKindLabels, InvoiceUnavailableError, readInvoice, readMerchantMoney, type InvoiceDetail } from "@/lib/invoice-finance";
import { formatSypExact } from "@/lib/money";
import { FinancialFeedback } from "./FinancialParts";
import { InvoiceStatus } from "./InvoiceStatus";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const referencePattern = /^[A-Z]{3}-[0-9]{7,}$/;
const issuedDate = new Intl.DateTimeFormat("ar-SY", { day: "numeric", month: "long", year: "numeric" });
const savedText = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const savedAmount = (value: unknown) => typeof value === "string" && /^\d{1,40}(?:\.\d{1,2})?$/.test(value) ? formatSypExact(value) : undefined;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.section, { borderTopColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{title}</Text>
    {children}
  </View>;
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  const { colors } = useTheme();
  if (!value) return null;
  return <View style={styles.row}>
    <Text style={[styles.body, { color: colors.textSecondary }]}>{label}</Text>
    <Text selectable style={[styles.strong, { color: colors.text }]}>{value}</Text>
  </View>;
}

function ReferenceLink({ label, reference, onPress }: { label: string; reference?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  if (!onPress && !reference) return null;
  const content = <>
    <Text style={[styles.strong, { color: onPress ? colors.primary : colors.textSecondary }]}>{label}</Text>
    {reference && referencePattern.test(reference) ? <View style={styles.reference}><DocumentReference value={reference} /></View> : null}
  </>;
  return onPress ? (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [
      styles.row, styles.link, { backgroundColor: pressed ? colors.surfacePressed : colors.surfaceSecondary },
    ]}>{content}</Pressable>
  ) : <View style={styles.row}>{content}</View>;
}

export function MerchantInvoiceDocument({ invoice, onCopy, onInvoice, onOrder, onReference }: {
  invoice: InvoiceDetail;
  onCopy: (value: string) => void;
  onInvoice: (id: string) => void;
  onOrder: (id: string) => void;
  onReference: (reference: string) => void;
}) {
  const { colors } = useTheme();
  const { details, kind } = invoice;
  const date = new Date(invoice.created_at);
  const original = savedText(details.original_reference);
  const orderId = invoice.store_order_id;
  const orderReference = invoice.references.ORD;
  const confirmed = invoice.status === "confirmed" && !invoice.voided_by;
  const canCopy = referencePattern.test(invoice.reference);
  const items = kind === "SAL" && Array.isArray(details.items) ? details.items : [];
  const duration = details.months;
  const months = typeof duration === "number" && Number.isInteger(duration) && duration > 0
    ? duration.toLocaleString("ar-SY") : undefined;
  const direction = invoice.cashDirection === "in" ? "منك إلى المنصة"
    : invoice.cashDirection === "out" ? "من المنصة إليك" : undefined;

  return <>
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{invoiceKindLabels[kind] ?? invoice.title}</Text>
      <View style={styles.row}>
        <View style={styles.reference}><DocumentReference value={invoice.reference} /></View>
        {canCopy ? <Pressable accessibilityRole="button" onPress={() => onCopy(invoice.reference)}
          style={[styles.link, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.strong, { color: colors.primary }]}>نسخ الرمز</Text>
        </Pressable> : null}
      </View>
      {Number.isFinite(date.getTime()) ? <Text style={[styles.body, { color: colors.textSecondary }]}>تاريخ الإصدار {issuedDate.format(date)}</Text> : null}
      <InvoiceStatus invoice={invoice} />
      <View style={[styles.value, { borderTopColor: colors.border }]}>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{kind === "SET" ? "مبلغ التسوية" : "قيمة المستند"}</Text>
        <Text selectable style={[styles.amount, { color: colors.text }]}>{formatSypExact(invoice.amount)}</Text>
      </View>
    </View>

    {confirmed && invoice.dues.length ? <Section title="ملخص السداد">
      {invoice.dues.map(due => <View key={due.id} style={styles.lines}>
        <Text style={[styles.strong, { color: colors.text }]}>{due.direction === "in" ? "مستحق للمنصة عليك" : "مستحق لك من المنصة"}</Text>
        <DetailRow label={due.direction === "in" ? "ما دفعته" : "ما استلمته"} value={formatSypExact(difference(due.amount, due.remaining))} />
        <DetailRow label="المتبقي" value={formatSypExact(due.remaining)} />
      </View>)}
    </Section> : null}

    {kind === "SAL" ? <Section title="تفاصيل المبيعات">
      <DetailRow label="المتجر" value={savedText(details.store)} />
      <DetailRow label="عمولة المنصة" value={savedAmount(details.commission)} />
      <DetailRow label="مستحق التاجر عند الإصدار" value={savedAmount(details.merchant_net)} />
      {items.map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const line = item as Record<string, unknown>;
        const title = savedText(line.title);
        if (!title) return null;
        return <View key={index} style={[styles.product, { borderTopColor: colors.border }]}>
          <DetailRow label={title} value={savedAmount(line.total)} />
          {!savedAmount(line.total) ? <Text style={[styles.strong, { color: colors.text }]}>{title}</Text> : null}
          <DetailRow label="الكمية" value={savedText(line.quantity)} />
          <DetailRow label="سعر الوحدة" value={savedAmount(line.price)} />
        </View>;
      })}
    </Section> : null}
    {kind === "SUB" && (savedText(details.plan) || months) ? <Section title="تفاصيل الاشتراك">
      <DetailRow label="الخطة" value={savedText(details.plan)} />
      <DetailRow label="المدة بالشهور" value={months} />
    </Section> : null}
    {kind === "SET" ? <Section title="تفاصيل التسوية">
      <DetailRow label="الطرف" value={invoice.owner_name ?? "حساب متجرك"} />
      <DetailRow label="اتجاه الدفع" value={direction} />
      <DetailRow label="السبب" value={savedText(details.reason)} />
    </Section> : null}
    {kind === "COR" ? <Section title="تفاصيل التصحيح">
      {invoice.corrects && confirmed ? <Text style={[styles.body, { color: colors.text }]}>أُلغي الأثر المالي للمستند الأصلي.</Text> : null}
      <DetailRow label="سبب التصحيح" value={savedText(details.reason)} />
    </Section> : null}

    {orderId || orderReference || original || invoice.corrects || invoice.voided_by || invoice.settlements.length ? <Section title="المراجع المرتبطة">
      {orderId ? <ReferenceLink label="فتح طلب المتجر" reference={invoice.references.SOR} onPress={() => onOrder(orderId)} /> : null}
      <ReferenceLink label="مرجع طلب العميل" reference={orderReference} />
      <ReferenceLink label="فتح المستند الأصلي" reference={original}
        onPress={invoice.corrects ? () => onInvoice(invoice.corrects!) : original && referencePattern.test(original) ? () => onReference(original) : undefined} />
      {invoice.voided_by ? <ReferenceLink label="فتح فاتورة التصحيح" onPress={() => onInvoice(invoice.voided_by!)} /> : null}
      {invoice.settlements.map(settlement => <ReferenceLink key={settlement.id}
        label={`${settlement.voided ? "تسوية ملغاة" : "تسوية مرتبطة"} · ${formatSypExact(settlement.amount)}`}
        reference={settlement.reference} onPress={() => onInvoice(settlement.id)} />)}
    </Section> : null}
  </>;
}

export function MerchantInvoiceScreen({ owner, id }: { owner: string; id: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [invoice, setInvoice] = useState<InvoiceDetail>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const active = useRef(false);
  const request = useRef<AbortController | null>(null);
  const lookup = useRef<AbortController | null>(null);
  const valid = uuid.test(id);
  const delayed = useLongWait(loading);

  const load = useCallback(async () => {
    if (!active.current || !valid) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const value = await readInvoice(id, controller.signal);
      if (controller.signal.aborted || !active.current) return;
      if (value.owner_id !== owner || value.id.toLowerCase() !== id.toLowerCase() || value.admin) {
        throw new InvoiceUnavailableError();
      }
      setInvoice(value);
      setError("");
    } catch (cause) {
      if (controller.signal.aborted || !active.current) return;
      if (cause instanceof InvoiceUnavailableError) {
        setInvoice(undefined);
        setError(cause.message);
      } else {
        setError("تعذر تحميل الفاتورة. تحقق من الاتصال وأعد المحاولة.");
      }
    } finally {
      if (active.current && !controller.signal.aborted) setLoading(false);
    }
  }, [id, owner, valid]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
      request.current?.abort();
      lookup.current?.abort();
    };
  }, [load]));
  useOrderRealtime({
    channelName: `merchant-invoice:${owner}:${id}`,
    enabled: valid,
    subscriptions: [
      { table: "money_invoices", filter: `owner_id=eq.${owner}` },
      { table: "money_allocations" },
    ],
    onChange: load,
  });

  const back = () => router.canGoBack() ? router.back() : router.replace("/merchant/finance");
  const openInvoice = (next: string) => router.push({ pathname: "/financial-invoice", params: { id: next } });
  const openReference = async (reference: string) => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    try {
      const { overview } = await readMerchantMoney(reference, "ALL", undefined, controller.signal);
      if (controller.signal.aborted || !active.current) return;
      const match = overview.rows.find(row => row.reference === reference && row.owner_id === owner);
      if (overview.owner !== owner || overview.admin || !match) throw new InvoiceUnavailableError();
      openInvoice(match.id);
    } catch {
      if (!controller.signal.aborted && active.current) toast.show({ message: "تعذر فتح المستند المرتبط. تحقق من الاتصال ثم أعد المحاولة.", tone: "error" });
    }
  };
  const copy = async (value: string) => {
    try {
      if (!await setStringAsync(value)) throw Error("clipboard write failed");
      if (active.current) toast.show({ message: "تم نسخ رمز الفاتورة.", tone: "success" });
    } catch {
      if (active.current) toast.show({ message: "تعذر نسخ الرمز. يمكنك تحديده ونسخه يدويًا.", tone: "error" });
    }
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="تفاصيل الفاتورة" showBack onBack={back} showNotifications={false} />
    <ScrollView contentContainerStyle={styles.content}>
      {!valid ? <FinancialFeedback error message="رابط الفاتورة غير صالح. افتح الفاتورة من قائمة المالية." /> : null}
      {valid && error ? <FinancialFeedback error message={invoice ? `آخر بيانات متاحة. ${error}` : error} /> : null}
      {valid && loading && !invoice && !error ? <View style={styles.wait}>
        {!delayed ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={[styles.body, { color: colors.textSecondary }]}>{delayed ? "التحميل يستغرق وقتًا أطول." : "جارٍ تحميل الفاتورة…"}</Text>
      </View> : null}
      {invoice ? <MerchantInvoiceDocument invoice={invoice} onCopy={value => void copy(value)}
        onInvoice={openInvoice} onReference={reference => void openReference(reference)}
        onOrder={storeOrderId => router.push({ pathname: "/merchant/orders", params: { storeOrderId } })} /> : null}
      {valid && error ? <AppButton title="إعادة المحاولة" variant="outline" disabled={loading} onPress={() => void load()} /> : null}
      <AppButton title="قائمة المالية" variant="outline" onPress={() => router.replace("/merchant/finance")} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.four, gap: Spacing.four },
  hero: { padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md, gap: Spacing.two },
  heading: { ...Typography.sectionTitle, textAlign: "right" },
  body: { ...Typography.body, textAlign: "right", flexShrink: 1 },
  strong: { ...Typography.bodyStrong, textAlign: "right", flexShrink: 1 },
  amount: { ...Typography.pageTitle, textAlign: "right" },
  row: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  reference: { flexShrink: 1, maxWidth: "100%" },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, gap: Spacing.two },
  product: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one },
  value: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one },
  lines: { gap: Spacing.one },
  link: { minHeight: ControlSizes.touch, minWidth: ControlSizes.touch, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, justifyContent: "center", borderRadius: Radius.sm },
  wait: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.four },
});

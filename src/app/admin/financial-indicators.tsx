import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import {
  loadFinancialIndicators,
  type FinancialIndicatorCurrency,
  type FinancialIndicators,
} from "@/lib/admin-finance";

const cacheTtlMs = 15_000;
let indicatorsCache: { data: FinancialIndicators; updatedAt: number } | null = null;

const currencyLabel = (currency: string) => currency === "USD" ? "دولار" : "ل.س";
const amount = (value: number, currency: string) =>
  `${Number(value).toLocaleString("ar-SY", { maximumFractionDigits: 2 })} ${currencyLabel(currency)}`;

type IndicatorRow = { label: string; value: number | string };

export default function FinancialIndicatorsScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<FinancialIndicators | null>(() => indicatorsCache?.data ?? null);
  const [loading, setLoading] = useState(() => !indicatorsCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const firstFocus = useRef(true);

  const refresh = useCallback(async (manual = false) => {
    if (indicatorsCache) setData(indicatorsCache.data);
    if (!manual && indicatorsCache && Date.now() - indicatorsCache.updatedAt < cacheTtlMs) {
      setLoading(false);
      return;
    }
    if (indicatorsCache) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const next = await loadFinancialIndicators();
      indicatorsCache = { data: next, updatedAt: Date.now() };
      setData(next);
    } catch {
      setError("تعذّر تحميل المؤشرات المالية. احتفظنا بالبيانات السابقة إن كانت متاحة.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    void refresh();
  }, [refresh]));

  if (loading && !data) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={styles.head}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>كل عملة تُعرض مستقلة. المبالغ المسجلة لا تعني تحصيلًا مؤكدًا.</Text>
        {refreshing ? <Text style={[styles.refresh, { color: colors.textSecondary }]}>يتم التحديث في الخلفية…</Text> : null}
      </View>
      {error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.meta, { color: colors.error }]}>{error}</Text>
        <AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} />
      </View> : null}
      {data ? <>
        <Section title="نظرة عامة حسب العملة"><CurrencyOverview currencies={data.currencies} /></Section>
        <Section title="الفواتير"><InvoiceIndicators currencies={data.currencies} /></Section>
        <Section title="العمولات"><CommissionIndicators currencies={data.currencies} /></Section>
        <Section title="المدفوعات"><PaymentIndicators currencies={data.currencies} /></Section>
        <Section title="الاشتراكات"><SubscriptionIndicators values={data.subscriptions} /></Section>
      </> : null}
    </ScrollView>
  </View>;
}

function CurrencyOverview({ currencies }: { currencies: FinancialIndicatorCurrency[] }) {
  const { colors } = useTheme();
  if (!currencies.length) return <Empty text="لا تتوفر سجلات مالية كافية لعرض مؤشرات موثوقة بعد." />;
  return <View style={styles.list}>{currencies.map((currency) => <View key={currency.currency} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
    <View style={styles.cardHead}><Text style={[styles.cardTitle, { color: colors.text }]}>{currencyLabel(currency.currency)}</Text><AppIcon name="wallet-outline" size={20} color={colors.primary} /></View>
    <Metrics rows={[
      { label: "المستحق من الفواتير", value: amount(currency.invoiceOutstanding, currency.currency) },
      { label: "العمولات المستحقة", value: amount(currency.commissionsDue, currency.currency) },
      { label: "التعرض المالي الفعلي", value: amount(currency.effectiveExposure, currency.currency) },
      { label: "المدفوعات المسجلة", value: amount(currency.paymentsRecorded, currency.currency) },
      { label: "فواتير مفتوحة أو جزئية", value: currency.openInvoiceCount },
    ]} />
  </View>)}</View>;
}

function InvoiceIndicators({ currencies }: { currencies: FinancialIndicatorCurrency[] }) {
  if (!currencies.length) return <Empty text="لا توجد فواتير لعرضها." />;
  return <View style={styles.list}>{currencies.map((currency) => <IndicatorCard key={currency.currency} title={currencyLabel(currency.currency)} rows={[
    { label: "إجمالي الفواتير", value: currency.invoiceCount },
    { label: "مفتوحة أو جزئية", value: currency.openInvoiceCount },
    { label: "مسددة جزئيًا", value: currency.partiallyPaidInvoiceCount },
    { label: "مسددة بالكامل", value: currency.paidInvoiceCount },
    { label: "المبلغ المتبقي", value: amount(currency.invoiceOutstanding, currency.currency) },
  ]} />)}</View>;
}

function CommissionIndicators({ currencies }: { currencies: FinancialIndicatorCurrency[] }) {
  if (!currencies.length) return <Empty text="لا توجد عمولات لعرضها." />;
  return <View style={styles.list}>{currencies.map((currency) => <IndicatorCard key={currency.currency} title={currencyLabel(currency.currency)} rows={[
    { label: "العمولات المستحقة", value: amount(currency.commissionsDue, currency.currency) },
    { label: "سجلات عمولات مستحقة", value: currency.dueCommissionCount },
  ]} />)}</View>;
}

function PaymentIndicators({ currencies }: { currencies: FinancialIndicatorCurrency[] }) {
  if (!currencies.length) return <Empty text="لا توجد مدفوعات مسجلة لعرضها." />;
  return <View style={styles.list}>{currencies.map((currency) => <IndicatorCard key={currency.currency} title={currencyLabel(currency.currency)} rows={[
    { label: "مدفوعات مسجلة", value: amount(currency.paymentsRecorded, currency.currency) },
  ]} />)}</View>;
}

function SubscriptionIndicators({ values }: { values: FinancialIndicators["subscriptions"] }) {
  const { colors } = useTheme();
  const items: IndicatorRow[] = [
    { label: "نشطة", value: values.active },
    { label: "تنتهي خلال 7 أيام", value: values.expiringWithinSevenDays },
    { label: "ضمن فترة السماح", value: values.gracePeriod },
    { label: "منتهية بعد السماح", value: values.expired },
  ];
  return <View style={styles.grid}>{items.map((item) => <View key={item.label} style={[styles.tile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
    <Text style={[styles.tileValue, { color: colors.text }]}>{item.value}</Text>
    <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>{item.label}</Text>
  </View>)}</View>;
}

function IndicatorCard({ title, rows }: { title: string; rows: IndicatorRow[] }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text><Metrics rows={rows} /></View>;
}

function Metrics({ rows }: { rows: IndicatorRow[] }) {
  const { colors } = useTheme();
  return <View style={styles.metricList}>{rows.map((row) => <View key={row.label} style={styles.metric}>
    <Text style={[styles.meta, { color: colors.textSecondary }]}>{row.label}</Text>
    <Text style={[styles.value, { color: colors.text }]}>{row.value}</Text>
  </View>)}</View>;
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.meta, { color: colors.textSecondary }]}>{text}</Text>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.text }]}>{title}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, justifyContent: "center" },
  content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three },
  head: { gap: Spacing.one }, description: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, refresh: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  error: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two }, section: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.three },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, list: { gap: Spacing.two }, card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, cardTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  metricList: { gap: Spacing.two }, metric: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: Spacing.two }, meta: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 },
  value: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "left" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }, tile: { width: "48%", minHeight: 86, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, justifyContent: "space-between", gap: Spacing.one },
  tileValue: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" }, tileLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 18 },
});

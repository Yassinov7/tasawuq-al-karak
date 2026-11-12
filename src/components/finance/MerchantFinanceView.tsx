import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { useLongWait } from "@/components/ui/LoadingState";
import {
  ControlSizes,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import {
  difference,
  invoiceKindLabels,
  type MerchantInvoiceKind,
  type MoneyInvoice,
  type MoneyOverview,
} from "@/lib/invoice-finance";
import type { LiveState } from "@/lib/live-updates";
import { formatSypExact } from "@/lib/money";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FinancialFeedback } from "./FinancialParts";
import { InvoiceStatus } from "./InvoiceStatus";

export type MerchantFinanceViewProps<Kind extends string = MerchantInvoiceKind> = {
  account: MoneyOverview | null;
  data: MoneyOverview | null;
  search: string;
  query: string;
  page: number;
  kind: Kind;
  hasNext: boolean;
  busy: boolean;
  refreshing: boolean;
  live: LiveState;
  error: string;
  partialError: string;
  message: string;
  onChangeSearch: (value: string) => void;
  onSearch: (value: string) => void;
  onRefresh: () => Promise<void>;
  onPage: (page: number) => void;
  onKind: (kind: Kind) => void;
  onInvoice: (id: string) => void;
  pendingReview: ReactNode;
};

const invoiceFilters: { kind: MerchantInvoiceKind; label: string }[] = [
  { kind: "ALL", label: "الكل" },
  { kind: "SAL", label: "المبيعات" },
  { kind: "SET", label: "التسويات" },
  { kind: "SUB", label: "الاشتراك" },
  { kind: "COR", label: "التصحيحات" },
];

function InvoiceFilters<Kind extends string>({
  kind,
  busy,
  onKind,
  filters,
}: Pick<MerchantFinanceViewProps<Kind>, "kind" | "busy" | "onKind"> & { filters: readonly { kind: Kind; label: string }[] }) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const content = useRef(0);
  const chips = useRef<
    Partial<Record<Kind, { x: number; width: number }>>
  >({});

  const revealSelected = useCallback(() => {
    const chip = chips.current[kind];
    if (!chip || !viewport.current || !content.current) return;
    const centered = chip.x + (chip.width - viewport.current) / 2;
    const x = Math.max(
      0,
      Math.min(centered, content.current - viewport.current),
    );
    scroll.current?.scrollTo({ x, animated: false });
  }, [kind]);

  useEffect(revealSelected, [revealSelected]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      keyboardShouldPersistTaps="handled"
      style={styles.filterScroll}
      contentContainerStyle={styles.filters}
      onLayout={({ nativeEvent }) => {
        viewport.current = nativeEvent.layout.width;
        revealSelected();
      }}
      onContentSizeChange={(width) => {
        content.current = width;
        revealSelected();
      }}
    >
      {filters.map((item) => {
        const selected = kind === item.kind;
        return (
          <Pressable
            key={item.kind}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected, disabled: busy }}
            disabled={busy}
            onLayout={({ nativeEvent }) => {
              const { x, width } = nativeEvent.layout;
              chips.current[item.kind] = { x, width };
              if (selected) revealSelected();
            }}
            onPress={() => {
              Keyboard.dismiss();
              onKind(item.kind);
            }}
            style={({ pressed }) => [
              styles.filter,
              {
                borderColor: selected ? colors.primary : colors.borderStrong,
                backgroundColor: pressed
                  ? colors.surfacePressed
                  : selected
                    ? colors.surfaceSelected
                    : colors.surface,
              },
            ]}
          >
            <Text style={[styles.caption, { color: colors.text }]}>
              {selected ? `✓ ${item.label}` : item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PageButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.pageSide}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={styles.pageTouch}
      >
        {({ pressed }) => (
          <Text
            style={[
              styles.pageLabel,
              {
                color: disabled ? colors.textSecondary : colors.primary,
                backgroundColor: pressed
                  ? colors.surfacePressed
                  : colors.surfaceSecondary,
              },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const dateFormat = new Intl.DateTimeFormat("ar-SY", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function InvoiceRow({
  invoice,
  onOpen,
}: {
  invoice: MoneyInvoice;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const title = invoiceKindLabels[invoice.kind] ?? invoice.title;
  const amount = formatSypExact(invoice.amount);
  const created = new Date(invoice.created_at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="يفتح تفاصيل المستند"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.invoice,
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.line}>
        <Text style={[styles.strong, { color: colors.text, flexShrink: 1 }]}>
          {title}
        </Text>
        <DocumentReference value={invoice.reference} />
      </View>
      <View style={styles.line}>
        <Text style={[styles.amount, { color: colors.text }]}>{amount}</Text>
        {Number.isFinite(created.getTime()) ? (
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            {dateFormat.format(created)}
          </Text>
        ) : null}
      </View>
      <InvoiceStatus invoice={invoice} />
    </Pressable>
  );
}

function AccountBalance({ account, driver, title }: { account: MoneyOverview; driver: boolean; title: string }) {
  const { colors } = useTheme();
  const net = driver ? null : difference(account.payable, account.receivable);
  const balanceLines = driver ? [
    { label: "النقد الواجب توريده للمنصة", amount: account.collection_due },
    { label: "مستحقات السائق من الأجور", amount: account.payable },
  ] : [
    { label: "مستحق لك من المنصة", amount: account.payable },
    { label: "مطلوب منك دفعه للمنصة", amount: account.receivable },
  ];
  return (
    <View
      style={[
        styles.balance,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.line}>
        <Text style={[styles.heading, { color: colors.text }]}>
          {title}
        </Text>
        {account.account_reference ? (
          <DocumentReference value={account.account_reference} />
        ) : null}
      </View>
      <View style={styles.line}>
        {balanceLines.map((item) => (
          <View
            key={item.label}
            style={[
              styles.balanceCell,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Text style={[styles.caption, { color: colors.text }]}>
              {item.label}
            </Text>
            <Text selectable style={[styles.metric, { color: colors.text }]}>
              {formatSypExact(item.amount)}
            </Text>
          </View>
        ))}
      </View>
      {net !== null ? <View style={styles.line}>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {/^0(?:\.0+)?$/.test(net) ? "صافي الرصيد" : net.startsWith("-") ? "صافي الرصيد عليك" : "صافي الرصيد لك"}
        </Text>
        <Text selectable style={[styles.strong, { color: colors.text }]}>
          {formatSypExact(net.replace(/^-/, ""))}
        </Text>
      </View> : null}
    </View>
  );
}

export function MerchantFinanceView(props: MerchantFinanceViewProps) {
  return <FinanceAccountView {...props} role="merchant" filters={invoiceFilters} />;
}

export function FinanceAccountView<Kind extends string>({
  account,
  data,
  search,
  query,
  page,
  kind,
  hasNext,
  busy,
  refreshing,
  live,
  error,
  partialError,
  message,
  onChangeSearch,
  onSearch,
  onRefresh,
  onPage,
  onKind,
  onInvoice,
  pendingReview,
  role,
  filters,
}: MerchantFinanceViewProps<Kind> & { role: "merchant" | "driver"; filters: readonly { kind: Kind; label: string }[] }) {
  const { colors } = useTheme();
  const waiting = refreshing || (!data && !error);
  const delayed = useLongWait(waiting);
  const driver = role === "driver";
  const title = driver ? "الحساب المالي" : "رصيد المتجر";
  const subscriptionDue =
    !driver && account && !/^0(?:\.0{1,2})?$/.test(account.subscription_due);
  const connection =
    live === "live"
      ? "التحديث المباشر متصل"
      : "التحديث المباشر غير متاح حاليًا";
  const refreshLabel = delayed
    ? "القراءة تستغرق وقتًا أطول"
    : refreshing
      ? "جارٍ تحديث الحساب"
      : "تحديث الحساب";
  const rows = data?.rows ?? [];

  const searchFor = (value: string) => {
    Keyboard.dismiss();
    onSearch(value.trim());
  };
  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.content}>
      {account?.account_reference ? (
        <AccountBalance account={account} driver={driver} title={title} />
      ) : (
        <View
          style={[
            styles.accountPlaceholder,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.heading, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            {account
              ? driver ? "لا يوجد حساب مالي مرتبط بك بعد." : "لا يوجد حساب مالي مرتبط بمتجرك بعد."
              : error
                ? "تعذر عرض الرصيد."
                : "جارٍ تحميل الرصيد…"}
          </Text>
        </View>
      )}
      {subscriptionDue ? (
        <View
          style={[
            styles.subscription,
            { backgroundColor: colors.warningSurface },
          ]}
        >
          <View style={styles.line}>
            <Text style={[styles.strong, { color: colors.warningForeground }]}>
              متبقي على الاشتراك
            </Text>
            <Text style={[styles.strong, { color: colors.warningForeground }]}>
              {formatSypExact(account.subscription_due)}
            </Text>
          </View>
          <Text style={[styles.caption, { color: colors.warningForeground }]}>
            تبدأ فترة الاشتراك بعد سداد الفاتورة كاملة.
          </Text>
        </View>
      ) : null}
      {partialError ? <FinancialFeedback message={partialError} error /> : null}
      {error ? (
        <FinancialFeedback
          message={account ? `آخر رصيد متاح. ${error}` : error}
          error
        />
      ) : null}
      {message ? <FinancialFeedback message={message} /> : null}
      {pendingReview}

      <View style={styles.documents}>
        <View style={styles.line}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: colors.text }]}
          >
            الفواتير والمستندات
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${refreshLabel}. ${connection}`}
            accessibilityState={{
              busy: refreshing,
              disabled: busy || (refreshing && !delayed),
            }}
            disabled={busy || (refreshing && !delayed)}
            onPress={() => void onRefresh()}
            style={styles.iconControl}
          >
            {refreshing && !delayed ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <AppIcon
                name={
                  delayed
                    ? "time-outline"
                    : live === "disconnected"
                      ? "cloud-offline-outline"
                      : "refresh-outline"
                }
                size={20}
                color={colors.primary}
              />
            )}
          </Pressable>
        </View>
        <View style={styles.searchLine}>
          <View style={styles.searchField}>
            <AppTextField
              label="رمز الفاتورة أو الطلب أو المهمة"
              value={search}
              onChangeText={onChangeSearch}
              onSubmitEditing={() => {
                if (!busy) searchFor(search);
              }}
              returnKeyType="search"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="بحث في المستندات"
            disabled={busy}
            onPress={() => searchFor(search)}
            style={styles.iconControl}
          >
            <AppIcon name="search-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>
        {search || query ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => searchFor("")}
            style={styles.clearSearch}
          >
            <Text style={[styles.caption, { color: colors.primary }]}>
              مسح البحث
            </Text>
          </Pressable>
        ) : null}
        <InvoiceFilters filters={filters} kind={kind} busy={busy} onKind={onKind} />

        {rows.length ? (
          <View style={[styles.invoiceList, { borderColor: colors.border }]}>
            {rows.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                onOpen={() => onInvoice(invoice.id)}
              />
            ))}
          </View>
        ) : null}
        {!data && !error ? (
          <View style={styles.empty}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              {delayed
                ? "التحميل يستغرق وقتًا أطول. يمكنك إعادة المحاولة."
                : "جارٍ تحميل المستندات…"}
            </Text>
          </View>
        ) : null}
        {data && !rows.length ? (
          <View style={styles.empty}>
            <Text style={[styles.strong, { color: colors.text }]}>
              {query || kind !== "ALL"
                ? "لا توجد مستندات مطابقة"
                : "لا توجد مستندات في هذه الصفحة"}
            </Text>
          </View>
        ) : null}
        <View style={styles.pagination}>
          <PageButton
            label="السابق"
            disabled={page === 0 || busy || (!data && !error)}
            onPress={() => onPage(page - 1)}
          />
          <Text style={[styles.pageNumber, { color: colors.textSecondary }]}>
            صفحة {(page + 1).toLocaleString("ar-SY")}
          </Text>
          <PageButton
            label="التالي"
            disabled={!hasNext || busy}
            onPress={() => onPage(page + 1)}
          />
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    padding: Spacing.four,
    gap: Spacing.four,
  },
  line: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  balance: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  accountPlaceholder: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  balanceCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 125,
    minWidth: 0,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  metric: { ...Typography.sectionTitle, textAlign: "right" },
  caption: { ...Typography.caption, textAlign: "right" },
  heading: { ...Typography.sectionTitle, textAlign: "right", flexShrink: 1 },
  strong: { ...Typography.bodyStrong, textAlign: "right" },
  amount: { ...Typography.bodyStrong, textAlign: "right" },
  subscription: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  documents: { gap: Spacing.two },
  searchLine: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: Spacing.two,
  },
  searchField: { flex: 1, minWidth: 0 },
  iconControl: {
    minWidth: ControlSizes.touch,
    minHeight: ControlSizes.touch,
    alignItems: "center",
    justifyContent: "center",
  },
  // Measure and scroll in physical coordinates while ordering the Arabic controls from the right.
  filterScroll: { direction: "ltr", flexGrow: 0 },
  filters: {
    direction: "ltr",
    flexGrow: 1,
    flexDirection: "row-reverse",
    flexWrap: "nowrap",
    gap: Spacing.two,
  },
  filter: {
    flexShrink: 0,
    minWidth: ControlSizes.touch,
    minHeight: ControlSizes.touch,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    justifyContent: "center",
  },
  pagination: {
    direction: "ltr",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
  },
  pageSide: { flex: 1, minWidth: ControlSizes.touch, alignItems: "center" },
  pageTouch: {
    minWidth: ControlSizes.touch,
    minHeight: ControlSizes.touch,
    maxWidth: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  pageLabel: {
    ...Typography.label,
    textAlign: "center",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pageNumber: { ...Typography.caption, textAlign: "center", flexShrink: 1 },
  clearSearch: {
    minHeight: ControlSizes.touch,
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  invoiceList: { borderWidth: 1, borderRadius: Radius.md, overflow: "hidden" },
  invoice: {
    minHeight: ControlSizes.touch,
    padding: Spacing.three,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
});

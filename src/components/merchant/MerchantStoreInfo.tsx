import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { MerchantStoreBranding } from "@/components/merchant/MerchantStoreBranding";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useMerchantLoad } from "@/hooks/useMerchantLoad";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { useAccountDraftGuard } from "@/hooks/useAccountDraftGuard";
import { loadMerchantStoreInfo, saveMerchantStoreInfo, validateMerchantStoreInfo, type StoreInfoDraft } from "@/lib/merchant-account";
import type { MerchantStore } from "@/lib/merchant-store";

export function MerchantStoreInfo() {
  const { user } = useAuth();
  return user ? <OwnedStoreInfo key={user.id} owner={user.id} /> : null;
}

function OwnedStoreInfo({ owner }: { owner: string }) {
  const { colors } = useTheme();
  const loader = useCallback(() => loadMerchantStoreInfo(owner), [owner]);
  const { data, loading, error, load } = useMerchantLoad(loader);
  const store = data?.store;
  useOrderRealtime({
    channelName: `merchant-store-info:${owner}:${store?.id ?? "pending"}`,
    enabled: Boolean(store),
    subscriptions: store ? [{ table: "stores", filter: `id=eq.${store.id}` }, { table: "catalog_category_revision" }] : [],
    onChange: load,
  });
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <KeyboardAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.status}>
        {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="جارٍ تحميل بيانات المتجر" /> : null}
        {error ? <View style={styles.stack}>
          <Text accessibilityRole="alert" style={[styles.body, { color: colors.errorForeground }]}>{data ? "تعذر التحديث. تظهر آخر بيانات أمكن تحميلها." : "تعذر تحميل بيانات المتجر."}</Text>
          <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" disabled={loading} onPress={() => void load()} />
        </View> : null}
      </View>
      {store ? <MerchantStoreBranding key={store.id} owner={owner} store={store.id}
        renderDetails={(logo, mediaDirty, mediaBusy) => <StoreForm owner={owner} store={store}
          category={data?.categoryName ?? "غير محدد"} logo={logo} mediaDirty={mediaDirty} mediaBusy={mediaBusy} onSaved={load} />} /> : data && !loading ? <Text style={[styles.body, { color: colors.textSecondary }]}>لا يوجد متجر مرتبط بحسابك. تواصل مع الإدارة.</Text> : null}
    </KeyboardAwareScrollView>
  </View>;
}

const fields = [
  ["name", "اسم المتجر", 120],
  ["description", "وصف المتجر (اختياري)", 5000],
  ["phone", "هاتف المتجر", 32],
  ["address", "عنوان المتجر", 300],
] as const;

function valuesOf({ name, phone, address, description }: MerchantStore): StoreInfoDraft {
  return { name, phone, address, description };
}

function StoreForm({ owner, store, category, logo, mediaDirty, mediaBusy, onSaved }: { owner: string; store: MerchantStore; category: string; logo: ReactNode; mediaDirty: boolean; mediaBusy: boolean; onSaved: () => Promise<void> }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [edited, setEdited] = useState<StoreInfoDraft | null>(null);
  const [confirmed, setConfirmed] = useState<{ source: MerchantStore; row: MerchantStore } | null>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<ReturnType<typeof validateMerchantStoreInfo>["errors"]>({});
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = confirmed?.source === store ? confirmed.row : store;
  const base = valuesOf(current);
  const draft = edited ?? base;
  const dirty = fields.some(([field]) => draft[field] !== base[field]);
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/merchant/account");
  }, [router]);
  const isLocked = useCallback(() => lock.current, []);
  const guard = useAccountDraftGuard(dirty || mediaDirty, busy || mediaBusy, leave, isLocked);
  const save = async () => {
    if (lock.current || !dirty) return;
    const { values, errors } = validateMerchantStoreInfo(draft);
    setIssues(errors);
    setMessage(null);
    if (Object.keys(errors).length) {
      setMessage({ text: "راجع الحقول المشار إليها قبل الحفظ.", error: true });
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const row = await saveMerchantStoreInfo(owner, store.id, values);
      if (alive.current) {
        setConfirmed({ source: store, row });
        setEdited(null);
        setMessage({ text: "تم حفظ بيانات المتجر.", error: false });
        void onSaved();
      }
    } catch (failure) {
      if (alive.current) setMessage({ text: failure instanceof Error ? failure.message : "تعذر حفظ بيانات المتجر.", error: true });
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const approved = store.status === "accepted";
  const status = approved ? "معتمد" : store.status === "pending" ? "قيد المراجعة" : "غير معتمد";
  return <>
    <View style={[styles.summary, { backgroundColor: colors.surfaceSecondary }]}>
      {logo}
      <View style={styles.identity}>
        <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{current.name}</Text>
        <View style={styles.row}>
          <Text style={[styles.badge, { color: approved ? colors.successForeground : colors.warningForeground, backgroundColor: approved ? colors.successSurface : colors.warningSurface }]}>{status}</Text>
          <Text style={[styles.category, { color: colors.textSecondary }]}>{category}</Text>
        </View>
        {current.phone ? <Text accessibilityLabel={`هاتف المتجر ${current.phone}`} style={[styles.body, styles.phone, { color: colors.textSecondary }]}>{current.phone}</Text> : null}
      </View>
    </View>
    {[{ title: "الاسم والوصف", fields: fields.slice(0, 2) }, { title: "التواصل والموقع", fields: fields.slice(2) }].map(group =>
      <View key={group.title} style={[styles.section, { borderColor: colors.borderSubtle }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{group.title}</Text>
        {group.fields.map(([key, label, maxLength]) => <AppTextField key={key} label={label} maxLength={maxLength}
          multiline={key === "description" || key === "address"} keyboardType={key === "phone" ? "phone-pad" : "default"}
          disabled={busy} value={draft[key]} error={issues[key]} onChangeText={value => {
            setEdited({ ...draft, [key]: value });
            setIssues(previous => ({ ...previous, [key]: undefined }));
            setMessage(null);
          }} />)}
      </View>)}
    <View style={styles.stack}>
      {message ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: message.error ? colors.errorForeground : colors.successForeground }]}>{message.text}</Text> : null}
      <View style={styles.row}><AppButton compact fullWidth={false} title="حفظ بيانات المتجر" icon="checkmark-outline"
        loading={busy} disabled={!dirty} onPress={() => void save()} /></View>
    </View>
    {guard.modal}
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },
  status: { minHeight: Spacing.four },
  stack: { gap: Spacing.one },
  summary: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  identity: { flex: 1, minWidth: 0, gap: Spacing.one },
  category: { ...Typography.caption, flexShrink: 1, textAlign: "right" },
  phone: { writingDirection: "ltr" },
  section: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  row: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  name: { ...Typography.cardTitle, flexGrow: 1, flexShrink: 1, textAlign: "right" },
  heading: { ...Typography.cardTitle, textAlign: "right" },
  body: { ...Typography.body, textAlign: "right" },
  badge: { ...Typography.caption, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.sm },
});

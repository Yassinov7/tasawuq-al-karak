import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import type { HomeAd } from "@/lib/customer-home-ads";
import { readHomeAdTargets, type HomeAdTarget } from "@/lib/home-ad-targets";

type Kind = HomeAd["target_kind"];
const labels = { store: "المتجر", product: "المنتج", offer: "العرض" };
const noResults: HomeAdTarget[] = [];

export function HomeAdTargetPicker({ owner, kind, targetId, disabled, onChange }: {
  owner: string;
  kind: Kind;
  targetId: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [selection, setSelection] = useState<{ store?: HomeAdTarget; target?: HomeAdTarget }>({});
  const [resolved, setResolved] = useState<{ id: string; missing?: boolean; error?: boolean }>();
  const [retry, setRetry] = useState(0);
  const { store, target } = selection;

  useEffect(() => {
    if (!targetId || target?.id === targetId) return;
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      const [saved] = await readHomeAdTargets(owner, kind, { id: targetId }, signal);
      const [parent] = saved && kind !== "store"
        ? await readHomeAdTargets(owner, "store", { id: saved.storeId }, signal)
        : [saved];
      if (signal.aborted) return;
      setSelection({ store: parent, target: saved });
      setResolved({ id: targetId, missing: !saved || !parent });
    })().catch(() => { if (!signal.aborted) setResolved({ id: targetId, error: true }); });
    return () => controller.abort();
  }, [owner, kind, targetId, target?.id, retry]);

  const text = { ...Typography.body, color: colors.text, textAlign: "right" as const };
  const current = resolved?.id === targetId ? resolved : undefined;
  const resolving = Boolean(targetId && target?.id !== targetId && !current);
  if (resolving) return <Text style={text}>جارٍ تحميل الوجهة المحفوظة…</Text>;
  return <View style={styles.group}>
    {current?.error ? <AppButton title="إعادة تحميل الوجهة المحفوظة" variant="outline" disabled={disabled}
      onPress={() => { setResolved(undefined); setRetry(value => value + 1); }} /> : null}
    {current?.missing || target?.unavailable || store?.unavailable ? <Text style={{ ...text, color: colors.errorForeground }}>
      الوجهة المحفوظة غير متاحة حاليًا. يمكنك اختيار وجهة أخرى.
    </Text> : null}
    <TargetSearch owner={owner} kind="store" selected={store} disabled={disabled} onSelect={next => {
      setResolved(undefined);
      setSelection({ store: next, target: kind === "store" ? next : undefined });
      onChange(kind === "store" ? next.id : "");
    }} />
    {kind !== "store" && store ? <TargetSearch key={store.id} owner={owner} kind={kind} storeId={store.id} selected={target}
      disabled={disabled} onSelect={next => {
        setResolved(undefined);
        setSelection({ store, target: next });
        onChange(next.id);
      }} /> : null}
  </View>;
}

function TargetSearch({ owner, kind, storeId, selected, disabled, onSelect }: {
  owner: string; kind: Kind; storeId?: string; selected?: HomeAdTarget; disabled: boolean;
  onSelect: (item: HomeAdTarget) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(!selected);
  const [search, setSearch] = useState("");
  const [request, setRequest] = useState({ search: "" });
  const [result, setResult] = useState<{ request: typeof request; rows?: HomeAdTarget[] }>();
  const shown = result?.request === request ? result : undefined;
  const rows = shown?.rows ?? noResults;
  const { logos } = useCustomerStoreLogos(kind === "store" ? [...rows.map(row => row.id), ...(selected ? [selected.id] : [])] : []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const { signal } = controller;
    void readHomeAdTargets(owner, kind, { storeId, search: request.search }, signal)
      .then(rows => { if (!signal.aborted) setResult({ request, rows }); })
      .catch(() => { if (!signal.aborted) setResult({ request }); });
    return () => controller.abort();
  }, [owner, kind, storeId, request, open]);

  const text = { ...Typography.body, color: colors.text, textAlign: "right" as const };
  const itemView = (item: HomeAdTarget) => {
    const logo = logos.get(item.id);
    return <>
      <View style={[styles.thumbnail, { backgroundColor: colors.surfaceSecondary }]}>
        <ShoppingCardImage uri={logo?.url ?? item.image} cacheKey={logo?.key ?? (item.image ? JSON.stringify([owner, item.image]) : undefined)} restricted
          icon={kind === "store" ? "storefront-outline" : kind === "offer" ? "pricetag-outline" : "cube-outline"} />
      </View>
      <Text style={[text, styles.name]}>{item.name}</Text>
    </>;
  };

  return <View style={styles.group}>
    {selected ? <View style={[styles.option, { backgroundColor: colors.surfaceSecondary }]}>{itemView(selected)}</View> : null}
    {!open ? <AppButton title={"تغيير " + labels[kind]} variant="outline" disabled={disabled} onPress={() => setOpen(true)} /> : <>
      <AppTextField label={"ابحث باسم " + labels[kind]} value={search} onChangeText={setSearch} disabled={disabled}
        maxLength={100} onSubmitEditing={() => setRequest({ search })} />
      <AppButton title="بحث" variant="outline" disabled={disabled} onPress={() => setRequest({ search })} />
      {!shown ? <Text style={text} accessibilityRole="progressbar">جارٍ تحميل النتائج…</Text> : null}
      {shown && !shown.rows ? <Text style={text}>تعذر تحميل النتائج. اضغط بحث لإعادة المحاولة.</Text> : null}
      {shown?.rows?.length === 0 ? <Text style={text}>لا توجد نتائج مطابقة.</Text> : null}
      {rows.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={"اختيار " + item.name}
        disabled={disabled} onPress={() => { onSelect(item); setOpen(false); }}
        style={({ pressed }) => [styles.option, { backgroundColor: pressed ? colors.surfacePressed : colors.surfaceSecondary }]}>
        {itemView(item)}
      </Pressable>)}
      {rows.length === 20 ? <Text style={text}>اكتب اسمًا أدق لتضييق النتائج.</Text> : null}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  option: { minHeight: 48, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two,
    padding: Spacing.two, borderRadius: Radius.md },
  name: { flex: 1 },
  thumbnail: { width: 40, height: 40, borderRadius: Radius.sm, overflow: "hidden",
    alignItems: "center", justifyContent: "center" },
});

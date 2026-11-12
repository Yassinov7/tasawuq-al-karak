import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { useAppDialog } from "@/context/AppDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { ControlSizes, MaxContentWidth, Spacing, Typography } from "@/constants/theme";
import { categoryError, categoryRemovalReason, listAdminCategories, removeAdminCategory, saveAdminCategory,
  type AdminCategory, type CategoryScope, type CategoryValues } from "@/lib/admin-categories";
import { newIdempotencyKey } from "@/lib/request-key";

const scopes = { store: "تصنيفات المتاجر", product: "تصنيفات المنتجات" } as const;
type Draft = { id: string; original?: AdminCategory; name: string; scope: CategoryScope; parent: string; order: string; active: boolean };
type DraftErrors = { name?: string; order?: string; parent?: string };

export function AdminCategoriesScreen() {
  const { user } = useAuth();
  return user ? <OwnedCategories key={user.id} owner={user.id} /> : null;
}

function OwnedCategories({ owner }: { owner: string }) {
  const { colors } = useTheme();
  const dialog = useAppDialog();
  const toast = useToast();
  const [rows, setRows] = useState<AdminCategory[] | null>(null);
  const [scope, setScope] = useState<CategoryScope>("store");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState("");
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(true);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const lock = useRef(false);
  const session = useRef<AbortController | null>(null);
  const read = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    read.current?.abort();
    const request = new AbortController();
    read.current = request;
    setReading(true);
    try {
      const next = await listAdminCategories(request.signal);
      if (!request.signal.aborted && active.current) { setRows(next); setError(""); }
    } catch (failure) {
      if (!request.signal.aborted && active.current) setError(categoryError(failure));
    } finally {
      if (!request.signal.aborted && active.current) setReading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const lifetime = new AbortController();
    session.current = lifetime;
    active.current = true;
    void load();
    return () => { active.current = false; lifetime.abort(); read.current?.abort(); };
  }, [load]));

  const byParent = useMemo(() => {
    const map = new Map<string | null, AdminCategory[]>();
    const ordered = [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ar") || a.id.localeCompare(b.id));
    for (const row of ordered) map.set(row.parent_id, [...(map.get(row.parent_id) ?? []), row]);
    return map;
  }, [rows]);
  const query = search.trim().toLocaleLowerCase("ar");
  const matches = (row: AdminCategory) => row.name.toLocaleLowerCase("ar").includes(query) || row.slug.includes(query);
  const roots = (byParent.get(null) ?? []).filter(row => row.scope === scope && (matches(row) || byParent.get(row.id)?.some(matches)));
  const eligibleParents = draft && !byParent.get(draft.id)?.length
    ? (byParent.get(null) ?? []).filter(row => row.scope === draft.scope && row.id !== draft.id) : [];
  const open = (original?: AdminCategory) => {
    setFieldErrors({});
    setFormError("");
    setConfirmingDisable(false);
    setParentOpen(false);
    setParentSearch("");
    setDraft(original ? { id: original.id, original, name: original.name, scope: original.scope,
      parent: original.parent_id ?? "", order: String(original.sort_order), active: original.is_active }
      : { id: newIdempotencyKey(), name: "", scope, parent: "", order: "0", active: true });
  };

  const run = async (work: (current: () => boolean, signal: AbortSignal) => Promise<void>, onError: (message: string) => void) => {
    const lifetime = session.current;
    if (lock.current || !lifetime || lifetime.signal.aborted) return;
    const current = () => active.current && !lifetime.signal.aborted;
    lock.current = true;
    read.current?.abort();
    setReading(false);
    setBusy(true);
    try { await work(current, lifetime.signal); }
    catch (failure) { if (current()) onError(categoryError(failure)); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const rawOrder = draft.order.trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
    const order = Number(rawOrder);
    const errors: DraftErrors = {};
    if ([...name].length < 2 || [...name].length > 80) errors.name = "أدخل اسمًا من حرفين إلى ٨٠ حرفًا.";
    if (!/^-?\d+$/.test(rawOrder) || !Number.isSafeInteger(order) || order < -2147483648 || order > 2147483647) errors.order = "أدخل رقم ترتيب صحيحًا.";
    if (draft.parent && !eligibleParents.some(row => row.id === draft.parent)) errors.parent = "اختر تصنيفًا رئيسيًا من النطاق نفسه.";
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;
    const values: CategoryValues = { name, scope: draft.scope, parent_id: draft.parent || null, sort_order: order, is_active: draft.active };
    if (draft.original?.is_active && !values.is_active && !confirmingDisable) {
      setConfirmingDisable(true);
      return;
    }
    void run(async current => {
      const result = await saveAdminCategory(owner, current, draft.id, values, draft.original);
      if (!current()) return;
      setRows(previous => [...(previous ?? []).filter(row => row.id !== result.id), result]);
      if (result.parent_id) setExpanded(previous => new Set(previous).add(result.parent_id!));
      setScope(result.scope);
      setDraft(null);
      toast.show({ message: "تم حفظ التصنيف.", tone: "success" });
    }, setFormError);
  };
  const confirmDisable = (name: string) => dialog.confirm({
    title: `تعطيل «${name}»؟`,
    message: "لن يتاح التصنيف وأبناؤه للاختيار في سجلات جديدة. تبقى الارتباطات القديمة محفوظة.",
    confirmText: "تعطيل",
  });
  const toggle = (row: AdminCategory) => void run(async current => {
    if (row.is_active && !await confirmDisable(row.name)) return;
    const { name, scope, parent_id, sort_order } = row;
    const result = await saveAdminCategory(owner, current, row.id, { name, scope, parent_id, sort_order, is_active: !row.is_active }, row);
    if (current()) setRows(previous => previous?.map(item => item.id === result.id ? result : item) ?? null);
  }, setError);
  const remove = (row: AdminCategory) => void run(async (current, signal) => {
    const reason = await categoryRemovalReason(row, signal);
    if (!current()) return;
    if (reason) { await dialog.alert("يتعذر حذف التصنيف", reason); return; }
    if (!await dialog.confirm({
      title: `حذف «${row.name}»؟`,
      message: "سيُحذف التصنيف نهائيًا. يمكنك تعطيله بدلًا من حذفه.",
      confirmText: "حذف",
      destructive: true,
    })) return;
    await removeAdminCategory(owner, current, row);
    if (current()) {
      setRows(previous => previous?.filter(item => item.id !== row.id) ?? null);
      toast.show({ message: "تم حذف التصنيف.", tone: "success" });
    }
  }, setError);

  const rowView = (row: AdminCategory, parent?: AdminCategory) => {
    const childCount = byParent.get(row.id)?.length ?? 0;
    const shown = expanded.has(row.id) || Boolean(query);
    return <View style={[styles.line, parent && styles.child, { borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={[styles.name, { color: colors.text }]}>{row.name}</Text>
        <Text style={[styles.caption, { color: !row.is_active || parent?.is_active === false ? colors.textSecondary : colors.successForeground }]}>
          {!row.is_active ? "معطّل" : parent?.is_active === false ? "الأب معطّل" : "مفعّل"}
        </Text>
        {childCount && query ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{childCount.toLocaleString("ar-SY")} فرعي</Text> : null}
        {childCount && !query ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: shown }}
          accessibilityLabel={`تصنيفات ${row.name} الفرعية`} onPress={() => setExpanded(previous => {
            const next = new Set(previous);
            if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
            return next;
          })} style={styles.expand}>
          <Text style={[styles.caption, { color: colors.primary }]}>{childCount.toLocaleString("ar-SY")} فرعي</Text>
          <AppIcon name={shown ? "chevron-up-outline" : "chevron-down-outline"} size={16} color={colors.primary} />
        </Pressable> : null}
      </View>
      <View style={styles.row}>
        <AppButton compact fullWidth={false} variant="outline" title="تعديل" icon="pencil-outline" disabled={busy} onPress={() => open(row)} />
        <AppButton compact fullWidth={false} variant="outline" title={row.is_active ? "تعطيل" : "تفعيل"} disabled={busy} onPress={() => toggle(row)} />
        <AppButton compact fullWidth={false} variant="danger" title="حذف" icon="trash-outline" disabled={busy} onPress={() => remove(row)} />
      </View>
    </View>;
  };
  const scopeTabs = (value: CategoryScope, select: (next: CategoryScope) => void) => <View style={styles.row} accessibilityRole="tablist">
    {(["store", "product"] as const).map(key => <Pressable key={key} accessibilityRole="tab"
      accessibilityState={{ selected: value === key, disabled: busy }} disabled={busy} onPress={() => select(key)}
      style={[styles.tab, { backgroundColor: value === key ? colors.surfaceSelected : colors.surface, borderColor: value === key ? colors.primary : colors.border }]}>
      <Text style={[styles.caption, { color: colors.text }]}>{value === key ? "✓ " : ""}{scopes[key]}</Text>
    </Pressable>)}
  </View>;

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList data={roots} keyExtractor={row => row.id} contentContainerStyle={styles.content}
      refreshing={reading && rows !== null} onRefresh={() => { if (!busy && !reading) void load(); }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.stack}>
        {scopeTabs(scope, setScope)}
        <View style={styles.row}>
          <View style={styles.search}><AppTextField label="بحث في التصنيفات" value={search} onChangeText={setSearch} /></View>
          <AppButton compact fullWidth={false} title="إضافة" icon="add-outline" disabled={busy || !rows} onPress={() => open()} />
        </View>
        {error ? <View style={styles.stack}>
          <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>{error}</Text>
          <AppButton compact fullWidth={false} title="تحديث القائمة" variant="outline" disabled={busy || reading} onPress={() => void load()} />
        </View> : null}
        {reading && rows === null ? <ActivityIndicator color={colors.primary} accessibilityLabel="جارٍ تحميل التصنيفات" /> : null}
      </View>}
      ListEmptyComponent={!reading && rows ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{query ? "لا توجد نتائج تطابق البحث." : "لا توجد تصنيفات في هذا النطاق."}</Text> : null}
      renderItem={({ item }) => <View>
        {rowView(item)}
        {expanded.has(item.id) || query ? (byParent.get(item.id) ?? []).filter(child => matches(item) || matches(child))
          .map(child => <View key={child.id}>{rowView(child, item)}</View>) : null}
      </View>}
    />
    {draft ? <AppModal visible busy={busy} title={draft.original ? "تعديل التصنيف" : "إضافة تصنيف"}
      icon="layers-outline" confirmText={confirmingDisable ? "تأكيد التعطيل والحفظ" : "حفظ"} cancelText="إلغاء" onCancel={() => setDraft(null)} onConfirm={save}>
      <View style={styles.stack}>
        <AppTextField label="اسم التصنيف" value={draft.name} maxLength={80} disabled={busy} error={fieldErrors.name}
          onChangeText={name => setDraft({ ...draft, name })} />
        {draft.original ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{scopes[draft.scope]} · النطاق ثابت بعد الإنشاء</Text>
          : scopeTabs(draft.scope, next => setDraft({ ...draft, scope: next, parent: "" }))}
        {byParent.get(draft.id)?.length ? <Text style={[styles.caption, { color: colors.textSecondary }]}>هذا التصنيف رئيسي وله أبناء.</Text>
          : <View style={styles.stack}>
            <AppButton fullWidth={false} variant="outline" disabled={busy} icon={parentOpen ? "chevron-up-outline" : "chevron-down-outline"}
              title={draft.parent ? eligibleParents.find(row => row.id === draft.parent)?.name ?? "اختر التصنيف الأب" : "بدون أب · تصنيف رئيسي"}
              accessibilityLabel="اختيار التصنيف الأب" onPress={() => setParentOpen(value => !value)} />
            {parentOpen ? <>
              <AppTextField label="بحث عن تصنيف رئيسي" value={parentSearch} onChangeText={setParentSearch} disabled={busy} />
              {[{ id: "", name: "بدون أب · تصنيف رئيسي" }, ...eligibleParents.filter(row => row.name.includes(parentSearch.trim()))]
                .map(option => <AppButton key={option.id} compact title={option.name}
                  icon={draft.parent === option.id ? "checkmark-outline" : undefined}
                  variant="outline" disabled={busy} onPress={() => {
                    setDraft({ ...draft, parent: option.id });
                    setParentOpen(false);
                  }} />)}
            </> : null}
          </View>}
        {fieldErrors.parent ? <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>{fieldErrors.parent}</Text> : null}
        <AppTextField label="ترتيب العرض" keyboardType="numbers-and-punctuation" value={draft.order} disabled={busy} error={fieldErrors.order}
          onChangeText={order => setDraft({ ...draft, order })} />
        <View style={styles.row}>
          <Text style={[styles.name, { color: colors.text }]}>{draft.active ? "مفعّل" : "معطّل"}</Text>
          <Switch accessibilityLabel="تفعيل التصنيف" disabled={busy} value={draft.active} onValueChange={active => {
            setConfirmingDisable(false);
            setDraft({ ...draft, active });
          }} />
        </View>
        {confirmingDisable ? <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: colors.warningForeground }]}>
          لن يتاح التصنيف وأبناؤه للاختيار في سجلات جديدة. تبقى الارتباطات القديمة محفوظة.
        </Text> : null}
        {formError ? <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>{formError}</Text> : null}
      </View>
    </AppModal> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.four, gap: Spacing.two },
  stack: { gap: Spacing.two },
  row: { direction: "ltr", flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.one },
  search: { flex: 1, minWidth: 140 },
  tab: { flexGrow: 1, minHeight: ControlSizes.touch, borderWidth: 1, borderRadius: 8, padding: Spacing.two, justifyContent: "center" },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two, gap: Spacing.one },
  child: { paddingRight: Spacing.three },
  name: { ...Typography.bodyStrong, textAlign: "right", flexGrow: 1, flexShrink: 1 },
  caption: { ...Typography.caption, textAlign: "right" },
  expand: { minHeight: ControlSizes.touch, minWidth: ControlSizes.touch, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.one },
});

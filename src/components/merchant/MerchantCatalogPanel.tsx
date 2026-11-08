import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppConfirmModal } from '@/components/ui/AppModal';
import { AppTextField } from '@/components/ui/AppTextField';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMerchantWorkspace } from '@/context/MerchantWorkspaceContext';
import { useCustomerCatalog } from '@/context/CustomerCatalogContext';
import { Radius, Typography } from '@/constants/theme';
import { createCatalogController, offerPhase, offerPhaseLabels, offerPriceSummary, offerTypeLabels, type CatalogKind, type CatalogRow, type CatalogScope, type CatalogState } from '@/lib/merchant-catalog';
import type { CatalogOffer, CatalogProduct } from '@/lib/merchant-catalog-api';
import { invalidateMerchantHome } from '@/lib/merchant-home';
import { invalidateLocalCache } from '@/lib/local-cache';
import { invalidatePublicCatalog } from '@/lib/public-catalog';
import { getStoreMediaUrl } from '@/lib/merchant-store';
import { formatSyp } from '@/lib/money';
import { formatLocalOfferEnd } from '@/lib/offer-expiration';

const productFilters = [['all', 'الكل'], ['available', 'المتاحة'], ['paused', 'الموقوفة']] as const;
const offerFilters = [['all', 'الكل'], ['current', 'الجارية'], ['scheduled', 'المجدولة'], ['expired', 'المنتهية'], ['paused', 'الموقوفة']] as const;

export function MerchantCatalogPanel({ kind }: { kind: CatalogKind }) {
  const { user } = useAuth();
  return user ? <OwnedCatalogPanel key={`${user.id}:${kind}`} ownerId={user.id} kind={kind} /> : null;
}
function OwnedCatalogPanel({ ownerId, kind }: { ownerId: string; kind: CatalogKind }) {
  const { colors } = useTheme(), router = useRouter();
  const workspace = useMerchantWorkspace();
  const { refresh, refreshProductAvailability } = useCustomerCatalog();
  const [query, setQuery] = useState(kind === 'products' ? workspace.query : '');
  const [filter, setFilter] = useState<CatalogScope['filter']>(kind === 'products' ? workspace.availability : 'all');
  const [state, setState] = useState<CatalogState | null>(null);
  const [selected, setSelected] = useState<CatalogProduct | CatalogOffer | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const list = useRef<FlatList<CatalogRow>>(null);
  const [initialScope] = useState<CatalogScope>(() => ({ query: kind === 'products' ? workspace.query.trim() : '', filter: kind === 'products' ? workspace.availability : 'all' }));
  const afterChange = useCallback(async (changedKind: CatalogKind, id: string) => {
      invalidateMerchantHome(ownerId);
      await Promise.all([invalidateLocalCache(`merchant-products:${ownerId}`), invalidateLocalCache(`merchant-offers:${ownerId}`), invalidatePublicCatalog()]);
      if (changedKind === 'products') await refreshProductAvailability(id);
      else await refresh();
    }, [ownerId, refresh, refreshProductAvailability]);
  const controller = useMemo(() => createCatalogController(ownerId, kind, initialScope, setState, afterChange), [ownerId, kind, initialScope, afterChange]);
  useFocusEffect(useCallback(() => {
    controller.activate(); void controller.focus();
    return () => { setSelected(null); setExpanded(new Set()); controller.deactivate(); };
  }, [controller]));
  useEffect(() => {
    const timer = setTimeout(() => { setSelected(null); setExpanded(new Set()); list.current?.scrollToOffset({ offset: 0, animated: false }); void controller.select({ query: query.trim(), filter }); }, 300);
    return () => clearTimeout(timer);
  }, [controller, query, filter]);
  // When a visible offer reaches a start/end boundary, refresh server-side membership.
  useFocusEffect(useCallback(() => {
    if (kind !== 'offers' || !state?.loadedAt || state.loading || state.busy || state.validating) return;
    const now = Date.now();
    const boundary = state.rows.flatMap(row => row.kind === 'offers' ? [Date.parse(row.starts_at), row.ends_at ? Date.parse(row.ends_at) : NaN] : []).filter(value => value > now).sort((a, b) => a - b)[0];
    const delay = Math.min(30_000, boundary ? boundary - now + 50 : 30_000);
    const timer = setTimeout(() => void controller.refresh(), delay);
    return () => clearTimeout(timer);
  }, [controller, kind, state]));
  const openEditor = (id?: string) => {
    if (kind === 'products') router.push({ pathname: '/merchant/product-editor', params: id ? { id } : {} });
    else router.push({ pathname: '/merchant/offer-editor', params: id ? { id } : {} });
  };
  const filters = kind === 'products' ? productFilters : offerFilters;
  const searching = Boolean(state && (query.trim() !== state.scope.query || filter !== state.scope.filter));
  const hidden = !state || state.validating || searching;
  const pending = state?.pendingDelete?.storeId === state?.store?.id ? state?.pendingDelete : null;
  const toggleExpanded = (id: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toolbar = <View style={styles.stack}>
    <View style={styles.actionRow}><AppButton design="refined" title={kind === 'products' ? 'إضافة منتج' : 'إضافة عرض'} icon="add-outline" disabled={!state?.store?.approved || Boolean(state?.busy) || hidden} onPress={() => openEditor()} /></View>
    <AppTextField design="refined" label={kind === 'products' ? 'بحث المنتجات' : 'بحث العروض'} placeholder="ابحث بالاسم" value={query} onChangeText={value => { setQuery(value); if (kind === 'products') workspace.setQuery(value); }} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
      {filters.map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === filter }} onPress={() => { setFilter(value); if (kind === 'products' && (value === 'all' || value === 'available' || value === 'paused')) workspace.setAvailability(value); }} style={[styles.chip, { backgroundColor: filter === value ? colors.surfaceSelected : colors.surface, borderColor: filter === value ? colors.primary : colors.borderStrong }]}><Text style={[styles.strong, { color: filter === value ? colors.primary : colors.text }]}>{label}</Text></Pressable>)}
    </ScrollView>
    {state?.notice ? <Message text={state.notice} /> : null}
    {pending ? <AppButton design="refined" title="التحقق من نتيجة الحذف بالقراءة" variant="outline" disabled={state?.busy} onPress={() => void controller.verifyDelete()} /> : null}
    {state?.error ? <View style={styles.stack}><Message text={state.error} error /><AppButton design="refined" title="إعادة المحاولة" variant="outline" disabled={state.busy || state.loading} onPress={() => void controller.refresh()} /></View> : null}
    {(hidden || state?.loading) ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { color: colors.textSecondary }]}>{!hidden && state?.rows.length ? 'جارٍ تحديث النتائج السابقة…' : 'جارٍ تحميل القائمة…'}</Text></View> : null}
  </View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <FlatList ref={list} data={hidden ? [] : state.rows} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      ListHeaderComponent={toolbar} ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshing={Boolean(state?.loading)} onRefresh={() => void controller.refresh()}
      onEndReachedThreshold={0.4} onEndReached={() => { if (!hidden) void controller.more(); }}
      ListEmptyComponent={!hidden && !state.loading && !state.error ? <View style={styles.empty}><AppIcon name={kind === 'products' ? 'cube-outline' : 'pricetags-outline'} size={28} color={colors.primary} /><Text style={[styles.strong, { color: colors.text }]}>{!state.store ? 'لا يوجد متجر مرتبط بهذا الحساب.' : state.scope.query || state.scope.filter !== 'all' ? 'لا توجد نتائج لهذا البحث أو الفلتر.' : kind === 'products' ? 'لا توجد منتجات بعد. أضف أول منتج من الزر أعلاه.' : 'لا توجد عروض بعد. أضف عرضًا من منتجات متجرك.'}</Text></View> : null}
      ListFooterComponent={!hidden ? <View style={styles.footer}>{state.moreLoading ? <ActivityIndicator color={colors.primary} /> : state.moreError ? <><Message text="تعذر تحميل المزيد؛ النتائج الحالية محفوظة." error /><AppButton design="refined" title="إعادة تحميل المزيد" variant="outline" onPress={() => void controller.more(true)} /></> : state.hasMore ? <AppButton design="refined" title="تحميل المزيد" variant="outline" disabled={state.loading || state.busy} onPress={() => void controller.more()} /> : state.rows.length ? <Text style={[styles.body, { color: colors.textSecondary }]}>نهاية النتائج</Text> : null}</View> : null}
      renderItem={({ item }) => item.kind === 'products' ? <ProductCard product={item} busy={Boolean(state?.busy)} edit={() => openEditor(item.id)} availability={() => item.is_available ? setSelected(item) : void controller.availability(item)} /> : <OfferCard offer={item} expanded={expanded.has(item.id)} expand={() => toggleExpanded(item.id)} edit={() => openEditor(item.id)} remove={() => setSelected(item)} busy={Boolean(state?.busy || pending)} />} />
    <AppConfirmModal design="refined" visible={Boolean(selected)} title={selected?.kind === 'products' ? 'إيقاف عرض المنتج؟' : 'حذف العرض نهائيًا؟'}
      message={selected?.kind === 'products' ? `سيتوقف «${selected.title}» عن الطلب، وتصبح العروض التي تتضمنه غير قابلة للشراء. تبقى الصور والسجلات ويمكن إعادة تفعيله.` : `سيُحذف «${selected?.title ?? ''}» نهائيًا من المتجر واختيارات السلال المرتبطة به. تبقى بيانات الطلبات السابقة المثبتة محفوظة. لا يمكن التراجع عن الحذف.`}
      confirmText={selected?.kind === 'products' ? 'إيقاف المنتج' : 'حذف نهائي'} cancelText="إلغاء" destructive busy={Boolean(state?.busy)}
      onCancel={() => { if (!state?.busy) setSelected(null); }} onConfirm={() => { if (!selected) return; const row = selected; if (row.kind === 'products') void controller.availability(row).then(() => setSelected(null)); else void controller.remove(row).then(() => setSelected(null)); }} />
  </View>;
}
function Message({ text, error = false }: { text: string; error?: boolean }) {
  const { colors } = useTheme(); return <View style={[styles.message, { backgroundColor: error ? colors.errorSurface : colors.infoSurface, borderColor: error ? colors.errorBorder : colors.infoBorder }]}><Text accessibilityLiveRegion="polite" style={[styles.body, { color: error ? colors.errorForeground : colors.infoForeground }]}>{text}</Text></View>;
}
function ProductCard({ product, busy, edit, availability }: { product: CatalogProduct; busy: boolean; edit: () => void; availability: () => void }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
    <View style={styles.productRow}>{product.image ? <Image source={{ uri: getStoreMediaUrl(product.image) }} style={styles.image} accessibilityLabel={`صورة ${product.title}`} /> : <View style={[styles.image, styles.placeholder, { backgroundColor: colors.surfaceSecondary }]}><AppIcon name="image-outline" size={24} color={colors.textSecondary} /></View>}
      <View style={styles.identity}><Text style={[styles.title, { color: colors.text }]}>{product.title}</Text><Text style={[styles.strong, { color: colors.primary }]}>{formatSyp(product.price)} · لكل {product.selling_unit}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{product.category ? `${product.category.name}${product.category.is_active ? '' : ' (غير نشط)'}` : 'التصنيف المرتبط غير متاح للقراءة'}</Text>
        <Status label={product.is_available ? 'متاح للطلب' : 'متوقف'} tone={product.is_available ? 'success' : 'neutral'} />
      </View></View>
    <View style={styles.actions}><AppButton design="refined" title="تعديل" variant="outline" fullWidth={false} disabled={busy} onPress={edit} /><AppButton design="refined" title={product.is_available ? 'إيقاف المنتج' : 'إتاحة المنتج'} variant="outline" fullWidth={false} disabled={busy} onPress={availability} /></View>
  </View>;
}
function OfferCard({ offer, expanded, expand, busy, edit, remove }: { offer: CatalogOffer; expanded: boolean; expand: () => void; busy: boolean; edit: () => void; remove: () => void }) {
  const { colors } = useTheme(); const phase = offerPhase(offer);
  const unavailable = offer.items.some(item => !item.product?.is_available);
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
    <Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
    <View style={styles.actions}><Status label={offerTypeLabels[offer.offer_type]} tone="neutral" /><Status label={offerPhaseLabels[phase]} tone={phase === 'current' ? 'success' : phase === 'scheduled' ? 'info' : phase === 'expired' ? 'warning' : 'neutral'} /></View>
    <Text style={[styles.strong, { color: colors.primary }]}>{offerPriceSummary(offer)}</Text>
    {phase === 'scheduled' ? <Text style={[styles.body, { color: colors.textSecondary }]}>يبدأ: {formatLocalOfferEnd(offer.starts_at)}</Text> : null}
    <Text style={[styles.body, { color: colors.textSecondary }]}>{offer.ends_at ? `ينتهي: ${formatLocalOfferEnd(offer.ends_at)}` : 'بدون تاريخ انتهاء'}</Text>
    {!offer.items.length || unavailable ? <Text style={[styles.body, { color: colors.warningForeground }]}>هذا العرض غير قابل للشراء حاليًا؛ بعض مكوناته غير متاحة.</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={expand} style={[styles.expand, { borderColor: colors.borderStrong }]}><Text style={[styles.strong, { color: colors.primary }]}>{expanded ? 'إخفاء المكونات' : `عرض المكونات (${offer.items.length.toLocaleString('ar-SY')})`}</Text><AppIcon name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={colors.primary} /></Pressable>
    {(expanded ? offer.items : offer.items.slice(0, 2)).map(item => <Text key={item.id} style={[styles.body, { color: colors.textSecondary }]}>{item.item_role === 'buy' ? 'شراء: ' : item.item_role === 'reward' ? 'مكافأة: ' : ''}{item.quantity.toLocaleString('ar-SY', { maximumFractionDigits: 3 })} × {item.product?.title ?? 'منتج غير متاح للقراءة'}{item.product ? ` · ${item.product.selling_unit}` : ''}</Text>)}
    <View style={styles.actions}><AppButton design="refined" title="تعديل" variant="outline" fullWidth={false} disabled={busy} onPress={edit} /><AppButton design="refined" title="حذف نهائي" variant="danger" fullWidth={false} disabled={busy} onPress={remove} /></View>
  </View>;
}
function Status({ label, tone }: { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' }) {
  const { colors } = useTheme();
  const backgroundColor = tone === 'neutral' ? colors.surfaceSecondary : colors[`${tone}Surface`];
  const color = tone === 'neutral' ? colors.textSecondary : colors[`${tone}Foreground`];
  return <View style={[styles.status, { backgroundColor }]}><Text style={[styles.strong, { color }]}>{label}</Text></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 12 }, stack: { gap: 12 }, actionRow: { alignItems: 'stretch' }, filters: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }, chip: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.md }, body: { ...Typography.body, textAlign: 'right' }, strong: { ...Typography.bodyStrong, textAlign: 'right' }, title: { ...Typography.cardTitle, textAlign: 'right' }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: 16, gap: 10 }, productRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }, image: { width: 64, height: 64, borderRadius: Radius.md }, placeholder: { justifyContent: 'center', alignItems: 'center' }, identity: { flex: 1, gap: 6 }, actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, status: { alignSelf: 'flex-end', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 }, message: { padding: 12, borderWidth: 1, borderRadius: Radius.md }, loading: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 12, flexWrap: 'wrap' }, empty: { gap: 12, paddingVertical: 24, alignItems: 'center' }, footer: { gap: 12, paddingVertical: 16 }, separator: { height: 12 }, expand: { minHeight: 48, padding: 8, flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: Radius.md } });

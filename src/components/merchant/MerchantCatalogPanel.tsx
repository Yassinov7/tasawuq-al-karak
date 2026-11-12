import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppConfirmModal } from '@/components/ui/AppModal';
import { AppTextField } from '@/components/ui/AppTextField';
import { useLongWait } from '@/components/ui/LoadingState';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMerchantWorkspace } from '@/context/MerchantWorkspaceContext';
import { useCustomerCatalog } from '@/context/CustomerCatalogContext';
import { ControlSizes, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { catalogOfferBoundaryDelay, createCatalogController, offerPhase, offerPhaseLabels, offerPriceSummary, offerTypeLabels, type CatalogKind, type CatalogRow, type CatalogScope, type CatalogState } from '@/lib/merchant-catalog';
import type { CatalogOffer, CatalogProduct } from '@/lib/merchant-catalog-api';
import { invalidateMerchantHome } from '@/lib/merchant-home';
import { invalidateLocalCache } from '@/lib/local-cache';
import { invalidatePublicCatalog } from '@/lib/public-catalog';
import { getStoreMediaUrl } from '@/lib/merchant-store';
import { formatSyp } from '@/lib/money';
import { formatCompactOfferDate, formatLocalOfferEnd } from '@/lib/offer-expiration';

const productFilters = [['all', 'الكل'], ['available', 'المتاحة'], ['paused', 'الموقوفة']] as const;
const offerFilters = [['all', 'الكل'], ['current', 'الجارية'], ['scheduled', 'المجدولة'], ['expired', 'المنتهية'], ['paused', 'الموقوفة']] as const;

export function MerchantCatalogPanel({ kind, compact = false, visible = true }: { kind: CatalogKind; compact?: boolean; visible?: boolean }) {
  const { user } = useAuth();
  return user ? <OwnedCatalogPanel key={`${user.id}:${kind}`} ownerId={user.id} kind={kind} compact={compact} visible={visible} /> : null;
}
function OwnedCatalogPanel({ ownerId, kind, compact, visible }: { ownerId: string; kind: CatalogKind; compact: boolean; visible: boolean }) {
  const { colors } = useTheme(), router = useRouter();
  const workspace = useMerchantWorkspace();
  const { refresh, refreshProductAvailability } = useCustomerCatalog();
  const [query, setQuery] = useState(kind === 'products' ? workspace.query : '');
  const [filter, setFilter] = useState<CatalogScope['filter']>(kind === 'products' ? workspace.availability : 'all');
  const [state, setState] = useState<CatalogState | null>(null);
  const [selected, setSelected] = useState<CatalogProduct | CatalogOffer | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [manualRefresh, setManualRefresh] = useState(false);
  const list = useRef<FlatList<CatalogRow>>(null);
  const page = state?.page ?? 0;
  useEffect(() => {
    if (compact) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [compact, page]);
  const [initialScope] = useState<CatalogScope>(() => ({ query: kind === 'products' ? workspace.query.trim() : '', filter: kind === 'products' ? workspace.availability : 'all' }));
  const afterChange = useCallback(async (changedKind: CatalogKind, id: string) => {
      invalidateMerchantHome(ownerId);
      await Promise.all([invalidateLocalCache(`merchant-products:${ownerId}`), invalidateLocalCache(`merchant-offers:${ownerId}`), invalidatePublicCatalog()]);
      if (changedKind === 'products') await refreshProductAvailability(id);
      else await refresh();
    }, [ownerId, refresh, refreshProductAvailability]);
  const controller = useMemo(() => createCatalogController(ownerId, kind, initialScope, setState, afterChange, undefined, undefined, compact), [ownerId, kind, initialScope, afterChange, compact]);
  useFocusEffect(useCallback(() => {
    if (!visible) return;
    controller.activate(); void controller.focus();
    return () => { setSelected(null); controller.deactivate(); };
  }, [controller, visible]));
  useEffect(() => {
    const timer = setTimeout(() => { setSelected(null); setExpanded(new Set()); list.current?.scrollToOffset({ offset: 0, animated: false }); void controller.select({ query: query.trim(), filter }); }, 300);
    return () => clearTimeout(timer);
  }, [controller, query, filter]);
  // When a visible offer reaches a start/end boundary, refresh server-side membership.
  useFocusEffect(useCallback(() => {
    if (!visible || kind !== 'offers' || !state?.loadedAt || state.loading || state.busy || state.validating) return;
    const delay = catalogOfferBoundaryDelay(state.rows, state.nextBoundary, Date.now());
    if (delay === null) return;
    const timer = setTimeout(() => void controller.sync(), delay);
    return () => clearTimeout(timer);
  }, [controller, kind, state, visible]));
  const storeId = state?.store?.id;
  useOrderRealtime({
    channelName: `merchant-catalog:${ownerId}:${kind}:${storeId ?? 'pending'}`,
    enabled: visible,
    subscriptions: storeId ? [
      ...(kind === 'products' ? [{ table: 'catalog_category_revision' as const }] : []),
      { table: 'stores', filter: `id=eq.${storeId}` },
      { table: 'products', filter: `store_id=eq.${storeId}` },
      ...(kind === 'offers' ? [{ table: 'store_offers' as const, filter: `store_id=eq.${storeId}` }] : []),
    ] : [{ table: 'merchants', filter: `owner_user_id=eq.${ownerId}` }],
    onChange: controller.sync,
  });
  const openEditor = (id?: string) => {
    if (kind === 'products') router.push({ pathname: '/merchant/product-editor', params: id ? { id } : {} });
    else router.push({ pathname: '/merchant/offer-editor', params: id ? { id, from: 'catalog' } : { from: 'catalog' } });
  };
  const filters = kind === 'products' ? productFilters : offerFilters;
  const searching = Boolean(state && (query.trim() !== state.scope.query || filter !== state.scope.filter));
  const hidden = !state || state.validating && (!compact || !state.rows.length) || searching;
  const pending = state?.pendingDelete?.storeId === state?.store?.id ? state?.pendingDelete : null;
  const toggleExpanded = (id: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const waitingForList = hidden || Boolean(state?.loading && !state.rows.length);
  const delayed = useLongWait(waitingForList && !state?.error);
  const addLabel = kind === 'products' ? 'إضافة منتج' : 'إضافة عرض';
  const add = <AppButton design="refined" compact={compact} title={compact ? 'إضافة' : addLabel} accessibilityLabel={addLabel} icon="add-outline"
    fullWidth={!compact} disabled={!state?.store?.approved || Boolean(state?.busy || state?.validating) || hidden} onPress={() => openEditor()} />;
  const searchLabel = kind === 'products' ? 'بحث المنتجات' : 'بحث العروض';
  const changeQuery = (value: string) => {
    setQuery(value);
    if (kind === 'products') workspace.setQuery(value);
  };
  const searchField = <AppTextField design="refined" label={searchLabel}
    placeholder="ابحث بالاسم" value={query}
    onChangeText={changeQuery} />;
  const filterScroll = useRef<ScrollView>(null);
  const filterViewport = useRef(0);
  const filterContent = useRef(0);
  const filterPositions = useRef<Partial<Record<CatalogScope['filter'], { x: number; width: number }>>>({});
  const revealFilter = useCallback(() => {
    const selectedPosition = filterPositions.current[filter];
    if (!selectedPosition || !filterViewport.current || !filterContent.current) return;
    const center = selectedPosition.x + (selectedPosition.width - filterViewport.current) / 2;
    const x = Math.max(0, Math.min(center, filterContent.current - filterViewport.current));
    filterScroll.current?.scrollTo({ x, animated: false });
  }, [filter]);
  useEffect(revealFilter, [revealFilter]);
  const filterItems = filters.map(([value, label]) => {
    const selectedFilter = value === filter;
    return <Pressable key={value} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected: selectedFilter }}
      onLayout={compact ? ({ nativeEvent }) => {
        const { x, width } = nativeEvent.layout;
        filterPositions.current[value] = { x, width };
        if (selectedFilter) revealFilter();
      } : undefined}
      onPress={() => {
        setFilter(value);
        if (kind === 'products' && (value === 'all' || value === 'available' || value === 'paused')) workspace.setAvailability(value);
      }}
      style={[compact ? styles.compactChip : styles.chip, {
        backgroundColor: selectedFilter ? colors.surfaceSelected : colors.surface,
        borderColor: selectedFilter ? colors.primary : colors.borderStrong,
      }]}>
      <Text style={[compact ? styles.filterLabel : styles.strong, { color: selectedFilter ? colors.primary : colors.text }]}>
        {compact && selectedFilter ? `✓ ${label}` : label}
      </Text>
    </Pressable>;
  });
  const toolbar = <View style={compact ? styles.compactStack : styles.stack}>
    {compact ? <>
      <View style={styles.toolbarLine}>
        <View style={[styles.searchSlot, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
          <AppIcon name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput accessibilityLabel={searchLabel} placeholder="بحث بالاسم" value={query}
            onChangeText={changeQuery} returnKeyType="search" placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => changeQuery('')}
            style={styles.searchClear}><AppIcon name="close-outline" size={18} color={colors.textSecondary} /></Pressable> : null}
        </View>
        {add}
      </View>
      <ScrollView ref={filterScroll} horizontal keyboardShouldPersistTaps="handled"
        style={styles.filterScroll} contentContainerStyle={styles.compactFilters}
        onLayout={({ nativeEvent }) => { filterViewport.current = nativeEvent.layout.width; revealFilter(); }}
        onContentSizeChange={width => { filterContent.current = width; revealFilter(); }}>
        {filterItems}
      </ScrollView>
      {state?.store && !state.store.approved && !hidden ? <Message text="تتوفر الإضافة بعد اعتماد المتجر." /> : null}
    </> : <>
      <View style={styles.actionRow}>{add}</View>{searchField}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
        {filterItems}
      </ScrollView>
    </>}
    {state?.notice ? <Message text={state.notice} /> : null}
    {pending ? <AppButton design="refined" title="التحقق من نتيجة الحذف بالقراءة" variant="outline" disabled={state?.busy} onPress={() => void controller.verifyDelete()} /> : null}
    {state?.error ? <View style={styles.stack}><Message text={state.error} error /><AppButton design="refined" title="إعادة المحاولة" variant="outline" disabled={state.busy || state.loading} onPress={() => void controller.refresh()} /></View> : null}
    {(compact ? waitingForList && !state?.error : hidden || state?.loading) ? <View style={styles.loading}>
      {!compact || !delayed ? <ActivityIndicator color={colors.primary} /> : null}
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {compact && delayed ? 'التحميل يستغرق وقتًا أطول.' : !hidden && state?.rows.length ? 'جارٍ تحديث النتائج السابقة…' : 'جارٍ تحميل القائمة…'}
      </Text>
    </View> : null}
  </View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <FlatList ref={list} data={hidden ? [] : state.rows} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, compact && styles.compactContent]}
      ListHeaderComponent={toolbar} ItemSeparatorComponent={() => <View style={compact ? styles.compactSeparator : styles.separator} />}
      refreshing={manualRefresh} onRefresh={() => {
        setManualRefresh(true);
        void controller.sync().finally(() => setManualRefresh(false));
      }}
      onEndReachedThreshold={0.4} onEndReached={compact ? undefined : () => { if (!hidden) void controller.more(); }}
      ListEmptyComponent={!hidden && !state.loading && !state.error ? <View style={styles.empty}><AppIcon name={kind === 'products' ? 'cube-outline' : 'pricetags-outline'} size={28} color={colors.primary} /><Text style={[styles.strong, { color: colors.text }]}>{!state.store ? 'لا يوجد متجر مرتبط بهذا الحساب.' : state.scope.query || state.scope.filter !== 'all' ? 'لا توجد نتائج لهذا البحث أو الفلتر.' : kind === 'products' ? 'لا توجد منتجات بعد. أضف أول منتج من الزر أعلاه.' : 'لا توجد عروض بعد. أضف عرضًا من منتجات متجرك.'}</Text></View> : null}
      ListFooterComponent={!hidden ? compact ? <CatalogPager page={state.page} hasMore={state.hasMore}
        busy={state.loading || state.busy || state.validating} move={step => void controller.movePage(step)} />
        : <View style={styles.footer}>{state.moreLoading ? <ActivityIndicator color={colors.primary} /> : state.moreError ? <><Message text="تعذر تحميل المزيد؛ النتائج الحالية محفوظة." error /><AppButton design="refined" title="إعادة تحميل المزيد" variant="outline" onPress={() => void controller.more(true)} /></> : state.hasMore ? <AppButton design="refined" title="تحميل المزيد" variant="outline" disabled={state.loading || state.busy} onPress={() => void controller.more()} /> : state.rows.length ? <Text style={[styles.body, { color: colors.textSecondary }]}>نهاية النتائج</Text> : null}</View> : null}
      renderItem={({ item }) => item.kind === 'products' ? <ProductCard compact={compact} product={item} busy={Boolean(state?.busy || compact && state?.validating)} edit={() => openEditor(item.id)} availability={() => item.is_available ? setSelected(item) : void controller.availability(item)} /> : <OfferCard compact={compact} offer={item} expanded={expanded.has(item.id)} expand={() => toggleExpanded(item.id)} edit={() => openEditor(item.id)} remove={() => setSelected(item)} busy={Boolean(state?.busy || pending || compact && state?.validating)} />} />
    <AppConfirmModal design="refined" icon={compact ? selected?.kind === 'products' ? 'pause-circle-outline' : 'trash-outline' : undefined} visible={Boolean(selected)} title={selected?.kind === 'products' ? 'إيقاف عرض المنتج؟' : 'حذف العرض نهائيًا؟'}
      message={selected?.kind === 'products' ? `سيتوقف «${selected.title}» عن الطلب، وتصبح العروض التي تتضمنه غير قابلة للشراء. تبقى الصور والسجلات ويمكن إعادة تفعيله.` : `سيُحذف «${selected?.title ?? ''}» نهائيًا من المتجر واختيارات السلال المرتبطة به. تبقى بيانات الطلبات السابقة المثبتة محفوظة. لا يمكن التراجع عن الحذف.`}
      confirmText={selected?.kind === 'products' ? 'إيقاف المنتج' : 'حذف نهائي'} cancelText="إلغاء" destructive busy={Boolean(state?.busy)}
      onCancel={() => { if (!state?.busy) setSelected(null); }} onConfirm={() => { if (!selected) return; const row = selected; if (row.kind === 'products') void controller.availability(row).then(() => setSelected(null)); else void controller.remove(row).then(() => setSelected(null)); }} />
  </View>;
}
function CatalogPager({ page, hasMore, busy, move }: { page: number; hasMore: boolean; busy: boolean; move: (step: -1 | 1) => void }) {
  const { colors } = useTheme();
  const button = (label: string, disabled: boolean, step: -1 | 1) => (
    <View style={styles.pageSide}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
        style={styles.pageTouch} onPress={() => move(step)}>
        <Text style={[styles.pagePill, { backgroundColor: colors.surfaceSecondary, color: disabled ? colors.textSecondary : colors.primary }]}>{label}</Text>
      </Pressable>
    </View>
  );
  return <View style={styles.pager}>
    {button('السابق', busy || page === 0, -1)}
    <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>صفحة {(page + 1).toLocaleString('ar-SY')}</Text>
    {button('التالي', busy || !hasMore, 1)}
  </View>;
}
function Message({ text, error = false }: { text: string; error?: boolean }) {
  const { colors } = useTheme(); return <View style={[styles.message, { backgroundColor: error ? colors.errorSurface : colors.infoSurface, borderColor: error ? colors.errorBorder : colors.infoBorder }]}><Text accessibilityLiveRegion="polite" style={[styles.body, { color: error ? colors.errorForeground : colors.infoForeground }]}>{text}</Text></View>;
}
function ProductCard({ product, busy, edit, availability, compact }: { compact: boolean; product: CatalogProduct; busy: boolean; edit: () => void; availability: () => void }) {
  const { colors } = useTheme();
  if (compact) return <View style={[styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={styles.productSummary}>
      {product.image ? <Image source={{ uri: getStoreMediaUrl(product.image) }} style={styles.compactImage} accessibilityLabel={`صورة ${product.title}`} />
        : <View style={[styles.compactImage, styles.placeholder, { backgroundColor: colors.surfaceSecondary }]}><AppIcon name="cube-outline" size={24} color={colors.textSecondary} /></View>}
      <View style={styles.summaryText}>
        <Text style={[styles.title, { color: colors.text }]}>{product.title}</Text>
        {product.category ? <Text style={[styles.filterLabel, { color: colors.textSecondary, textAlign: 'right' }]}>{product.category.name}{product.category.is_active ? '' : ' · تصنيف غير نشط'}</Text> : null}
        <View style={styles.summaryLine}>
          <Text style={[styles.strong, { color: colors.text }]}>{formatSyp(product.price)} · لكل {product.selling_unit}</Text>
          <Status label={product.is_available ? 'متاح للطلب' : 'متوقف'} tone={product.is_available ? 'success' : 'neutral'} />
        </View>
      </View>
    </View>
    <View style={[styles.compactActions, { borderTopColor: colors.border }]}>
      <AppButton compact title="تعديل المنتج" icon="pencil-outline" fullWidth={false} disabled={busy} onPress={edit} />
      <AppButton compact title={product.is_available ? 'إيقاف المنتج' : 'إتاحة المنتج'}
        icon={product.is_available ? 'pause-circle-outline' : 'play-circle-outline'} variant="outline" fullWidth={false} disabled={busy} onPress={availability} />
    </View>
  </View>;
  return <View style={[styles.card, compact && styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
    <View style={styles.productRow}>{product.image ? <Image source={{ uri: getStoreMediaUrl(product.image) }} style={[styles.image, compact && styles.compactImage]} accessibilityLabel={`صورة ${product.title}`} /> : <View style={[styles.image, compact && styles.compactImage, styles.placeholder, { backgroundColor: colors.surfaceSecondary }]}><AppIcon name="image-outline" size={24} color={colors.textSecondary} /></View>}
      <View style={styles.identity}><Text style={[styles.title, { color: colors.text }]}>{product.title}</Text><Text style={[styles.strong, { color: colors.primary }]}>{formatSyp(product.price)} · لكل {product.selling_unit}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{product.category ? `${product.category.name}${product.category.is_active ? '' : ' (غير نشط)'}` : 'التصنيف المرتبط غير متاح للقراءة'}</Text>
        <Status label={product.is_available ? 'متاح للطلب' : 'متوقف'} tone={product.is_available ? 'success' : 'neutral'} />
      </View></View>
    <View style={[styles.actions, compact && styles.actionDivider, compact && { borderTopColor: colors.border }]}><AppButton design="refined" title="تعديل" variant="outline" fullWidth={false} disabled={busy} onPress={edit} /><AppButton design="refined" title={product.is_available ? 'إيقاف المنتج' : 'إتاحة المنتج'} variant="outline" fullWidth={false} disabled={busy} onPress={availability} /></View>
  </View>;
}
function OfferCard({ offer, expanded, expand, busy, edit, remove, compact }: { compact: boolean; offer: CatalogOffer; expanded: boolean; expand: () => void; busy: boolean; edit: () => void; remove: () => void }) {
  const { colors } = useTheme(); const phase = offerPhase(offer);
  const unavailable = offer.items.some(item => !item.product?.is_available);
  const tone = phase === 'current' ? 'success' : phase === 'scheduled' ? 'info' : phase === 'expired' ? 'warning' : 'neutral';
  if (compact) return <View style={[styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={styles.summaryLine}>
      <Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
      <Status label={offerPhaseLabels[phase]} tone={tone} />
    </View>
    <View style={[styles.offerValue, { backgroundColor: colors.surfaceSecondary }]}>
      <Text style={[styles.strong, { color: colors.text }]}>{offerTypeLabels[offer.offer_type]}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{offerPriceSummary(offer)}</Text>
    </View>
    <View style={styles.summaryLine}>
      <OfferDate label="يبدأ" value={offer.starts_at} />
      {offer.ends_at ? <OfferDate label="ينتهي" value={offer.ends_at} /> : <Text style={[styles.body, { color: colors.textSecondary }]}>بدون تاريخ انتهاء</Text>}
    </View>
    {!offer.items.length || unavailable ? <Text style={[styles.body, { color: colors.warningForeground }]}>
      {!offer.items.length ? 'لا توجد مكونات لهذا العرض.' : 'بعض مكونات العرض غير متاحة للشراء.'}
    </Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={expand} style={styles.componentToggle}>
      <Text style={[styles.strong, { color: colors.primary }]}>{expanded ? 'إخفاء المكونات' : `عرض المكونات (${offer.items.length.toLocaleString('ar-SY')})`}</Text>
      <AppIcon name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.primary} />
    </Pressable>
    {expanded ? offer.items.map(item => <Text key={item.id} style={[styles.body, { color: colors.textSecondary }]}>
      {item.item_role === 'buy' ? 'شراء: ' : item.item_role === 'reward' ? 'مكافأة: ' : ''}
      {item.quantity.toLocaleString('ar-SY', { maximumFractionDigits: 3 })} × {item.product?.title ?? 'منتج غير متاح للقراءة'}{item.product ? ` · ${item.product.selling_unit}` : ''}
    </Text>) : null}
    <View style={[styles.compactActions, { borderTopColor: colors.border }]}>
      <AppButton compact title="تعديل العرض" icon="pencil-outline" fullWidth={false} disabled={busy} onPress={edit} />
      <AppButton compact title="حذف نهائي" icon="trash-outline" variant="danger" fullWidth={false} disabled={busy} onPress={remove} />
    </View>
  </View>;
  return <View style={[styles.card, compact && styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
    <Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
    <View style={styles.actions}><Status label={offerTypeLabels[offer.offer_type]} tone="neutral" /><Status label={offerPhaseLabels[phase]} tone={phase === 'current' ? 'success' : phase === 'scheduled' ? 'info' : phase === 'expired' ? 'warning' : 'neutral'} /></View>
    <Text style={[styles.strong, { color: colors.primary }]}>{offerPriceSummary(offer)}</Text>
    {phase === 'scheduled' ? <Text style={[styles.body, { color: colors.textSecondary }]}>يبدأ: {formatLocalOfferEnd(offer.starts_at)}</Text> : null}
    <Text style={[styles.body, { color: colors.textSecondary }]}>{offer.ends_at ? `ينتهي: ${formatLocalOfferEnd(offer.ends_at)}` : 'بدون تاريخ انتهاء'}</Text>
    {!offer.items.length || unavailable ? <Text style={[styles.body, { color: colors.warningForeground }]}>هذا العرض غير قابل للشراء حاليًا؛ بعض مكوناته غير متاحة.</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={expand} style={[styles.expand, { borderColor: colors.borderStrong }]}><Text style={[styles.strong, { color: colors.primary }]}>{expanded ? 'إخفاء المكونات' : `عرض المكونات (${offer.items.length.toLocaleString('ar-SY')})`}</Text><AppIcon name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={colors.primary} /></Pressable>
    {(expanded ? offer.items : compact ? [] : offer.items.slice(0, 2)).map(item => <Text key={item.id} style={[styles.body, { color: colors.textSecondary }]}>{item.item_role === 'buy' ? 'شراء: ' : item.item_role === 'reward' ? 'مكافأة: ' : ''}{item.quantity.toLocaleString('ar-SY', { maximumFractionDigits: 3 })} × {item.product?.title ?? 'منتج غير متاح للقراءة'}{item.product ? ` · ${item.product.selling_unit}` : ''}</Text>)}
    <View style={[styles.actions, compact && styles.actionDivider, compact && { borderTopColor: colors.border }]}><AppButton design="refined" title="تعديل" variant="outline" fullWidth={false} disabled={busy} onPress={edit} /><AppButton design="refined" title="حذف نهائي" variant="danger" fullWidth={false} disabled={busy} onPress={remove} /></View>
  </View>;
}
function OfferDate({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const formatted = formatCompactOfferDate(value);
  if (!formatted) return null;
  return <Text style={[styles.body, { color: colors.textSecondary }]}>{label} {`\u2066${formatted}\u2069`}</Text>;
}
function Status({ label, tone }: { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' }) {
  const { colors } = useTheme();
  const backgroundColor = tone === 'neutral' ? colors.surfaceSecondary : colors[`${tone}Surface`];
  const color = tone === 'neutral' ? colors.textSecondary : colors[`${tone}Foreground`];
  return <View style={[styles.status, { backgroundColor }]}><Text style={[styles.strong, { color }]}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  compactContent: { maxWidth: MaxContentWidth, gap: Spacing.two, paddingTop: Spacing.three },
  compactStack: { gap: Spacing.two },
  toolbarLine: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  searchSlot: { flexGrow: 1, flexShrink: 1, flexBasis: 148, minHeight: ControlSizes.input,
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.one, paddingRight: Spacing.two,
    borderWidth: 1, borderRadius: Radius.md },
  searchInput: { ...Typography.input, flex: 1, minWidth: 0, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one, textAlign: 'right' },
  searchClear: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: 'center', justifyContent: 'center' },
  filterScroll: { direction: 'ltr', flexGrow: 0 },
  compactFilters: { direction: 'ltr', flexGrow: 1, flexDirection: 'row-reverse', flexWrap: 'nowrap', gap: Spacing.one },
  pager: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.one },
  pageSide: { flex: 1, minWidth: ControlSizes.touch, alignItems: 'center' },
  pageTouch: { minHeight: ControlSizes.touch, minWidth: ControlSizes.touch, maxWidth: '100%', justifyContent: 'center', alignItems: 'center' },
  pagePill: { ...Typography.label, textAlign: 'center', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full },
  compactChip: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.full, borderWidth: 1 },
  filterLabel: { ...Typography.label, textAlign: 'center' },
  compactCard: { padding: Spacing.three, gap: Spacing.two, borderRadius: Radius.md, borderWidth: 1 },
  compactImage: { width: 56, height: 56, borderRadius: Radius.md },
  productSummary: { direction: 'ltr', flexDirection: 'row-reverse', gap: Spacing.three, alignItems: 'flex-start' },
  summaryText: { flex: 1, minWidth: 0, gap: Spacing.one },
  summaryLine: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.one },
  offerValue: { alignItems: 'stretch', borderRadius: Radius.sm, padding: Spacing.two, gap: Spacing.half },
  componentToggle: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, minHeight: ControlSizes.touch },
  compactActions: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.one, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.one },
  compactSeparator: { height: Spacing.two },
  actionDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  screen: { flex: 1 }, content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 12 }, stack: { gap: 12 }, actionRow: { alignItems: 'stretch' }, filters: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }, chip: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.md }, body: { ...Typography.body, textAlign: 'right' }, strong: { ...Typography.bodyStrong, textAlign: 'right' }, title: { ...Typography.cardTitle, textAlign: 'right' }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: 16, gap: 10 }, productRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }, image: { width: 64, height: 64, borderRadius: Radius.md }, placeholder: { justifyContent: 'center', alignItems: 'center' }, identity: { flex: 1, gap: 6 }, actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, status: { alignSelf: 'flex-end', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 }, message: { padding: 12, borderWidth: 1, borderRadius: Radius.md }, loading: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 12, flexWrap: 'wrap' }, empty: { gap: 12, paddingVertical: 24, alignItems: 'center' }, footer: { gap: 12, paddingVertical: 16 }, separator: { height: 12 }, expand: { minHeight: 48, padding: 8, flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: Radius.md } });

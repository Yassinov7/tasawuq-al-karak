import { catalogApi, type CatalogOffer, type CatalogProduct, type CatalogStore } from '@/lib/merchant-catalog-api';
import { merchantCatalogRevision } from '@/lib/merchant-home';
import { formatSyp } from '@/lib/money';

export type CatalogKind = 'products' | 'offers';
export type ProductFilter = 'all' | 'available' | 'paused';
export type OfferFilter = 'all' | 'current' | 'scheduled' | 'expired' | 'paused';
export type CatalogScope = { query: string; filter: ProductFilter | OfferFilter };
export type CatalogRow = CatalogProduct | CatalogOffer;
export type CatalogCursor = { created_at: string; id: string };
export const catalogFreshnessMs = 30_000;
export function catalogTab(value: unknown): CatalogKind { return value === 'offers' ? 'offers' : 'products'; }
export function mergeCatalogRows(previous: CatalogRow[], rows: CatalogRow[]) { return [...new Map([...previous, ...rows].map(row => [row.id, row])).values()]; }
// Inactive takes precedence, then expired, then future start; filters use the same rules.
export function offerPhase(offer: Pick<CatalogOffer, 'is_active' | 'starts_at' | 'ends_at'>, now = Date.now()): Exclude<OfferFilter, 'all'> {
  if (!offer.is_active) return 'paused';
  if (offer.ends_at && Date.parse(offer.ends_at) <= now) return 'expired';
  return Date.parse(offer.starts_at) > now ? 'scheduled' : 'current';
}
export const offerPhaseLabels = { current: 'جارٍ', scheduled: 'مجدول', expired: 'منتهٍ', paused: 'متوقف' };
export const offerTypeLabels = { discount: 'تخفيض', bundle: 'حزمة', buy_x_get_y: 'اشترِ واحصل' };
export function offerPriceSummary(offer: CatalogOffer) {
  if (offer.offer_type === 'bundle') return offer.bundle_price === null ? 'سعر الحزمة غير متاح' : `سعر الحزمة ${formatSyp(offer.bundle_price)}`;
  if (offer.offer_type === 'discount') return offer.discount_value === null ? 'قيمة التخفيض غير متاحة' : offer.discount_method === 'percentage' ? `تخفيض ${offer.discount_value.toLocaleString('ar-SY')}٪` : `تخفيض ${formatSyp(offer.discount_value)} لكل وحدة`;
  return 'مكونات شراء ومكافأة حسب الكميات المحددة';
}
export type CatalogState = {
  store: CatalogStore | null; scope: CatalogScope; rows: CatalogRow[]; loading: boolean; validating: boolean;
  moreLoading: boolean; moreError: boolean; error: string; notice: string; hasMore: boolean; loadedAt: number;
  busy: boolean; pendingDelete: { id: string; storeId: string } | null;
};
type CatalogApi = typeof catalogApi;
export function createCatalogController(ownerId: string, kind: CatalogKind, initial: CatalogScope, publish: (state: CatalogState) => void,
  changed: (kind: CatalogKind, id: string) => Promise<void>, api: CatalogApi = catalogApi, clock = Date.now) {
  let state: CatalogState = { store: null, scope: initial, rows: [], loading: true, validating: true, moreLoading: false, moreError: false, error: '', notice: '', hasMore: false, loadedAt: 0, busy: false, pendingDelete: null };
  let active = false, generation = 0, locked = false;
  let cursor: CatalogCursor | null = null, pageAt = new Date(clock()).toISOString();
  let seenRevision = -1;
  const deleted = new Set<string>();
  const emit = (patch: Partial<CatalogState>) => { state = { ...state, ...patch }; if (active) publish(state); };
  const valid = (request: number) => active && request === generation;
  const resetReads = () => { generation++; emit({ loading: false, moreLoading: false }); };
  async function refresh(force = true) {
    if (!active || locked) return;
    const request = ++generation, scope = state.scope;
    emit({ validating: true, loading: true, moreLoading: false, moreError: false });
    try {
      const store = await api.store(ownerId);
      if (!valid(request)) return;
      const sameStore = state.store?.id === store?.id;
      if (!sameStore || !store) { cursor = null; emit({ rows: [], loadedAt: 0, hasMore: false, notice: '', pendingDelete: null }); }
      const revision = merchantCatalogRevision(ownerId);
      // An editor has confirmed a catalogue write: do not briefly re-expose old names/rows.
      if (state.loadedAt && seenRevision !== revision) { cursor = null; emit({ rows: [], loadedAt: 0, hasMore: false }); }
      emit({ store, validating: false });
      if (!store) { emit({ error: '' }); return; }
      if (!force && !state.error && sameStore && state.loadedAt && clock() - state.loadedAt < catalogFreshnessMs && seenRevision === revision) return;
      const at = new Date(clock()).toISOString();
      const rows = await api.page(kind, store.id, scope, null, at);
      if (!valid(request)) return;
      if (merchantCatalogRevision(ownerId) !== revision) { emit({ loadedAt: 0, rows: [], hasMore: false }); await refresh(); return; }
      pageAt = at; cursor = rows.at(-1) ?? null; seenRevision = revision;
      emit({ rows: mergeCatalogRows([], rows).filter(row => !deleted.has(`${store.id}:${row.id}`)), hasMore: rows.length > 0, loadedAt: clock(), error: '' });
    } catch {
      if (valid(request)) emit({ error: 'تعذر تحديث القائمة. النتائج السابقة، إن ظهرت، لم تُحدّث. أعد المحاولة.' });
    } finally { if (valid(request)) emit({ loading: false }); }
  }
  async function afterWrite(id: string, confirmedMessage: string) {
    let warning = '';
    try { await changed(kind, id); } catch { warning = ' تعذر تحديث كتالوج العميل؛ العملية محفوظة، وأعد تحديث العرض لاحقًا.'; }
    emit({ notice: confirmedMessage + warning, loadedAt: 0 });
  }
  async function checkScope(storeId: string) {
    const own = await api.store(ownerId);
    if (own?.id !== storeId) throw new Error('Changed store');
  }
  async function confirmDeletion(id: string, storeId: string) {
    deleted.add(`${storeId}:${id}`);
    resetReads();
    if (state.store?.id === storeId) emit({ rows: state.rows.filter(row => row.id !== id), pendingDelete: null });
    await afterWrite(id, 'تم حذف العرض نهائيًا. ملفات الوسائط تُترك للتنظيف الخادمي الآمن عند الحاجة.');
  }
  return {
    activate() { active = true; publish(state); },
    deactivate() { generation++; emit({ loading: false, moreLoading: false, validating: true }); active = false; },
    refresh,
    focus: () => refresh(false),
    async select(scope: CatalogScope) {
      if (state.scope.query === scope.query && state.scope.filter === scope.filter) return;
      resetReads(); cursor = null;
      emit({ scope, rows: [], loadedAt: 0, error: '', hasMore: false, moreError: false });
      await refresh();
    },
    async more(retry = false) {
      if (!active || locked || state.loading || state.validating || state.error || state.moreLoading || (state.moreError && !retry) || !state.hasMore || !state.store || !cursor) return;
      const request = generation, storeId = state.store.id;
      emit({ moreLoading: true, moreError: false });
      try {
        const rows = await api.page(kind, storeId, state.scope, cursor, pageAt);
        if (!valid(request)) return;
        if (merchantCatalogRevision(ownerId) !== seenRevision) { await refresh(); return; }
        cursor = rows.at(-1) ?? cursor;
        emit({ rows: mergeCatalogRows(state.rows, rows).filter(row => !deleted.has(`${storeId}:${row.id}`)), hasMore: rows.length > 0 });
      } catch { if (valid(request)) emit({ moreError: true }); }
      finally { if (valid(request)) emit({ moreLoading: false }); }
    },
    async availability(product: CatalogProduct) {
      if (!active || locked || state.validating || state.store?.id !== product.store_id || !state.rows.some(row => row.id === product.id)) return false;
      locked = true; const storeId = product.store_id;
      resetReads(); emit({ busy: true, notice: '' });
      let confirmed = false;
      try {
        await checkScope(storeId);
        await api.availability(product.id, storeId, !product.is_available); confirmed = true;
        if (state.store?.id === storeId) emit({ rows: state.rows.map(row => row.kind === 'products' && row.id === product.id ? { ...row, is_available: !product.is_available } : row).filter(row => row.kind !== 'products' || state.scope.filter === 'all' || row.is_available === (state.scope.filter === 'available')) });
        await afterWrite(product.id, product.is_available ? 'تم إيقاف المنتج. العروض التي تتضمنه لن تكون قابلة للشراء حتى إتاحته.' : 'تمت إتاحة المنتج للطلب.');
      } catch {
        try { await changed(kind, product.id); } catch { /* The following read remains available. */ }
        emit({ notice: confirmed ? 'تم حفظ التوفر، وتعذر تحديث العرض.' : 'تعذر تأكيد تغيير التوفر. حدّث القائمة للتحقق قبل إعادة المحاولة.', loadedAt: 0 });
      } finally {
        locked = false; emit({ busy: false });
        if (active) await refresh();
      }
      return confirmed;
    },
    async remove(offer: CatalogOffer) {
      if (!active || locked || state.validating || state.pendingDelete || state.store?.id !== offer.store_id || !state.rows.some(row => row.id === offer.id)) return false;
      locked = true; let confirmed = false, sent = false;
      resetReads(); emit({ busy: true, notice: '' });
      try {
        await checkScope(offer.store_id);
        if (!await api.exists(offer.id, offer.store_id)) { await confirmDeletion(offer.id, offer.store_id); confirmed = true; }
        else {
          sent = true;
          await api.remove(offer.id); confirmed = true;
          await confirmDeletion(offer.id, offer.store_id);
        }
      } catch {
        if (sent) {
          emit({ pendingDelete: { id: offer.id, storeId: offer.store_id } });
          try {
            await checkScope(offer.store_id);
            if (!await api.exists(offer.id, offer.store_id)) { confirmed = true; await confirmDeletion(offer.id, offer.store_id); }
          } catch { /* Uncertain: read-only verification, never replay the RPC. */ }
          if (!confirmed) { try { await changed(kind, offer.id); } catch { /* Retain uncertainty. */ } }
        }
        if (!confirmed) emit({ notice: sent ? 'تعذر تأكيد نتيجة الحذف. استخدم التحقق بالقراءة؛ لن نكرر RPC تلقائيًا.' : 'تعذر التحقق من ملكية العرض ووجوده. لم نبدأ الحذف.' });
      } finally {
        locked = false; emit({ busy: false });
        if (active) await refresh();
      }
      return confirmed;
    },
    async verifyDelete() {
      if (!active || locked || !state.pendingDelete) return;
      locked = true; emit({ busy: true });
      const pending = state.pendingDelete;
      try {
        await checkScope(pending.storeId);
        if (await api.exists(pending.id, pending.storeId)) emit({ notice: 'العرض ما زال ظاهرًا في آخر قراءة. نتيجة المحاولة لم تُحسم؛ لن نعيد الحذف تلقائيًا.' });
        else await confirmDeletion(pending.id, pending.storeId);
      } catch { emit({ notice: 'تعذر التحقق من نتيجة الحذف. أعد التحقق عند استقرار الاتصال.' }); }
      finally { locked = false; emit({ busy: false }); await refresh(); }
    },
  };
}

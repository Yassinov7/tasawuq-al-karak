export type FinancialReadState<T> = { data: T | null; loading: boolean; validating: boolean; error: string; loadedAt: number };
/** One controller per owner/document/filter/page. A failed read may retain data only within that exact scope. */
export function createFinancialReader<T,I>(identity: (signal: AbortSignal) => Promise<I>, read: (identity:I,signal: AbortSignal) => Promise<T>, publish: (state: FinancialReadState<T>) => void) {
  let state: FinancialReadState<T> = { data: null, loading: true, validating: true, error: '', loadedAt: 0 };
  let active = false, generation = 0, scope: string | null = null, abort: AbortController | null = null;
  const emit = (patch: Partial<FinancialReadState<T>>) => { state = { ...state, ...patch }; if (active) publish(state); };
  return {
    activate() { active = true; publish(state); },
    deactivate() { generation++; abort?.abort(); emit({ validating: true, loading: false }); active = false; },
    async load() {
      if (!active) return;
      abort?.abort(); abort = new AbortController(); const signal = abort.signal, request = ++generation;
      const current = () => active && request === generation;
      emit({ loading: true, validating: true });
      try {
        const nextIdentity = await identity(signal), nextScope=JSON.stringify(nextIdentity); if (!current()) return;
        if (nextScope !== scope) { scope = nextScope; emit({ data: null, loadedAt: 0 }); }
        emit({ validating: false });
        const data = await read(nextIdentity,signal); if (current()) emit({ data, error: '', loadedAt: Date.now() });
      } catch (failure) {
        if (current()) emit({ error: state.validating ? 'تعذر التحقق من الحساب؛ لم نعرض البيانات السابقة. أعد المحاولة.' : state.data ? 'تعذر تحديث البيانات؛ المعروض هو آخر قراءة ناجحة ضمن النطاق نفسه.' : failure instanceof Error ? failure.message : 'تعذر تحميل البيانات المالية.' });
      } finally { if (current()) emit({ loading: false }); }
    },
  };
}

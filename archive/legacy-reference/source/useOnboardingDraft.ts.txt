import { useCallback, useEffect, useRef, useState } from "react";
import { readLocalCache, writeLocalCache, invalidateLocalCache } from "@/lib/local-cache";

// Account-scoped, non-password fields only. Keep the entry snapshot for explicit discard.
export function useOnboardingDraft<T extends object>(key: string, empty: T) {
  const [value, setValue] = useState(empty);
  const [baseline, setBaseline] = useState(empty);
  const [ready, setReady] = useState(false);
  const emptyValue = useRef(empty);
  const initial = useRef<T>(empty);
  const existed = useRef(false);
  const sequence = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void readLocalCache<T>(key).then((saved) => {
      if (!active) return;
      existed.current = Boolean(saved);
      initial.current = saved ? { ...emptyValue.current, ...saved } : emptyValue.current;
      setValue(initial.current);
      setBaseline(initial.current);
      setReady(true);
    });
    return () => { active = false; };
  }, [key]);
  // Only explicit save commits the reference. Typing must not overwrite it.
  const save = async () => {
    const saved = { ...value };
    const operation = sequence.current.then(() => writeLocalCache(key, saved, { requirePersistence: true }));
    sequence.current = operation.catch(() => undefined);
    await operation;
    initial.current = saved; existed.current = true; setBaseline(saved);
  };
  const discard = async () => {
    await sequence.current;
    if (existed.current) await writeLocalCache(key, initial.current, { requirePersistence: true });
    else await invalidateLocalCache(key, { requirePersistence: true });
    setValue(initial.current); setBaseline(initial.current);
  };
  const clear = async () => { await sequence.current; await invalidateLocalCache(key); };
  const change = useCallback(<K extends keyof T>(field: K, next: T[K] | ((previous: T[K]) => T[K])) => setValue((old) => ({ ...old, [field]: typeof next === "function" ? (next as (previous: T[K]) => T[K])(old[field]) : next })), []);
  return { value, change, ready, save, discard, clear, dirty: JSON.stringify(value) !== JSON.stringify(baseline) };
}

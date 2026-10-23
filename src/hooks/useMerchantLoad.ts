import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

/** Focus refresh with stale-response protection; no persisted financial/account snapshot. */
export function useMerchantLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const next = await loader();
      if (request === sequence.current) setData(next);
    } catch (failure) {
      if (request === sequence.current) setError(failure instanceof Error ? failure.message : "تعذر تحميل البيانات. تحقق من الاتصال وحاول مجددًا.");
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [loader]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { sequence.current += 1; };
  }, [load]));
  return { data, loading, error, load };
}

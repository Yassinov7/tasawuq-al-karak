import { useLayoutEffect, useMemo } from "react";
import { createReadScope } from "@/lib/read-scope";
export function useReadScope(scope: string) {
  const guard = useMemo(() => ({ ...createReadScope(), scope }), [scope]);
  useLayoutEffect(() => { guard.open(); return () => guard.close(); }, [guard]);
  return guard;
}

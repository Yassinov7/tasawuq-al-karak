import { usePathname, useRouter } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAccountRoute } from "@/lib/account-routing";
import { backDestination } from "@/lib/safe-back";

/** Resolve the current account only when there is no navigation history. */
export function useSafeBack() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const current = useRef(user?.id);
  const alive = useRef(true);
  const generation = useRef(0);
  useLayoutEffect(() => {
    generation.current++;
    current.current = user?.id;
    alive.current = true;
    return () => { alive.current = false; };
  }, [user?.id, pathname, loading]);
  return async () => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (router.canGoBack()) { router.back(); return; }
    const owner = user.id;
    const token = generation.current;
    try {
      const account = await getAccountRoute(owner);
      if (alive.current && generation.current === token && current.current === owner) router.replace(backDestination(pathname, account));
    } catch {
      // The entry screen already offers session/account recovery on read failure.
      if (alive.current && generation.current === token && current.current === owner) router.replace("/");
    }
  };
}

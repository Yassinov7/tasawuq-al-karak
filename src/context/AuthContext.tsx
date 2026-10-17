import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initializationError: boolean;
  retrySession: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState(false);
  const mountedRef = useRef(false);
  const authEventVersionRef = useRef(0);
  const requestVersionRef = useRef(0);
  const effectVersionRef = useRef(0);

  const loadSession = useCallback(async () => {
    const authEventVersion = authEventVersionRef.current;
    const requestVersion = ++requestVersionRef.current;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      if (authEventVersionRef.current !== authEventVersion) return;

      if (error) {
        setInitializationError(true);
      } else {
        setSession(data.session);
      }
    } catch {
      if (
        mountedRef.current &&
        authEventVersionRef.current === authEventVersion
      ) {
        setInitializationError(true);
      }
    } finally {
      if (
        mountedRef.current &&
        requestVersionRef.current === requestVersion
      ) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const effectVersion = ++effectVersionRef.current;
    mountedRef.current = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (
        !mountedRef.current ||
        effectVersionRef.current !== effectVersion
      ) {
        return;
      }
      requestVersionRef.current += 1;
      authEventVersionRef.current += 1;
      setSession(nextSession);
      setInitializationError(false);
      setLoading(false);
    });
    void Promise.resolve().then(() => {
      if (
        mountedRef.current &&
        effectVersionRef.current === effectVersion
      ) {
        void loadSession();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const retrySession = useCallback(async () => {
    setLoading(true);
    setInitializationError(false);
    await loadSession();
  }, [loadSession]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      initializationError,
      retrySession,
    }),
    [initializationError, loading, retrySession, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";

type FavoritesContextValue = {
  favoriteIds: string[];
  ready: boolean;
  persistenceError: string | null;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  clearFavorites: () => void;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(
  undefined,
);

type FavoritesProviderProps = {
  children: ReactNode;
};

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const { loading: authLoading, user } = useAuth();
  const scope = authLoading ? "loading" : user?.id ?? "guest";
  const [snapshot, setSnapshot] = useState<{ scope: string; ids: string[] }>();
  const [storageIssue, setStorageIssue] = useState<{ scope: string; message: string }>();
  const requestVersion = useRef(0);
  const ready = snapshot?.scope === scope;
  const favoriteIds = ready ? snapshot.ids : [];
  const persistenceError = storageIssue?.scope === scope ? storageIssue.message : null;

  useEffect(() => {
    if (authLoading) return;
    const request = ++requestVersion.current;
    if (!user) {
      setSnapshot({ scope, ids: [] });
      return;
    }
    void AsyncStorage.getItem(`@tasawuq/favorites-v1/${user.id}`)
      .then((stored) => {
        if (request !== requestVersion.current) return;
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        const ids = Array.isArray(parsed)
          ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))]
          : [];
        setSnapshot({ scope, ids });
        setStorageIssue(undefined);
      })
      .catch(() => {
        if (request === requestVersion.current) {
          setSnapshot({ scope, ids: [] });
          setStorageIssue({ scope, message: "تعذر قراءة المفضلة المحفوظة على هذا الجهاز." });
        }
      });
  }, [authLoading, scope, user]);

  const updateFavorites = useCallback((update: (ids: string[]) => string[]) => {
    requestVersion.current += 1;
    setSnapshot((current) => {
      const ids = update(current?.scope === scope ? current.ids : []);
      if (user) void AsyncStorage.setItem(`@tasawuq/favorites-v1/${user.id}`, JSON.stringify(ids))
        .then(() => setStorageIssue((issue) => issue?.scope === scope ? undefined : issue))
        .catch(() => setStorageIssue({ scope, message: "تعذر حفظ آخر تعديل في المفضلة على هذا الجهاز." }));
      return { scope, ids };
    });
  }, [scope, user]);

  const toggleFavorite = useCallback((productId: string) => {
    updateFavorites((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }

      return [...current, productId];
    });
  }, [updateFavorites]);

  const removeFavorite = useCallback((productId: string) => {
    updateFavorites((current) => current.filter((id) => id !== productId));
  }, [updateFavorites]);

  const clearFavorites = useCallback(() => updateFavorites(() => []), [updateFavorites]);

  const value = useMemo(() => {
    const isFavorite = (productId: string) => favoriteIds.includes(productId);

    return {
      favoriteIds,
      ready,
      persistenceError,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      clearFavorites,
    };
  }, [clearFavorites, favoriteIds, persistenceError, ready, removeFavorite, toggleFavorite]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used inside FavoritesProvider");
  }

  return context;
}

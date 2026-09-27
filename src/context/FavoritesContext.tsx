import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type FavoritesContextValue = {
  favoriteIds: string[];
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
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const toggleFavorite = (productId: string) => {
    setFavoriteIds((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }

      return [...current, productId];
    });
  };

  const removeFavorite = (productId: string) => {
    setFavoriteIds((current) => current.filter((id) => id !== productId));
  };

  const clearFavorites = () => {
    setFavoriteIds([]);
  };

  const value = useMemo(() => {
    const isFavorite = (productId: string) => favoriteIds.includes(productId);

    return {
      favoriteIds,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      clearFavorites,
    };
  }, [favoriteIds]);

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

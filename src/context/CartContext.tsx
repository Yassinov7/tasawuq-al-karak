import {
    createContext,
    PropsWithChildren,
    useContext,
    useMemo,
    useState,
} from "react";

import { products, type Product } from "@/constants/catalog";

export type CartItem = {
  productId: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number) => void;
  increaseItem: (productId: string) => void;
  decreaseItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: Product, quantity = 1) => {
    if (!product.available || quantity < 1) {
      return;
    }

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.productId === product.id,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
              }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          productId: product.id,
          quantity,
        },
      ];
    });
  };

  const increaseItem = (productId: string) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item,
      ),
    );
  };

  const decreaseItem = (productId: string) => {
    setItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.productId !== productId) {
          return [item];
        }

        if (item.quantity <= 1) {
          return [];
        }

        return [
          {
            ...item,
            quantity: item.quantity - 1,
          },
        ];
      }),
    );
  };

  const removeItem = (productId: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce((total, item) => {
        const product = products.find(
          (productItem) => productItem.id === item.productId,
        );

        if (!product) {
          return total;
        }

        return total + product.price * item.quantity;
      }, 0),
    [items],
  );

  const value = useMemo(() => {
    const getQuantity = (productId: string) => {
      return items.find((item) => item.productId === productId)?.quantity ?? 0;
    };

    return {
      items,
      itemCount,
      subtotal,
      addItem,
      increaseItem,
      decreaseItem,
      removeItem,
      clearCart,
      getQuantity,
    };
  }, [items, itemCount, subtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart يجب أن يستخدم داخل CartProvider");
  }

  return context;
}

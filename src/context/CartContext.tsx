import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import type { Product } from "@/constants/catalog";
import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/context/CatalogContext";
import { supabase } from "@/lib/supabase";

export type CartItem = { productId: string; storeProductId: string; quantity: number };
type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currency: "SYP" | "USD";
  isLoading: boolean;
  error: string | null;
  addItem: (product: Product, quantity?: number) => boolean;
  increaseItem: (productId: string) => void;
  decreaseItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const { products, isLoading: catalogLoading } = useCatalog();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const cartIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) {
        cartIdRef.current = null;
        setCartId(null);
        setItems([]);
        setIsLoading(false);
        return;
      }
      if (catalogLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        const existing = await supabase.from("carts").select("id").eq("customer_id", userId).maybeSingle();
        if (existing.error) throw existing.error;
        let currentCartId = existing.data?.id as string | undefined;
        if (!currentCartId) {
          const created = await supabase.from("carts").insert({ customer_id: userId }).select("id").single();
          if (created.error) throw created.error;
          currentCartId = created.data.id as string;
        }
        const result = await supabase.from("cart_items").select("store_product_id,quantity").eq("cart_id", currentCartId);
        if (result.error) throw result.error;
        if (!active) return;
        cartIdRef.current = currentCartId;
        setCartId(currentCartId);
        const rows = (result.data ?? []) as { store_product_id: string; quantity: number | string }[];
        setItems(rows.flatMap((row) => {
          const product = products.find((entry) => entry.storeProductId === row.store_product_id);
          return product ? [{ productId: product.id, storeProductId: row.store_product_id, quantity: Number(row.quantity) }] : [];
        }));
      } catch {
        if (active) setError("تعذر مزامنة السلة. تحقق من الاتصال وحاول مجدداً.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const timer = setTimeout(() => { void load(); }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [userId, catalogLoading, products]);

  const persistQuantity = (storeProductId: string, quantity: number) => {
    const currentCartId = cartIdRef.current;
    if (!currentCartId) return;
    const mutation = quantity > 0
      ? supabase.from("cart_items").upsert({ cart_id: currentCartId, store_product_id: storeProductId, quantity }, { onConflict: "cart_id,store_product_id" })
      : supabase.from("cart_items").delete().eq("cart_id", currentCartId).eq("store_product_id", storeProductId);
    void mutation.then(({ error: mutationError }) => {
      if (mutationError) setError("تعذر حفظ التغيير في السلة. حاول مرة أخرى.");
      else setError(null);
    });
  };

  const addItem = (product: Product, quantity = product.minimumQuantity ?? 1) => {
    if (isLoading || !cartId || !product.storeProductId || !product.available || !Number.isFinite(quantity) || quantity < (product.minimumQuantity ?? 1)) return false;
    const currentCurrency = items.length ? products.find((item) => item.id === items[0].productId)?.currency ?? "SYP" : product.currency ?? "SYP";
    if (currentCurrency !== (product.currency ?? "SYP")) return false;
    const currentQuantity = items.find((item) => item.productId === product.id)?.quantity ?? 0;
    const nextQuantity = Number((currentQuantity + quantity).toFixed(3));
    setItems((current) => current.some((item) => item.productId === product.id)
      ? current.map((item) => item.productId === product.id ? { ...item, quantity: nextQuantity } : item)
      : [...current, { productId: product.id, storeProductId: product.storeProductId!, quantity: nextQuantity }]);
    persistQuantity(product.storeProductId, nextQuantity);
    return true;
  };

  const increaseItem = (productId: string) => {
    const item = items.find((entry) => entry.productId === productId);
    const product = products.find((entry) => entry.id === productId);
    if (!item || !product) return;
    const nextQuantity = Number((item.quantity + (product.quantityStep ?? 1)).toFixed(3));
    setItems((current) => current.map((entry) => entry.productId === productId ? { ...entry, quantity: nextQuantity } : entry));
    persistQuantity(item.storeProductId, nextQuantity);
  };

  const decreaseItem = (productId: string) => {
    const item = items.find((entry) => entry.productId === productId);
    const product = products.find((entry) => entry.id === productId);
    if (!item) return;
    const minimum = product?.minimumQuantity ?? 1;
    const step = product?.quantityStep ?? 1;
    const nextQuantity = item.quantity - step < minimum - 0.000001 ? 0 : Number((item.quantity - step).toFixed(3));
    setItems((current) => current.flatMap((entry) => entry.productId !== productId ? [entry] : nextQuantity > 0 ? [{ ...entry, quantity: nextQuantity }] : []));
    persistQuantity(item.storeProductId, nextQuantity);
  };

  const removeItem = (productId: string) => {
    const item = items.find((entry) => entry.productId === productId);
    setItems((current) => current.filter((entry) => entry.productId !== productId));
    if (item) persistQuantity(item.storeProductId, 0);
  };

  const clearCart = () => {
    setItems([]);
    if (cartIdRef.current) void supabase.from("cart_items").delete().eq("cart_id", cartIdRef.current);
  };

  const itemCount = items.length;
  const subtotal = items.reduce((total, item) => total + (products.find((entry) => entry.id === item.productId)?.price ?? 0) * item.quantity, 0);
  const currency = items.length ? products.find((product) => product.id === items[0].productId)?.currency ?? "SYP" : "SYP";
  const value: CartContextValue = {
    items, itemCount, subtotal, currency, isLoading, error, addItem, increaseItem, decreaseItem, removeItem, clearCart,
    getQuantity: (productId) => items.find((item) => item.productId === productId)?.quantity ?? 0,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart يجب أن يستخدم داخل CartProvider");
  return context;
}

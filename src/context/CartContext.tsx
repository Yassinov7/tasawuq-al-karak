import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Product } from "@/constants/catalog";
import { useAuth } from "@/context/AuthContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import {
  normalizeCatalogQuantity,
  snapCatalogQuantity,
} from "@/lib/catalog-quantity";
import { calculateCustomerOffer } from "@/lib/customer-offers";
import { supabase } from "@/lib/supabase";

export type CartItem = {
  productId: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  selectedOfferIds: string[];
  itemCount: number;
  subtotal: number;
  currency: "SYP" | "USD" | null;
  hasMixedCurrencies: boolean;
  loading: boolean;
  syncError: string | null;
  addItem: (product: Product, quantity?: number) => Promise<boolean>;
  addOffer: (offerId: string) => Promise<boolean>;
  removeOffer: (offerId: string) => Promise<void>;
  increaseItem: (productId: string) => Promise<void>;
  decreaseItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearAfterOrder: () => void;
  flush: () => Promise<void>;
  retrySync: () => Promise<void>;
  getQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تعذرت مزامنة السلة.";
}

export function CartProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const { offers, products } = useCustomerCatalog();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const cartIdRef = useRef<string | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  const selectedOfferIdsRef = useRef<string[]>([]);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const writeErrorRef = useRef<unknown>(null);
  const userIdRef = useRef<string | null>(null);
  const authReady = !authLoading && loadedUserId === (user?.id ?? null);

  const updateLocalItems = useCallback((nextItems: CartItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);
  const updateSelectedOffers = useCallback((nextOfferIds: string[]) => {
    selectedOfferIdsRef.current = nextOfferIds;
    setSelectedOfferIds(nextOfferIds);
  }, []);

  const loadCart = useCallback(async (userId: string) => {
    if (userIdRef.current !== userId) return;
    const { data: cart, error: cartError } = await supabase
      .from("customer_carts")
      .select("id")
      .eq("customer_id", userId)
      .maybeSingle();
    if (userIdRef.current !== userId) return;
    if (cartError) throw cartError;

    cartIdRef.current = cart?.id ?? null;
    if (!cart) {
      updateLocalItems([]);
      updateSelectedOffers([]);
      return;
    }

    const [itemsResult, offersResult] = await Promise.all([
      supabase
        .from("customer_cart_items")
        .select("product_id,quantity")
        .eq("cart_id", cart.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("customer_cart_offer_selections")
        .select("offer_id")
        .eq("cart_id", cart.id),
    ]);
    if (userIdRef.current !== userId) return;
    if (itemsResult.error) throw itemsResult.error;
    if (offersResult.error) throw offersResult.error;

    updateLocalItems(
      (itemsResult.data ?? []).map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
      })),
    );
    updateSelectedOffers((offersResult.data ?? []).map((item) => item.offer_id));
  }, [updateLocalItems, updateSelectedOffers]);

  useEffect(() => {
    if (authLoading) return;
    const userId = user?.id ?? null;
    let alive = true;
    const timer = setTimeout(() => {
      userIdRef.current = userId;
      setLoadedUserId(userId);
      cartIdRef.current = null;
      updateLocalItems([]);
      updateSelectedOffers([]);
      setSyncError(null);
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      void loadCart(userId)
        .catch((error: unknown) => {
          if (alive) setSyncError(errorMessage(error));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      });

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [authLoading, user?.id, loadCart, updateLocalItems, updateSelectedOffers]);

  const ensureCart = useCallback(async (userId: string) => {
    if (userIdRef.current !== userId) {
      throw new Error("تغير الحساب؛ أعد تحميل السلة قبل المتابعة.");
    }
    if (cartIdRef.current) return cartIdRef.current;

    const { data, error } = await supabase
      .from("customer_carts")
      .upsert({ customer_id: userId }, { onConflict: "customer_id" })
      .select("id")
      .single();
    if (error) throw error;
    if (userIdRef.current !== userId) {
      throw new Error("تغير الحساب؛ أعد تحميل السلة قبل المتابعة.");
    }

    cartIdRef.current = data.id;
    return data.id;
  }, []);

  const enqueueWrite = useCallback((userId: string, write: () => Promise<void>) => {
    const task = queueRef.current.then(async () => {
      try {
        if (userIdRef.current !== userId) {
          throw new Error("تغير الحساب؛ أعد تحميل السلة قبل المتابعة.");
        }
        await write();
        await loadCart(userId);
        writeErrorRef.current = null;
        setSyncError(null);
        return true;
      } catch (error: unknown) {
        writeErrorRef.current = error;
        setSyncError(errorMessage(error));
        if (userIdRef.current === userId) {
          try {
            await loadCart(userId);
          } catch (reloadError) {
            writeErrorRef.current = reloadError;
            setSyncError(errorMessage(reloadError));
          }
        }
        return false;
      }
    });
    queueRef.current = task.then(() => undefined);
    return task;
  }, [loadCart]);

  const saveItem = useCallback((productId: string, quantity: number) => {
    if (!authReady) {
      setSyncError("جارٍ تحديث الحساب؛ انتظر تحميل السلة قبل تعديلها.");
      return Promise.resolve(false);
    }
    const userId = userIdRef.current;
    if (!userId) {
      setSyncError("سجّل الدخول أولًا لحفظ المنتجات في سلتك.");
      return Promise.resolve(false);
    }
    const nextItems = itemsRef.current.filter((item) => item.productId !== productId);
    if (quantity > 0) nextItems.push({ productId, quantity });
    updateLocalItems(nextItems);

    return enqueueWrite(userId, async () => {
      const cartId = await ensureCart(userId);
      const result = quantity > 0
        ? await supabase.from("customer_cart_items").upsert(
            { cart_id: cartId, product_id: productId, quantity },
            { onConflict: "cart_id,product_id" },
          )
        : await supabase.from("customer_cart_items").delete()
            .eq("cart_id", cartId)
            .eq("product_id", productId);
      if (result.error) throw result.error;
    });
  }, [authReady, enqueueWrite, ensureCart, updateLocalItems]);

  const addItem = useCallback(async (product: Product, quantity?: number) => {
    if (loading || !authReady) {
      setSyncError("جارٍ تحميل سلتك، حاول مجددًا بعد لحظات.");
      return false;
    }
    if (!userIdRef.current) {
      setSyncError("سجّل الدخول أولًا لحفظ المنتجات في سلتك.");
      return false;
    }
    if (!product.available) {
      setSyncError("هذا المنتج غير متاح حاليًا.");
      return false;
    }

    const currentCurrencies = new Set([
      ...itemsRef.current.map((item) =>
        products.find((candidate) => candidate.id === item.productId)?.currency ?? "SYP",
      ),
      ...selectedOfferIdsRef.current.flatMap((offerId) => {
        const offer = offers.find((candidate) => candidate.id === offerId);
        return offer ? [offer.currency] : [];
      }),
    ]);
    if (currentCurrencies.size > 0 && !currentCurrencies.has(product.currency ?? "SYP")) {
      setSyncError("لا يمكن جمع منتجات بعملات مختلفة في السلة نفسها.");
      return false;
    }

    const current = itemsRef.current.find((item) => item.productId === product.id);
    const minimum = product.minimumQuantity ?? 1;
    const step = product.quantityStep ?? 1;
    const requested = quantity ?? minimum;
    const nextQuantity = snapCatalogQuantity(requested, minimum, step);
    return await saveItem(
      product.id,
      normalizeCatalogQuantity((current?.quantity ?? 0) + nextQuantity),
    );
  }, [authReady, loading, offers, products, saveItem]);

  const addOffer = useCallback(async (offerId: string) => {
    if (loading || !authReady) {
      setSyncError("جارٍ تحميل سلتك، حاول مجددًا بعد لحظات.");
      return false;
    }
    const userId = userIdRef.current;
    const offer = offers.find((item) => item.id === offerId);
    if (!userId) {
      setSyncError("سجّل الدخول أولًا لإضافة العرض إلى سلتك.");
      return false;
    }
    if (!offer || offer.items.some((item) => !item.product.available)) {
      setSyncError("هذا العرض لم يعد متاحًا.");
      return false;
    }
    if (offer.items.some((item) => item.product.currency !== offer.currency)) {
      setSyncError("عملة هذا العرض لا تطابق عملة أحد منتجاته؛ لا يمكن إضافته للسلة.");
      return false;
    }

    const currentCurrencies = new Set([
      ...itemsRef.current.map((item) =>
        products.find((product) => product.id === item.productId)?.currency ?? "SYP",
      ),
      ...selectedOfferIdsRef.current.flatMap((selectedId) => {
        const selected = offers.find((item) => item.id === selectedId);
        return selected ? [selected.currency] : [];
      }),
    ]);
    if (currentCurrencies.size > 0 && !currentCurrencies.has(offer.currency)) {
      setSyncError("لا يمكن جمع منتجات أو عروض بعملات مختلفة في السلة نفسها.");
      return false;
    }
    if (selectedOfferIdsRef.current.includes(offerId)) {
      setSyncError("هذا العرض موجود بالفعل في سلتك.");
      return false;
    }

    updateSelectedOffers([...selectedOfferIdsRef.current, offerId]);
    return enqueueWrite(userId, async () => {
      const { error } = await supabase.rpc("add_customer_cart_offer", {
        target_offer: offerId,
      });
      if (error) throw error;
    });
  }, [authReady, enqueueWrite, loading, offers, products, updateSelectedOffers]);

  const removeOffer = useCallback(async (offerId: string) => {
    if (!authReady) {
      setSyncError("جارٍ تحديث الحساب؛ انتظر تحميل السلة قبل تعديلها.");
      return;
    }
    const userId = userIdRef.current;
    if (!userId) {
      setSyncError("سجّل الدخول أولًا لمزامنة السلة.");
      return;
    }
    updateSelectedOffers(selectedOfferIdsRef.current.filter((id) => id !== offerId));
    await enqueueWrite(userId, async () => {
      const { error } = await supabase.rpc("remove_customer_cart_offer", {
        target_offer: offerId,
      });
      if (error) throw error;
    });
  }, [authReady, enqueueWrite, updateSelectedOffers]);

  const increaseItem = useCallback(async (productId: string) => {
    const current = itemsRef.current.find((item) => item.productId === productId);
    const product = products.find((item) => item.id === productId);
    if (!current || !product) return;
    await saveItem(
      productId,
      normalizeCatalogQuantity(current.quantity + (product.quantityStep ?? 1)),
    );
  }, [products, saveItem]);

  const decreaseItem = useCallback(async (productId: string) => {
    const current = itemsRef.current.find((item) => item.productId === productId);
    const product = products.find((item) => item.id === productId);
    if (!current || !product) return;
    const minimum = product.minimumQuantity ?? 1;
    const step = product.quantityStep ?? 1;
    const nextQuantity = normalizeCatalogQuantity(current.quantity - step);
    await saveItem(productId, nextQuantity < minimum ? 0 : nextQuantity);
  }, [products, saveItem]);

  const removeItem = useCallback(async (productId: string) => {
    await saveItem(productId, 0);
  }, [saveItem]);

  const clearCart = useCallback(async () => {
    if (!authReady) {
      setSyncError("جارٍ تحديث الحساب؛ انتظر تحميل السلة قبل تعديلها.");
      return;
    }
    const userId = userIdRef.current;
    if (!userId) {
      setSyncError("سجّل الدخول أولًا لمزامنة السلة.");
      return;
    }
    const offerIds = [...selectedOfferIdsRef.current];
    updateLocalItems([]);
    updateSelectedOffers([]);
    await enqueueWrite(userId, async () => {
      const cartId = await ensureCart(userId);
      const itemsResult = await supabase
        .from("customer_cart_items")
        .delete()
        .eq("cart_id", cartId);
      if (itemsResult.error) throw itemsResult.error;
      const offerResults = await Promise.all(
        offerIds.map((offerId) =>
          supabase.rpc("remove_customer_cart_offer", { target_offer: offerId }),
        ),
      );
      const failedOffer = offerResults.find((result) => result.error);
      if (failedOffer?.error) throw failedOffer.error;
    });
  }, [authReady, enqueueWrite, ensureCart, updateLocalItems, updateSelectedOffers]);

  const clearAfterOrder = useCallback(() => {
    updateLocalItems([]);
    updateSelectedOffers([]);
    setSyncError(null);
  }, [updateLocalItems, updateSelectedOffers]);

  const flush = useCallback(async () => {
    if (!authReady) {
      throw new Error("جارٍ تحديث الحساب؛ انتظر تحميل السلة قبل المتابعة.");
    }
    await queueRef.current;
    if (writeErrorRef.current) {
      throw new Error(errorMessage(writeErrorRef.current));
    }
    if (syncError) throw new Error(syncError);
  }, [authReady, syncError]);
  const retrySync = useCallback(async () => {
    if (!authReady) {
      setSyncError("جارٍ تحديث الحساب؛ انتظر تحميل السلة قبل إعادة المحاولة.");
      return;
    }
    const userId = userIdRef.current;
    if (!userId) {
      setSyncError("يجب تسجيل الدخول لمزامنة السلة.");
      return;
    }
    const task = queueRef.current.then(async () => {
      if (userIdRef.current !== userId) return;
      await loadCart(userId);
      writeErrorRef.current = null;
      setSyncError(null);
    });
    queueRef.current = task.then(() => undefined, () => undefined);
    try {
      await task;
    } catch (error) {
      writeErrorRef.current = error;
      setSyncError(errorMessage(error));
    }
  }, [authReady, loadCart]);

  const selectedOffers = useMemo(
    () => selectedOfferIds.flatMap((id) => {
      const offer = offers.find((candidate) => candidate.id === id);
      return offer ? [offer] : [];
    }),
    [offers, selectedOfferIds],
  );
  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0) +
      selectedOffers.length,
    [items, selectedOffers],
  );
  const currencies = useMemo(
    () => new Set([
      ...items.map((item) => products.find((product) => product.id === item.productId)?.currency ?? "SYP"),
      ...selectedOffers.map((offer) => offer.currency),
    ]),
    [items, products, selectedOffers],
  );
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const hasMixedCurrencies = currencies.size > 1;
  const subtotal = useMemo(() => {
    if (hasMixedCurrencies) return 0;
    const productSubtotal = items.reduce((total, item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const lineTotal = Math.round((product?.price ?? 0) * item.quantity * 100) / 100;
      return total + lineTotal;
    }, 0);
    const offerSubtotal = selectedOffers.reduce(
      (total, offer) => total + calculateCustomerOffer(offer).finalTotal,
      0,
    );
    return Math.round((productSubtotal + offerSubtotal) * 100) / 100;
  }, [hasMixedCurrencies, items, products, selectedOffers]);
  const cartReady = authReady && !loading;

  const value = useMemo<CartContextValue>(() => ({
    items: cartReady ? items : [],
    selectedOfferIds: cartReady ? selectedOfferIds : [],
    itemCount: cartReady ? itemCount : 0,
    subtotal: cartReady ? subtotal : 0,
    currency: cartReady ? currency : null,
    hasMixedCurrencies: cartReady && hasMixedCurrencies,
    loading: !cartReady,
    syncError,
    addItem,
    addOffer,
    removeOffer,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    clearAfterOrder,
    flush,
    retrySync,
    getQuantity: (productId) =>
      cartReady
        ? items.find((item) => item.productId === productId)?.quantity ?? 0
        : 0,
  }), [
    cartReady,
    items,
    selectedOfferIds,
    itemCount,
    subtotal,
    currency,
    hasMixedCurrencies,
    syncError,
    addItem,
    addOffer,
    removeOffer,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    clearAfterOrder,
    flush,
    retrySync,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart يجب أن يستخدم داخل CartProvider");
  }
  return context;
}

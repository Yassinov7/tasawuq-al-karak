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

import type { Product } from "@/types/catalog";
import { useAuth } from "@/context/AuthContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import {
  normalizeCatalogQuantity,
  snapCatalogQuantity,
} from "@/lib/catalog-quantity";
import { calculateCustomerOffer } from "@/lib/customer-offers";
import { isCartReadCurrent, updateOrderedCartItem } from "@/lib/cart-order";
import { supabase } from "@/lib/supabase";
import { purchaseAvailabilityMessage } from "@/lib/purchase-availability";

export type CartItem = {
  productId: string;
  quantity: number;
};

type CartContextValue = {
  scope: string | null;
  items: CartItem[];
  selectedOfferIds: string[];
  itemCount: number;
  subtotal: number;
loading: boolean;
  refreshing: boolean;
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
  revalidate: () => Promise<void>;
  getQuantity: (productId: string) => number;
};

type CartReadReason =
  | "initial"
  | "stale-revalidate"
  | "mutation"
  | "mutation-rollback"
  | "retry";

const CartContext = createContext<CartContextValue | undefined>(undefined);

function errorMessage(error: unknown) {
  return purchaseAvailabilityMessage(error) ?? (error instanceof Error ? error.message : "تعذرت مزامنة السلة.");
}

export function CartProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const { offers, products, refresh } = useCustomerCatalog();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const cartIdRef = useRef<string | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  const selectedOfferIdsRef = useRef<string[]>([]);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const writeErrorRef = useRef<unknown>(null);
  const userIdRef = useRef<string | null>(null);
  const cartReadRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const lastValidatedRef = useRef<{ userId: string; at: number } | null>(null);
  const mutationVersionRef = useRef(0);
  const authReady = !authLoading && loadedUserId === (user?.id ?? null);

  const updateLocalItems = useCallback((nextItems: CartItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);
  const updateSelectedOffers = useCallback((nextOfferIds: string[]) => {
    selectedOfferIdsRef.current = nextOfferIds;
    setSelectedOfferIds(nextOfferIds);
  }, []);

  const readCart = useCallback(async (userId: string, readVersion: number) => {
    const isCurrent = () =>
      userIdRef.current === userId &&
      isCartReadCurrent(readVersion, mutationVersionRef.current);
    if (!isCurrent()) return false;
    const { data: cart, error: cartError } = await supabase
      .from("customer_carts")
      .select("id")
      .eq("customer_id", userId)
      .maybeSingle();
    if (!isCurrent()) return false;
    if (cartError) throw cartError;

    cartIdRef.current = cart?.id ?? null;
    if (!cart) {
      if (!isCurrent()) return false;
      updateLocalItems([]);
      updateSelectedOffers([]);
      return true;
    }

    const [itemsResult, offersResult] = await Promise.all([
      supabase
        .from("customer_cart_items")
        .select("product_id,quantity")
        .eq("cart_id", cart.id)
        .order("created_at", { ascending: true })
        .order("product_id", { ascending: true }),
      supabase
        .from("customer_cart_offer_selections")
        .select("offer_id")
        .eq("cart_id", cart.id)
        .order("created_at", { ascending: true })
        .order("offer_id", { ascending: true }),
    ]);
    if (!isCurrent()) return false;
    if (itemsResult.error) throw itemsResult.error;
    if (offersResult.error) throw offersResult.error;

    updateLocalItems(
      (itemsResult.data ?? []).map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
      })),
    );
    updateSelectedOffers((offersResult.data ?? []).map((item) => item.offer_id));
    return true;
  }, [updateLocalItems, updateSelectedOffers]);

  const loadCart = useCallback((userId: string, _reason: CartReadReason) => {
    if (cartReadRef.current?.userId === userId) return cartReadRef.current.promise;
    const readVersion = mutationVersionRef.current;
    const promise = (async () => {
      const applied = await readCart(userId, readVersion);
      if (applied && userIdRef.current === userId) {
        lastValidatedRef.current = { userId, at: Date.now() };
      }
    })().finally(() => {
      if (cartReadRef.current?.promise === promise) cartReadRef.current = null;
    });
    cartReadRef.current = { userId, promise };
    return promise;
  }, [readCart]);

  useEffect(() => {
    if (authLoading) return;
    const userId = user?.id ?? null;
    let alive = true;
    const timer = setTimeout(() => {
      userIdRef.current = userId;
      setLoadedUserId(userId);
      cartIdRef.current = null;
      cartReadRef.current = null;
      lastValidatedRef.current = null;
      mutationVersionRef.current += 1;
      updateLocalItems([]);
      updateSelectedOffers([]);
      setSyncError(null);
      setRefreshing(false);
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      void loadCart(userId, "initial")
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

  const revalidate = useCallback(async () => {
    if (!authReady) return;
    const userId = userIdRef.current;
    if (!userId) return;
    const validated = lastValidatedRef.current;
    if (validated?.userId === userId && Date.now() - validated.at < 30_000) return;
    setRefreshing(true);
    try {
      await queueRef.current;
      await loadCart(userId, "stale-revalidate");
      writeErrorRef.current = null;
      setSyncError(null);
    } catch (error) {
      writeErrorRef.current = error;
      setSyncError(errorMessage(error));
    } finally {
      if (userIdRef.current === userId) setRefreshing(false);
    }
  }, [authReady, loadCart]);

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

  const enqueueWrite = useCallback((
    userId: string,
    write: () => Promise<void>,
    options: { reconcileOnSuccess?: boolean } = {},
  ) => {
    const task = queueRef.current.then(async () => {
      try {
        if (userIdRef.current !== userId) {
          throw new Error("تغير الحساب؛ أعد تحميل السلة قبل المتابعة.");
        }
        await write();
        if (options.reconcileOnSuccess !== false) {
          await loadCart(userId, "mutation");
        } else if (userIdRef.current === userId) {
          lastValidatedRef.current = { userId, at: Date.now() };
        }
        writeErrorRef.current = null;
        setSyncError(null);
        return true;
      } catch (error: unknown) {
        writeErrorRef.current = error;
        setSyncError(errorMessage(error));
        if (purchaseAvailabilityMessage(error)) void refresh();
        if (userIdRef.current === userId) {
          try {
            const pendingRead = cartReadRef.current?.userId === userId
              ? cartReadRef.current.promise
              : null;
            if (pendingRead) await pendingRead.catch(() => undefined);
            await loadCart(userId, "mutation-rollback");
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
  }, [loadCart, refresh]);

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
    mutationVersionRef.current += 1;
    const nextItems = updateOrderedCartItem(itemsRef.current, productId, quantity);
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
    }, { reconcileOnSuccess: false });
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


    const current = itemsRef.current.find((item) => item.productId === product.id);
    const minimum = product.minimumQuantity ?? 1;
    const step = product.quantityStep ?? 1;
    const requested = quantity ?? minimum;
    const nextQuantity = snapCatalogQuantity(requested, minimum, step);
    return await saveItem(
      product.id,
      normalizeCatalogQuantity((current?.quantity ?? 0) + nextQuantity),
    );
  }, [authReady, loading, saveItem]);

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

    if (selectedOfferIdsRef.current.includes(offerId)) {
      setSyncError("هذا العرض موجود بالفعل في سلتك.");
      return false;
    }

    mutationVersionRef.current += 1;
    updateSelectedOffers([...selectedOfferIdsRef.current, offerId]);
    return enqueueWrite(userId, async () => {
      const { error } = await supabase.rpc("add_customer_cart_offer", {
        target_offer: offerId,
      });
      if (error) throw error;
    });
  }, [authReady, enqueueWrite, loading, offers, updateSelectedOffers]);

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
    mutationVersionRef.current += 1;
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
    if (!current || !product || !product.available) {
      setSyncError("هذا المنتج لم يعد متاحًا. أزله من السلة قبل المتابعة.");
      return;
    }
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
    mutationVersionRef.current += 1;
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
    mutationVersionRef.current += 1;
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
      await loadCart(userId, "retry");
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
const subtotal = useMemo(() => {
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
  }, [items, products, selectedOffers]);
  const cartReady = authReady && !loading;

  const value = useMemo<CartContextValue>(() => ({
    scope: loadedUserId,
    items: cartReady ? items : [],
    selectedOfferIds: cartReady ? selectedOfferIds : [],
    itemCount: cartReady ? itemCount : 0,
    subtotal: cartReady ? subtotal : 0,
loading: !cartReady,
    refreshing,
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
    revalidate,
    getQuantity: (productId) =>
      cartReady
        ? items.find((item) => item.productId === productId)?.quantity ?? 0
        : 0,
  }), [
    cartReady,
    loadedUserId,
    items,
    selectedOfferIds,
    itemCount,
    subtotal,

    syncError,
    refreshing,
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
    revalidate,
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

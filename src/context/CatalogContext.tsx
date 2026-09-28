import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { categories as demoCategories, type Category, type Product, type Store } from "@/constants/catalog";
import { supabase } from "@/lib/supabase";

type CategoryRow = { id: string; name: string; slug: string; is_active: boolean; sort_order: number };
type StoreRow = {
  id: string; name: string; description: string; address: string; status: string;
  store_settings: { currency: "SYP" | "USD"; accepts_orders: boolean; delivery_mode: "store" | "platform"; store_delivery_fee: number | string } | { currency: "SYP" | "USD"; accepts_orders: boolean; delivery_mode: "store" | "platform"; store_delivery_fee: number | string }[] | null;
};
type ProductRow = {
  id: string; store_id: string; category_id: string | null; name: string;
  description: string; availability: string; image_url: string | null;
};
type StoreProductRow = {
  id: string; product_id: string; store_id: string; price: number | string;
  currency: "SYP" | "USD"; selling_unit: string; minimum_quantity: number | string;
  quantity_step: number | string; is_active: boolean; offer_price: number | string | null;
  offer_starts_at: string | null; offer_ends_at: string | null;
};

type CatalogContextValue = {
  categories: Category[];
  products: Product[];
  stores: Store[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function getUnitName(unit: string) {
  const names: Record<string, string> = { piece: "قطعة", kg: "كغ", g: "غ", l: "لتر", ml: "مل" };
  return names[unit] ?? unit;
}

function getSettings(row: StoreRow["store_settings"]) {
  return Array.isArray(row) ? row[0] : row;
}

export function CatalogProvider({ children }: PropsWithChildren) {
  const [catalog, setCatalog] = useState<Omit<CatalogContextValue, "refresh">>({
    categories: [], products: [], stores: [], isLoading: true, error: null,
  });

  const refresh = useCallback(async () => {
    setCatalog((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const [categoryResult, storeResult] = await Promise.all([
        supabase.from("categories").select("id,name,slug,is_active,sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("stores").select("id,name,description,address,status,store_settings(currency,accepts_orders,delivery_mode,store_delivery_fee)").eq("status", "approved").order("name"),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (storeResult.error) throw storeResult.error;

      const categoryRows = (categoryResult.data ?? []) as CategoryRow[];
      const storeRows = (storeResult.data ?? []) as StoreRow[];
      const storeIds = storeRows.map((row) => row.id);
      let productRows: ProductRow[] = [];
      let storeProductRows: StoreProductRow[] = [];
      if (storeIds.length > 0) {
        const [productsResult, pricesResult] = await Promise.all([
          supabase.from("products").select("id,store_id,category_id,name,description,availability,image_url").in("store_id", storeIds).eq("availability", "available").order("name"),
          supabase.from("store_products").select("id,product_id,store_id,price,currency,selling_unit,minimum_quantity,quantity_step,is_active,offer_price,offer_starts_at,offer_ends_at").in("store_id", storeIds).eq("is_active", true),
        ]);
        if (productsResult.error) throw productsResult.error;
        if (pricesResult.error) throw pricesResult.error;
        productRows = (productsResult.data ?? []) as ProductRow[];
        storeProductRows = (pricesResult.data ?? []) as StoreProductRow[];
      }

      const availableRows = productRows.filter((row) => row.availability === "available");
      const productById = new Map(availableRows.map((row) => [row.id, row]));
      const activePrices = storeProductRows.filter((row) => row.is_active && productById.has(row.product_id));
      const now = Date.now();
      const nextProducts: Product[] = activePrices.flatMap((priceRow) => {
        const row = productById.get(priceRow.product_id);
        if (!row) return [];
        const basePrice = Number(priceRow.price);
        const offerStart = priceRow.offer_starts_at ? new Date(priceRow.offer_starts_at).getTime() : null;
        const offerEnd = priceRow.offer_ends_at ? new Date(priceRow.offer_ends_at).getTime() : null;
        const offerActive = priceRow.offer_price !== null && (offerStart === null || offerStart <= now) && (offerEnd === null || offerEnd > now);
        return [{
          id: row.id,
          storeProductId: priceRow.id,
          storeId: row.store_id,
          categoryId: row.category_id ?? "",
          name: row.name,
          description: row.description,
          price: offerActive ? Number(priceRow.offer_price) : basePrice,
          originalPrice: offerActive ? basePrice : undefined,
          currency: priceRow.currency,
          unit: `لكل ${getUnitName(priceRow.selling_unit)}`,
          minimumQuantity: Number(priceRow.minimum_quantity),
          quantityStep: Number(priceRow.quantity_step),
          imageUrl: row.image_url,
          available: true,
          offer: offerActive,
        }];
      });

      const categoryById = new Map(categoryRows.map((row) => [row.id, row]));
      const productsByStore = new Map<string, Product[]>();
      for (const product of nextProducts) {
        productsByStore.set(product.storeId, [...(productsByStore.get(product.storeId) ?? []), product]);
      }
      const nextStores: Store[] = storeRows.flatMap((row) => {
        const settings = getSettings(row.store_settings);
        if (settings?.accepts_orders === false) return [];
        const storeProducts = productsByStore.get(row.id) ?? [];
        const categoryIds = [...new Set(storeProducts.map((product) => product.categoryId).filter(Boolean))];
        const firstCategory = categoryIds.map((id) => categoryById.get(id)).find(Boolean);
        const demoCategory = firstCategory ? demoCategories.find((item) => item.id === firstCategory.slug) : undefined;
        return [{
          id: row.id,
          name: row.name,
          categoryIds,
          categoryIcon: demoCategory?.icon,
          description: row.description,
          location: row.address,
          rating: 0,
          deliveryTime: "",
          deliveryFee: "",
          productCount: storeProducts.length,
          currency: settings?.currency ?? "SYP",
          deliveryMode: settings?.delivery_mode ?? "platform",
          storeDeliveryFee: Number(settings?.store_delivery_fee ?? 0),
        }];
      });
      const nextCategories: Category[] = categoryRows.map((row) => {
        const demo = demoCategories.find((item) => item.id === row.slug);
        return { id: row.id, slug: row.slug, name: row.name, icon: demo?.icon ?? "grid-outline", description: demo?.description ?? "" };
      });
      setCatalog({ categories: nextCategories, products: nextProducts, stores: nextStores, isLoading: false, error: null });
    } catch {
      setCatalog((current) => ({ ...current, isLoading: false, error: "تعذر تحميل بيانات المتاجر والمنتجات. تحقق من الاتصال ثم أعد المحاولة." }));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const value = useMemo(() => ({ ...catalog, refresh }), [catalog, refresh]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}

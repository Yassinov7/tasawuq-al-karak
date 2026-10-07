import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Category, IconName, Product, ProductMedia, Store } from "@/constants/catalog";
import type { CustomerOffer } from "@/lib/customer-offers";
import { getStoreMediaUrl } from "@/lib/merchant-store";
import {
  getCachedPublicCatalog,
  getPublicCatalog,
  type PublicCatalog,
} from "@/lib/public-catalog";

type CatalogState = {
  categories: Category[];
  storeCategories: Category[];
  products: Product[];
  stores: Store[];
  offers: CustomerOffer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CustomerCatalogContext = createContext<CatalogState | null>(null);

const CATEGORY_ICONS: Record<string, IconName> = {
  groceries: "cart-outline",
  produce: "leaf-outline",
  dairy: "nutrition-outline",
  "meat-poultry": "restaurant-outline",
  bakery: "fast-food-outline",
  drinks: "cafe-outline",
  "home-kitchen": "home-outline",
  "personal-care": "sparkles-outline",
  other: "grid-outline",
};

function toCatalogState(catalog: PublicCatalog): Pick<
  CatalogState,
  "categories" | "storeCategories" | "products" | "stores" | "offers"
> {
  const productCategories = catalog.productCategories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: CATEGORY_ICONS[category.slug] ?? "cube-outline",
    description: "",
  }));

  const storeCategories = catalog.storeCategories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: CATEGORY_ICONS[category.slug] ?? "storefront-outline",
    description: "",
  }));

  const stores: Store[] = catalog.stores.map((store) => ({
    id: store.id,
    name: store.name,
    categoryIds: [store.category_id],
    description: store.description,
    location: store.address,
  }));

  const mediaByProduct = new Map<string, ProductMedia[]>();
  for (const media of catalog.productMedia) {
    const rows = mediaByProduct.get(media.product_id) ?? [];
    rows.push({
      id: media.id,
      type: media.media_type,
      uri: getStoreMediaUrl(media.storage_path),
      altText: media.alt_text,
      displayOrder: media.display_order,
    });
    mediaByProduct.set(media.product_id, rows);
  }

  const productById = new Map<string, Product>();
  const products: Product[] = catalog.products.map((product) => ({
    id: product.id,
    storeId: product.store_id,
    categoryId: product.category_id,
    name: product.title,
    description: product.description,
    price: product.price,
    currency: product.currency,
    unit: product.selling_unit,
    available: product.is_available,
    minimumQuantity: product.minimum_quantity,
    quantityStep: product.quantity_step,
    offer: catalog.offerItems.some((item) => item.product_id === product.id),
    media: mediaByProduct.get(product.id) ?? [],
  }));
  products.forEach((product) => productById.set(product.id, product));
  const offers: CustomerOffer[] = catalog.offers.flatMap((offer) => {
    const items = catalog.offerItems
      .filter((item) => item.offer_id === offer.id)
      .flatMap((item) => {
        const product = productById.get(item.product_id);
        return product
          ? [{
              id: item.id,
              itemRole: item.item_role,
              quantity: item.quantity,
              product,
            }]
          : [];
      });
    return items.length === catalog.offerItems.filter((item) => item.offer_id === offer.id).length && items.length > 0
      ? [{ ...offer, items }]
      : [];
  });

  return { categories: productCategories, storeCategories, products, stores, offers };
}

export function CustomerCatalogProvider({ children }: PropsWithChildren) {
  const [catalogState, setCatalogState] = useState<
    Pick<CatalogState, "categories" | "storeCategories" | "products" | "stores" | "offers">
  >({ categories: [], storeCategories: [], products: [], stores: [], offers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cached = await getCachedPublicCatalog();
      if (cached) {
        setCatalogState(toCatalogState(cached));
      }

      const catalog = await getPublicCatalog();
      setCatalogState(toCatalogState(catalog));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "تعذر تحميل بيانات المتاجر والمنتجات.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const value = useMemo(
    () => ({ ...catalogState, loading, error, refresh }),
    [catalogState, loading, error, refresh],
  );

  return (
    <CustomerCatalogContext.Provider value={value}>
      {children}
    </CustomerCatalogContext.Provider>
  );
}

export function useCustomerCatalog() {
  const value = useContext(CustomerCatalogContext);
  if (!value) {
    throw new Error(
      "useCustomerCatalog must be used inside CustomerCatalogProvider",
    );
  }
  return value;
}

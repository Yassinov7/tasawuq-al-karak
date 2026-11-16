import { useAuth } from "@/context/AuthContext";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
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

import type { Category, IconName, Product, ProductMedia, Store } from "@/types/catalog";
import type { CustomerOffer } from "@/lib/customer-offers";
import { getStoreMediaUrl } from "@/lib/merchant-store";
import { getRatingSummaries, type RatingSummary } from "@/lib/customer-reviews";
import {
  getCachedPublicCatalog,
  getPublicCatalog,
  invalidatePublicCatalog,
  readNextOfferTransition,
  readCatalogCategoryChoices,
  type PublicCatalog,
} from "@/lib/public-catalog";

type CatalogState = {
  categories: Category[];
  storeCategories: Category[];
  products: Product[];
  stores: Store[];
  offers: CustomerOffer[];
  storeRatings: Map<string, RatingSummary>;
  productRatings: Map<string, RatingSummary>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  categoryRead: "loading" | "ready" | "error";
  offerRead: "loading" | "ready" | "error";
  refresh: () => Promise<void>;
  revalidate: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  resetForAccessChange: () => void;
  refreshProductAvailability: (productId: string) => Promise<void>;
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

function toCategoryState(choices: Pick<PublicCatalog, "storeCategories" | "productCategories">) {
  const productCategories = choices.productCategories.map((category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parent_id,
    icon: CATEGORY_ICONS[category.slug] ?? "cube-outline",
    description: "",
  }));

  const storeCategories = choices.storeCategories.map((category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parent_id,
    icon: CATEGORY_ICONS[category.slug] ?? "storefront-outline",
    description: "",
  }));

  return { categories: productCategories, storeCategories };
}

export function toCatalogState(catalog: PublicCatalog): Pick<
  CatalogState,
  "categories" | "storeCategories" | "products" | "stores" | "offers"
> {
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
  const products: Product[] = catalog.products.filter((product) => product.is_available).map((product) => ({
    id: product.id,
    storeId: product.store_id,
    categoryId: product.category_id,
    name: product.title,
    description: product.description,
    price: product.price,
    unit: product.selling_unit,
    available: product.is_available,
    minimumQuantity: product.minimum_quantity,
    quantityStep: product.quantity_step,
    offer: false,
    media: mediaByProduct.get(product.id) ?? [],
  }));
  products.forEach((product) => productById.set(product.id, product));
  const itemsByOffer = new Map<string, PublicCatalog["offerItems"]>();
  for (const item of catalog.offerItems) {
    const items = itemsByOffer.get(item.offer_id);
    if (items) items.push(item);
    else itemsByOffer.set(item.offer_id, [item]);
  }
  const offers: CustomerOffer[] = catalog.offers.flatMap((offer) => {
    // Customer eligibility is decided by read_customer_active_offers using the
    // database clock. Do not repeat it with a potentially skewed device clock.
    if (!offer.is_active) return [];
    const offerItems = itemsByOffer.get(offer.id) ?? [];
    const items = offerItems
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
    return items.length === offerItems.length && items.length > 0
      ? [{ ...offer, items }]
      : [];
  });

  const offerProductIds = new Set(offers.flatMap((offer) => offer.items.map((item) => item.product.id)));
  return { ...toCategoryState(catalog), products: products.map((product) => ({ ...product, offer: offerProductIds.has(product.id) })), stores, offers };
}

const emptyCatalog = { categories: [], storeCategories: [], products: [], stores: [], offers: [] };
const emptyRatings = { storeRatings: new Map<string, RatingSummary>(), productRatings: new Map<string, RatingSummary>() };
type CatalogRows = ReturnType<typeof toCatalogState>;

export function CustomerCatalogProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const owner = user?.id ?? null;
  const scope = authLoading ? "loading" : owner ?? "guest";
  const enabled = !authLoading;
  const [snapshot, setSnapshot] = useState<{ scope: string; rows: CatalogRows } | null>(null);
  const [ratingSnapshot, setRatingSnapshot] = useState<{ scope: string; rows: typeof emptyRatings } | null>(null);
  const [status, setStatus] = useState({ scope: "", loading: true, refreshing: false, error: null as string | null });
  const [sectionStatus, setSectionStatus] = useState<{
    scope: string; categoryRead: CatalogState["categoryRead"]; offerRead: CatalogState["offerRead"];
  }>();
  const categoryRead = sectionStatus?.scope === scope ? sectionStatus.categoryRead : "loading";
  const offerRead = sectionStatus?.scope === scope ? sectionStatus.offerRead : "loading";
  const catalogState = snapshot?.scope === scope ? snapshot.rows : emptyCatalog;
  const ratings = ratingSnapshot?.scope === scope ? ratingSnapshot.rows : emptyRatings;
  const loading = status.scope !== scope || status.loading;
  const refreshing = status.scope === scope && status.refreshing;
  const error = status.scope === scope ? status.error : null;
  const setCatalogState = useCallback((update: (rows: CatalogRows) => CatalogRows) => {
    setSnapshot(previous => ({ scope, rows: update(previous?.scope === scope ? previous.rows : emptyCatalog) }));
  }, [scope]);
  const refreshSequence = useRef(0);
  const categorySequence = useRef(0);
  const categoryApplied = useRef(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionReload = useRef<() => void>(() => undefined);
  const catalogReadRef = useRef<{ scope: string; promise: Promise<void> } | null>(null);
  const lastValidatedRef = useRef<{ scope: string; at: number } | null>(null);

  const readCatalog = useCallback(async (reuseCache: boolean) => {
    if (!enabled) return;
    const request = ++refreshSequence.current;
    const categoryVersion = categoryApplied.current;
    const apply = (catalog: PublicCatalog) => {
      const next = toCatalogState(catalog);
      setCatalogState(previous => categoryApplied.current === categoryVersion ? next : { ...next, categories: previous.categories, storeCategories: previous.storeCategories });
    };
    setStatus(previous => ({ scope, loading: previous.scope !== scope || previous.loading, refreshing: previous.scope === scope && !previous.loading, error: null }));

    try {
      const cached = reuseCache ? await getCachedPublicCatalog(owner) : undefined;
      if (request !== refreshSequence.current) return;
      if (cached) {
        // Offers are time-sensitive. Keep the rest of the cached catalog, but
        // wait for the server-clock RPC before publishing offer eligibility.
        apply({ ...cached, offers: [], offerItems: [] });
      }

      const setSection = (section: "categoryRead" | "offerRead", ready: boolean) => {
        setSectionStatus(previous => ({
          ...(previous?.scope === scope ? previous : { scope, categoryRead: "loading", offerRead: "loading" }),
          [section]: ready ? "ready" : "error",
        }));
      };
      const catalog = await getPublicCatalog(owner, {
        categories: choices => {
          if (request !== refreshSequence.current) return;
          if (choices && categoryApplied.current === categoryVersion) {
            setCatalogState(previous => ({ ...previous, ...toCategoryState(choices) }));
          }
          setSection("categoryRead", Boolean(choices));
        },
        offers: market => {
          if (request !== refreshSequence.current) return;
          if (market) {
            const { offers, stores } = toCatalogState(market);
            setCatalogState(previous => {
              const media = new Map(previous.offers.flatMap(offer => offer.items.map(item => [item.product.id, item.product.media] as const)));
              return { ...previous, stores, offers: offers.map(offer => ({
                ...offer, items: offer.items.map(item => ({
                  ...item, product: { ...item.product, media: media.get(item.product.id) ?? item.product.media },
                })),
              })) };
            });
          }
          setSection("offerRead", Boolean(market));
        },
      });
      if (request !== refreshSequence.current) return;
      apply(catalog);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
      void readNextOfferTransition().then((transition) => {
        if (request !== refreshSequence.current || transition === null) return;
        const delay = Math.max(1_000, transition - Date.now() + 1_000);
        transitionTimer.current = setTimeout(() => transitionReload.current(), Math.min(delay, 2_147_000_000));
      }).catch(() => undefined);
      setSectionStatus({ scope, categoryRead: "ready", offerRead: "ready" });
      lastValidatedRef.current = { scope, at: Date.now() };
      void getRatingSummaries().then((result) => {
        if (request === refreshSequence.current) setRatingSnapshot({ scope, rows: { storeRatings: result.stores, productRatings: result.products } });
      }).catch(() => {
        if (request === refreshSequence.current) setRatingSnapshot({ scope, rows: emptyRatings });
      });
    } catch (cause) {
      if (request !== refreshSequence.current) return;
      setSectionStatus(previous => ({
        scope,
        categoryRead: previous?.scope === scope && previous.categoryRead !== "loading" ? previous.categoryRead : "error",
        offerRead: previous?.scope === scope && previous.offerRead !== "loading" ? previous.offerRead : "error",
      }));
      setStatus({ scope, loading: false, refreshing: false, error: cause instanceof Error
        ? cause.message : "تعذر تحميل بيانات المتاجر والمنتجات." });
    } finally {
      if (request === refreshSequence.current) setStatus(previous => ({ ...previous, loading: false, refreshing: false }));
    }
  }, [enabled, owner, scope, setCatalogState]);

  const runCatalogRead = useCallback((force: boolean) => {
    if (!enabled) return Promise.resolve();
    if (!force && lastValidatedRef.current?.scope === scope && Date.now() - lastValidatedRef.current.at < 60_000) return Promise.resolve();
    if (catalogReadRef.current?.scope === scope) return catalogReadRef.current.promise;
    const promise = (async () => {
      await readCatalog(true);
    })().finally(() => {
      if (catalogReadRef.current?.promise === promise) catalogReadRef.current = null;
    });
    catalogReadRef.current = { scope, promise };
    return promise;
  }, [enabled, readCatalog, scope]);
  useEffect(() => {
    transitionReload.current = () => { void runCatalogRead(true); };
  }, [runCatalogRead]);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const refresh = useCallback(() => runCatalogRead(true), [runCatalogRead]);
  const revalidate = useCallback(() => runCatalogRead(false), [runCatalogRead]);
  const resetForAccessChange = useCallback(() => {
    categorySequence.current += 1;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    setSnapshot(null);
    setRatingSnapshot(null);
    setSectionStatus(undefined);
    catalogReadRef.current = null;
    lastValidatedRef.current = null;
    void invalidatePublicCatalog(owner);
    void runCatalogRead(true);
  }, [owner, runCatalogRead]);

  const refreshProductAvailability = useCallback(async (productId: string) => {
    refreshSequence.current += 1;
    setCatalogState((current) => {
      const offers = current.offers.filter((offer) => !offer.items.some((item) => item.product.id === productId));
      const offeredIds = new Set(offers.flatMap((offer) => offer.items.map((item) => item.product.id)));
      return { ...current, offers, products: current.products.filter((product) => product.id !== productId).map((product) => ({ ...product, offer: offeredIds.has(product.id) })) };
    });
    await invalidatePublicCatalog();
    await refresh();
  }, [refresh, setCatalogState]);

  useEffect(() => {
    const timer = setTimeout(() => void runCatalogRead(false), 0);
    return () => { clearTimeout(timer); refreshSequence.current += 1; categorySequence.current += 1; };
  }, [runCatalogRead]);

  const refreshCategories = useCallback(async () => {
    const request = ++categorySequence.current;
    const choices = await readCatalogCategoryChoices();
    if (request !== categorySequence.current) return;
    categoryApplied.current += 1;
    setCatalogState(previous => ({ ...previous, ...toCategoryState(choices) }));
    setSectionStatus(previous => ({
      scope, offerRead: previous?.scope === scope ? previous.offerRead : "loading", categoryRead: "ready",
    }));
    await invalidatePublicCatalog();
  }, [scope, setCatalogState]);

  useLiveUpdates({ channelName: `marketplace-categories:${scope}`, enabled,
    subscriptions: [{ table: "catalog_category_revision" }], onChange: refreshCategories });

  const value = useMemo(
    () => ({ ...catalogState, ...ratings, loading, refreshing, error, categoryRead, offerRead, refresh, revalidate, refreshCategories, resetForAccessChange, refreshProductAvailability }),
    [catalogState, ratings, loading, refreshing, error, categoryRead, offerRead, refresh, revalidate, refreshCategories, resetForAccessChange, refreshProductAvailability],
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

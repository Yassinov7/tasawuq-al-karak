import { categoryFilterIds, categoryPath } from "@/lib/category-tree";
import type { CustomerOffer } from "@/lib/customer-offers";
import type { Category, Product, Store } from "@/types/catalog";

export type SearchFilter = "products" | "stores" | "offers" | "categories";
export function initialSearchFilter(type: unknown, mode: unknown, categoryId: string | null): SearchFilter {
  if (categoryId || mode === "products") return "products";
  const requested = type ?? mode;
  if (requested === "stores" || requested === "offers" || requested === "categories") return requested;
  return "products";
}

export type ProductSort = "relevance" | "price-ascending" | "price-descending";
export type CustomerSearchResults = { stores: Store[]; products: Product[]; offers: CustomerOffer[]; categories: Category[] };
type Input = { categories: Category[]; products: Product[]; stores: Store[]; storeCategories: Category[]; offers: CustomerOffer[] };

export function normalizeCustomerSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ar").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ـ/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
export function matchesAllCustomerSearchTerms(value: string, terms: string[]) { return terms.every((term) => normalizeCustomerSearchText(value).includes(term)); }
export function getCustomerSearchResults(input: Input, searchText: string): CustomerSearchResults {
  const { categories, products, stores, storeCategories, offers } = input;
  const query = normalizeCustomerSearchText(searchText), terms = query.split(" ").filter(Boolean);
  if (!query) return { stores, products: products.filter((product) => product.available), categories, offers };
  const productNodes = new Map(categories.map(category => [category.id, category]));
  const storeNodes = new Map(storeCategories.map(category => [category.id, category]));
  const matchedStores = stores.map(store => {
    const name = normalizeCustomerSearchText(store.name);
    const categoryMatch = store.categoryIds.some(id => {
      const category = storeNodes.get(id);
      return category ? matchesAllCustomerSearchTerms(categoryPath(category, storeNodes), terms) : false;
    });
    let score = 0;
    if (name === query) score = 1000;
    else if (name.startsWith(query)) score = 700;
    else if (matchesAllCustomerSearchTerms(store.name, terms)) score = 600;
    else if (categoryMatch) score = 500;
    else if (matchesAllCustomerSearchTerms(store.description, terms)) score = 200;
    return { store, score };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.store);

  const matchedProducts = products.filter(product => product.available).map(product => {
    const name = normalizeCustomerSearchText(product.name);
    const category = productNodes.get(product.categoryId);
    let score = 0;
    if (name === query) score = 1000;
    else if (name.startsWith(query)) score = 700;
    else if (matchesAllCustomerSearchTerms(product.name, terms)) score = 600;
    else if (category && matchesAllCustomerSearchTerms(categoryPath(category, productNodes), terms)) score = 500;
    else if (matchesAllCustomerSearchTerms(product.description, terms)) score = 200;
    else if (matchesAllCustomerSearchTerms(product.unit, terms)) score = 100;
    return { product, score };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.product);

  const matchedCategories = categories.map(category => {
    const name = normalizeCustomerSearchText(category.name);
    return { category, score: name === query ? 1000 : matchesAllCustomerSearchTerms(name, terms) ? 700 : 0 };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.category);

  const storesById = new Map(stores.map(store => [store.id, store.name]));
  const matchedOffers = offers.map(offer => {
    const title = normalizeCustomerSearchText(offer.title);
    const type = { discount: "خصم", bundle: "باقة", buy_x_get_y: "هدية" }[offer.offer_type];
    const searchable = [
      offer.title, offer.description, type, storesById.get(offer.store_id),
      ...offer.items.map(item => item.product.name),
    ].filter(Boolean).join(" ");
    const score = title === query ? 1000 : title.startsWith(query) ? 700
      : matchesAllCustomerSearchTerms(searchable, terms) ? 500 : 0;
    return { offer, score };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.offer);
  return { stores: matchedStores, products: matchedProducts, offers: matchedOffers, categories: matchedCategories };
}
export function getVisibleCustomerSearchResults(
  results: CustomerSearchResults, filter: SearchFilter, selectedCategoryId: string | null,
  productSort: ProductSort, categories: Category[],
): CustomerSearchResults {
  const showProducts = filter === "products";
  const selectedIds = selectedCategoryId === null ? null : categoryFilterIds(categories, selectedCategoryId);
  const products = showProducts ? results.products.filter(product => !selectedIds || selectedIds.has(product.categoryId)) : [];
  if (productSort === "price-ascending") products.sort((a, b) => a.price - b.price);
  else if (productSort === "price-descending") products.sort((a, b) => b.price - a.price);
  return {
    products,
    stores: filter === "stores" ? results.stores : [],
    offers: filter === "offers" ? results.offers : [],
    categories: filter === "categories" ? results.categories : [],
  };
}

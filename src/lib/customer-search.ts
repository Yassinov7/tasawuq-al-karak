import type { Category, Product, Store } from "@/constants/catalog";

export type SearchFilter = "all" | "products" | "stores" | "categories";
export type ProductSort = "relevance" | "price-ascending" | "price-descending";
export type CurrencyFilter = "all" | "SYP" | "USD";
export type CustomerSearchResults = { stores: Store[]; products: Product[]; categories: Category[] };
type Input = { categories: Category[]; products: Product[]; stores: Store[]; storeCategories: Category[] };

export function normalizeCustomerSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ar").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ـ/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ");
}
export function matchesAllCustomerSearchTerms(value: string, terms: string[]) { return terms.every((term) => normalizeCustomerSearchText(value).includes(term)); }
export function getCustomerSearchResults(input: Input, searchText: string): CustomerSearchResults {
  const { categories, products, stores, storeCategories } = input;
  const query = normalizeCustomerSearchText(searchText), terms = query.split(" ").filter(Boolean);
  if (!query) return { stores, products: products.filter((product) => product.available), categories };
  const matchedStores = stores.map((store) => { const name = normalizeCustomerSearchText(store.name); const categoryMatch = store.categoryIds.some((id) => { const category = storeCategories.find((item) => item.id === id); return category ? matchesAllCustomerSearchTerms(category.name, terms) : false; }); let score = 0; if (name === query) score += 1000; else if (name.startsWith(query)) score += 700; else if (matchesAllCustomerSearchTerms(store.name, terms)) score += 600; else if (categoryMatch) score += 500; else if (matchesAllCustomerSearchTerms(store.description, terms)) score += 200; return { store, score }; }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.store);
  const matchedProducts = products.map((product) => { const name = normalizeCustomerSearchText(product.name); const category = categories.find((item) => item.id === product.categoryId); let score = 0; if (name === query) score += 1000; else if (name.startsWith(query)) score += 700; else if (matchesAllCustomerSearchTerms(product.name, terms)) score += 600; else if (category && matchesAllCustomerSearchTerms(category.name, terms)) score += 500; else if (matchesAllCustomerSearchTerms(product.description, terms)) score += 200; else if (matchesAllCustomerSearchTerms(product.unit, terms)) score += 100; return { product, score }; }).filter((item) => item.score > 0 && item.product.available).sort((a, b) => b.score - a.score).map((item) => item.product);
  const matchedCategories = categories.map((category) => { const name = normalizeCustomerSearchText(category.name); return { category, score: name === query ? 1000 : matchesAllCustomerSearchTerms(category.name, terms) ? 700 : 0 }; }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.category);
  return { stores: matchedStores, products: matchedProducts, categories: matchedCategories };
}
export function getVisibleCustomerSearchResults(results: CustomerSearchResults, filter: SearchFilter, selectedCategoryId: string | null, currencyFilter: CurrencyFilter, productSort: ProductSort): CustomerSearchResults {
  const products = results.products.filter((product) => (selectedCategoryId === null || product.categoryId === selectedCategoryId) && (currencyFilter === "all" || (product.currency ?? "SYP") === currencyFilter)); const sortedProducts = [...products]; if (currencyFilter !== "all" && productSort === "price-ascending") sortedProducts.sort((a,b) => a.price-b.price); else if (currencyFilter !== "all" && productSort === "price-descending") sortedProducts.sort((a,b) => b.price-a.price); if (filter === "products") return { stores: [], products: sortedProducts, categories: [] }; if (filter === "stores") return { stores: results.stores, products: [], categories: [] }; if (filter === "categories") return { stores: [], products: [], categories: results.categories }; return { ...results, products: sortedProducts };
}

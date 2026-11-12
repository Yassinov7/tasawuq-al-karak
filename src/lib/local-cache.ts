import AsyncStorage from "@react-native-async-storage/async-storage";
import { assertSypDocuments } from "@/lib/money";

const CACHE_PREFIX = "@tasawuq/invoice-finance-v1/";
const memoryCache = new Map<string, unknown>();
const monetaryKey = (key: string) => /^(public-catalog|merchant-home|merchant-products|merchant-offers):/.test(key) || key.endsWith(":review");
const storageKey = (key: string) => `${CACHE_PREFIX}${monetaryKey(key) ? "syp-v2/" : ""}${key}`;

export function peekLocalCache<T>(key: string): T | undefined {
  const cached = memoryCache.get(key);
  assertSypDocuments(cached);
  return cached as T | undefined;
}

export async function readLocalCache<T>(key: string, options?: { requirePersistence?: boolean }): Promise<T | undefined> {
  const inMemory = peekLocalCache<T>(key);
  if (inMemory !== undefined) return inMemory;
  try {
    const stored = await AsyncStorage.getItem(storageKey(key));
    if (stored === null) return undefined;
    const parsed = JSON.parse(stored) as T;
    assertSypDocuments(parsed);
    memoryCache.set(key, parsed);
    return parsed;
  } catch (error) {
    if (options?.requirePersistence) throw error;
    return undefined;
  }
}

export async function writeLocalCache<T>(key: string, value: T, options?: { requirePersistence?: boolean }): Promise<void> {
  assertSypDocuments(value);
  memoryCache.set(key, value);
  try {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch (error) {
    if (options?.requirePersistence) throw error;
    // Keep the in-memory copy for this session if persistent storage is unavailable.
  }
}

export async function invalidateLocalCache(key: string, options?: { requirePersistence?: boolean }): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch (error) {
    if (options?.requirePersistence) throw error;
    // The next successful refresh will replace this cache entry.
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@tasawuq/cache/";
const memoryCache = new Map<string, unknown>();

export function peekLocalCache<T>(key: string): T | undefined {
  return memoryCache.get(key) as T | undefined;
}

export async function readLocalCache<T>(key: string): Promise<T | undefined> {
  const inMemory = peekLocalCache<T>(key);
  if (inMemory !== undefined) return inMemory;
  try {
    const stored = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (stored === null) return undefined;
    const parsed = JSON.parse(stored) as T;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

export async function writeLocalCache<T>(key: string, value: T): Promise<void> {
  memoryCache.set(key, value);
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Keep the in-memory copy for this session if persistent storage is unavailable.
  }
}

export async function invalidateLocalCache(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // The next successful refresh will replace this cache entry.
  }
}

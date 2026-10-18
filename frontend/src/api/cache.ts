import { buildApiError, authFetch } from "./client"
import { getAccessToken, SESSION_CHANGED_EVENT } from "../lib/session"

const CACHE_PREFIX = "api-get-cache:v2:"

interface CacheEntry<T> {
  expiresAt: number
  data: T
  namespaces: string[]
}

const memoryCache = new Map<string, CacheEntry<unknown>>()

const cloneData = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  return atob(padded)
}

const getCurrentUserCacheKey = () => {
  const token = getAccessToken()
  if (!token) return "anon"

  try {
    const payload = JSON.parse(decodeBase64Url(token.split(".")[1] || ""))
    return String(payload.user_id || payload.sub || "anon")
  } catch {
    return "anon"
  }
}

const normalizeEndpoint = (endpoint: string) => {
  const base = endpoint.startsWith("http") ? undefined : "https://cache.local"
  const url = new URL(endpoint, base)
  const entries = Array.from(url.searchParams.entries()).sort(([aKey, aValue], [bKey, bValue]) => {
    if (aKey === bKey) return aValue.localeCompare(bValue)
    return aKey.localeCompare(bKey)
  })
  const normalizedSearch = new URLSearchParams()
  entries.forEach(([key, value]) => normalizedSearch.append(key, value))
  const queryString = normalizedSearch.toString()
  return `${url.pathname}${queryString ? `?${queryString}` : ""}`
}

const buildStorageKey = (endpoint: string) => `${CACHE_PREFIX}${getCurrentUserCacheKey()}:${normalizeEndpoint(endpoint)}`

const readStoredEntry = <T>(key: string): CacheEntry<T> | null => {
  const cached = memoryCache.get(key)
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached as CacheEntry<T>
    }
    memoryCache.delete(key)
  }

  const raw = sessionStorage.getItem(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(key)
      return null
    }
    memoryCache.set(key, parsed as CacheEntry<unknown>)
    return parsed
  } catch {
    sessionStorage.removeItem(key)
    return null
  }
}

const writeEntry = <T>(key: string, entry: CacheEntry<T>) => {
  memoryCache.set(key, entry as CacheEntry<unknown>)
  sessionStorage.setItem(key, JSON.stringify(entry))
}

export const invalidateApiCache = (namespaces: string[]) => {
  if (!namespaces.length) return

  const namespaceSet = new Set(namespaces)
  const removeIfMatches = (key: string, entry: CacheEntry<unknown>) => {
    if (entry.namespaces.some((namespace) => namespaceSet.has(namespace))) {
      memoryCache.delete(key)
      sessionStorage.removeItem(key)
    }
  }

  memoryCache.forEach((entry, key) => removeIfMatches(key, entry))
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (!key || !key.startsWith(CACHE_PREFIX)) continue
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) || "null") as CacheEntry<unknown> | null
      if (parsed) {
        removeIfMatches(key, parsed)
      }
    } catch {
      sessionStorage.removeItem(key)
    }
  }
}

export const clearApiCache = () => {
  memoryCache.clear()
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(CACHE_PREFIX)) {
      sessionStorage.removeItem(key)
    }
  }
}

export const cachedGetJson = async <T>(
  endpoint: string,
  options: { ttlMs: number; namespaces: string[]; bypass?: boolean },
): Promise<T> => {
  const storageKey = buildStorageKey(endpoint)
  if (!options.bypass) {
    const cached = readStoredEntry<T>(storageKey)
    if (cached) {
      return cloneData(cached.data)
    }
  }

  const response = await authFetch(endpoint)
  if (!response.ok) {
    throw await buildApiError(response)
  }

  const data = (await response.json()) as T
  writeEntry(storageKey, {
    expiresAt: Date.now() + options.ttlMs,
    data,
    namespaces: options.namespaces,
  })
  return cloneData(data)
}

window.addEventListener(SESSION_CHANGED_EVENT, clearApiCache)

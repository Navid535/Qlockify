const STORAGE_KEY = "quera-clock:rate-limit-lock"

export interface RateLimitLock {
  status: number
  code: string | null
  message: string
  retryAfterSeconds: number
  throttledUntil: string
  returnTo: string
}

interface ActivateRateLimitInput {
  status: number
  code?: string | null
  message?: string | null
  retryAfterSeconds?: number | null
  throttledUntil?: string | null
  returnTo?: string | null
}

const DEFAULT_RETRY_SECONDS = 60

const isBrowser = typeof window !== "undefined"

const getCurrentPath = () => {
  if (!isBrowser) {
    return "/"
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

const readStoredLock = (): RateLimitLock | null => {
  if (!isBrowser) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<RateLimitLock>
    if (
      typeof parsed.status !== "number" ||
      typeof parsed.message !== "string" ||
      typeof parsed.retryAfterSeconds !== "number" ||
      typeof parsed.throttledUntil !== "string" ||
      typeof parsed.returnTo !== "string"
    ) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    if (parseIsoDate(parsed.throttledUntil) == null) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return {
      status: parsed.status,
      code: typeof parsed.code === "string" ? parsed.code : null,
      message: parsed.message,
      retryAfterSeconds: parsed.retryAfterSeconds,
      throttledUntil: parsed.throttledUntil,
      returnTo: parsed.returnTo,
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const getRateLimitRemainingSeconds = (lock: RateLimitLock | null) => {
  if (!lock) {
    return 0
  }

  const untilTimestamp = parseIsoDate(lock.throttledUntil)
  if (untilTimestamp == null) {
    return 0
  }

  return Math.max(0, Math.ceil((untilTimestamp - Date.now()) / 1000))
}

export const getStoredRateLimitLock = () => readStoredLock()

export const isRateLimitActive = () => getRateLimitRemainingSeconds(readStoredLock()) > 0

export const clearRateLimitLock = () => {
  if (!isBrowser) {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

export const activateRateLimitLock = (input: ActivateRateLimitInput) => {
  if (!isBrowser) {
    return null
  }

  const parsedThrottledUntil = parseIsoDate(input.throttledUntil)
  const retryFromUntil =
    parsedThrottledUntil != null
      ? Math.ceil(Math.max(parsedThrottledUntil - Date.now(), 0) / 1000)
      : 0
  const retryAfterSeconds = Math.max(
    input.retryAfterSeconds ?? retryFromUntil ?? DEFAULT_RETRY_SECONDS,
    retryFromUntil,
    0,
  ) || DEFAULT_RETRY_SECONDS

  const throttledUntil =
    input.throttledUntil && parsedThrottledUntil != null
      ? input.throttledUntil
      : new Date(Date.now() + retryAfterSeconds * 1000).toISOString()

  const returnTo =
    input.returnTo && input.returnTo !== "/rate-limit" ? input.returnTo : getCurrentPath()

  const lock: RateLimitLock = {
    status: input.status,
    code: input.code ?? "throttled",
    message: input.message || "Too many requests",
    retryAfterSeconds,
    throttledUntil,
    returnTo: returnTo === "/rate-limit" ? "/" : returnTo,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lock))
  return lock
}

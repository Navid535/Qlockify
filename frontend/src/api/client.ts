import { API_BASE_URL } from "../config/constants"
import {
  activateRateLimitLock,
  getRateLimitRemainingSeconds,
  getStoredRateLimitLock,
  isRateLimitActive,
} from "../lib/rateLimit"
import {
  clearSessionTokens,
  emitSessionChanged,
  getAccessToken,
  getRefreshToken,
} from "../lib/session"

let refreshRequest: Promise<string | null> | null = null

export interface ApiErrorMessage {
  attr?: string | null
  detail: string
  code?: string | null
}

export interface ApiErrorPayload {
  error?: string
  detail?: string
  status_code?: number
  messages?: ApiErrorMessage[]
  code?: string
  retry_after_seconds?: number | null
  throttled_until?: string | null
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  error: string
  messages: ApiErrorMessage[]
  code: string | null
  retryAfterSeconds: number | null
  throttledUntil: string | null

  constructor(status: number, payload: ApiErrorPayload, fallbackMessage: string) {
    const detailMessage = payload.messages?.[0]?.detail
    super(detailMessage || payload.error || fallbackMessage)
    this.name = "ApiError"
    this.status = status
    this.error = payload.error || fallbackMessage
    this.messages = payload.messages || []
    this.code = payload.code || null
    this.retryAfterSeconds = payload.retry_after_seconds ?? null
    this.throttledUntil = payload.throttled_until ?? null
  }
}

const collectMessagesFromPayload = (payload: ApiErrorPayload) => {
  const collected: ApiErrorMessage[] = []

  if (Array.isArray(payload.messages)) {
    payload.messages.forEach((message) => {
      if (message?.detail) {
        collected.push({
          attr: message.attr ?? null,
          detail: String(message.detail),
          code: message.code ?? null,
        })
      }
    })
  }

  if (payload.detail && typeof payload.detail === "string") {
    collected.push({ attr: null, detail: payload.detail })
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (["error", "detail", "status_code", "messages", "code", "retry_after_seconds", "throttled_until"].includes(key)) {
      return
    }
    if (value == null) return

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          collected.push({
            attr: key,
            detail: item.trim(),
          })
        }
      })
      return
    }

    if (typeof value === "string" && value.trim()) {
      collected.push({
        attr: key,
        detail: value.trim(),
      })
    }
  })

  return collected
}

const cleanBaseUrl = API_BASE_URL.replace(/\/+$/, "")

export const buildApiUrl = (endpoint: string) => {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  return `${cleanBaseUrl}${cleanEndpoint}`
}

const normalizeJsonResponse = (response: Response) => {
  const originalJson = response.json.bind(response)

  response.json = async () => {
    if (response.status === 204 || response.status === 205) {
      return {}
    }

    const data = await originalJson()

    if (data && typeof data === "object" && "items" in data && "pages_count" in data) {
      return {
        count: data.total_items || 0,
        next: null,
        previous: null,
        results: data.items || [],
        _meta: {
          pages_count: data.pages_count,
          items_per_page: data.items_per_page,
          current_page: data.current_page,
        },
      }
    }

    return data
  }

  return response
}

const clearSessionAndRedirect = () => {
  clearSessionTokens()
  if (window.location.pathname !== "/auth") {
    window.location.href = "/auth"
  }
}

const toIntOrNull = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.ceil(value))
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed)
    }
  }

  return null
}

const redirectToRateLimitPage = () => {
  if (window.location.pathname !== "/rate-limit") {
    window.location.replace("/rate-limit")
  }
}

const createLockedResponse = () => {
  const lock = getStoredRateLimitLock()
  const retryAfterSeconds = getRateLimitRemainingSeconds(lock)
  const payload = {
    error: lock?.message || "Too many requests",
    status_code: 429,
    messages: [{ detail: lock?.message || "Too many requests" }],
    code: lock?.code || "throttled",
    retry_after_seconds: retryAfterSeconds,
    throttled_until: lock?.throttledUntil || null,
  }

  return normalizeJsonResponse(
    new Response(JSON.stringify(payload), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }),
  )
}

const shouldAttemptRefresh = (endpoint: string) => {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  return ![
    "/api/users/login/",
    "/api/users/token/refresh/",
  ].includes(normalizedEndpoint)
}

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch(buildApiUrl("/api/users/token/refresh/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: refreshToken }),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      const nextAccessToken = typeof data?.access === "string" ? data.access : null
      const nextRefreshToken = typeof data?.refresh === "string" ? data.refresh : null

      if (!nextAccessToken) {
        return null
      }

      localStorage.setItem("accessToken", nextAccessToken)
      if (nextRefreshToken) {
        localStorage.setItem("refreshToken", nextRefreshToken)
      }
      emitSessionChanged()

      return nextAccessToken
    })().finally(() => {
      refreshRequest = null
    })
  }

  return refreshRequest
}

export const buildApiError = async (response: Response) => {
  let payload: ApiErrorPayload = {}

  try {
    payload = await response.clone().json()
  } catch {
    payload = {}
  }

  if (payload.retry_after_seconds == null) {
    const retryAfter = toIntOrNull(response.headers.get("Retry-After"))
    if (retryAfter != null) {
      payload.retry_after_seconds = retryAfter
    }
  }

  const fallbackMessage =
    response.statusText || (response.status === 429 ? "Too many requests" : "Request failed")

  const normalizedMessages = collectMessagesFromPayload(payload)
  if (normalizedMessages.length) {
    payload.messages = normalizedMessages
  }

  return new ApiError(response.status, payload, fallbackMessage)
}

export const getErrorMessage = (error: unknown, fallback = "Request failed") => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

export const authFetch = async (endpoint: string, options: RequestInit = {}, allowRetry = true): Promise<Response> => {
  if (isRateLimitActive()) {
    redirectToRateLimitPage()
    return createLockedResponse()
  }

  const token = getAccessToken()
  const isFormData = options.body instanceof FormData

  const headers: HeadersInit = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(buildApiUrl(endpoint), {
    ...options,
    headers,
  })

  if (response.status === 401 && allowRetry && shouldAttemptRefresh(endpoint)) {
    const nextAccessToken = await refreshAccessToken()

    if (nextAccessToken) {
      return authFetch(
        endpoint,
        {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${nextAccessToken}`,
          },
        },
        false,
      )
    }

    clearSessionAndRedirect()
    return response
  }

  if (response.status === 401 && shouldAttemptRefresh(endpoint)) {
    clearSessionAndRedirect()
    return response
  }

  if (!response.ok) {
    const apiError = await buildApiError(response)
    if (
      response.status === 429 ||
      apiError.code === "throttled" ||
      apiError.retryAfterSeconds != null ||
      apiError.throttledUntil
    ) {
      activateRateLimitLock({
        status: response.status,
        code: apiError.code,
        message: apiError.message,
        retryAfterSeconds: apiError.retryAfterSeconds,
        throttledUntil: apiError.throttledUntil,
      })
      redirectToRateLimitPage()
    }
  }

  return normalizeJsonResponse(response)
}

import { API_BASE_URL } from "../config/constants"
import { authFetch, buildApiError } from "./client"

export type NotificationLevel = "info" | "success" | "warning" | "error"

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  level: NotificationLevel
  created_at: string
  is_seen: boolean
  delete_on_seen: boolean
  action_url?: string | null
  entity_type?: string | null
  entity_id?: string | null
  meta?: Record<string, unknown>
}

export interface NotificationsResponse {
  count: number
  unread_count: number
  notifications: NotificationItem[]
}

export interface NotificationStreamTokenResponse {
  token: string
  expires_in: number
}

export interface NotificationFilters {
  limit?: number
  offset?: number
  type?: string
}

const buildSearchParams = (filters: NotificationFilters = {}) => {
  const searchParams = new URLSearchParams()
  if (typeof filters.limit === "number") {
    searchParams.set("limit", String(filters.limit))
  }
  if (typeof filters.offset === "number") {
    searchParams.set("offset", String(filters.offset))
  }
  if (filters.type) {
    searchParams.set("type", filters.type)
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

export const getNotifications = async (
  filters: NotificationFilters = {},
): Promise<NotificationsResponse> => {
  const response = await authFetch(`/api/notifications/list/${buildSearchParams(filters)}`)
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const markNotificationSeen = async (id: string) => {
  const response = await authFetch("/api/notifications/seen/", {
    method: "POST",
    body: JSON.stringify({ id }),
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const deleteNotification = async (id: string) => {
  const response = await authFetch(`/api/notifications/${id}/`, {
    method: "DELETE",
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const markAllNotificationsRead = async (type?: string) => {
  const response = await authFetch(`/api/notifications/seen/all/${buildSearchParams({ type })}`, {
    method: "POST",
    body: JSON.stringify(type ? { type } : {}),
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const issueNotificationStreamToken = async (): Promise<NotificationStreamTokenResponse> => {
  const response = await authFetch("/api/notifications/stream-token/", {
    method: "POST",
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const buildNotificationStreamUrl = (token: string) => {
  const cleanBaseUrl = API_BASE_URL.replace(/\/+$/, "")
  return `${cleanBaseUrl}/api/notifications/stream/?token=${encodeURIComponent(token)}`
}

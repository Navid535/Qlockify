import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import {
  buildNotificationStreamUrl,
  deleteNotification,
  getNotifications,
  issueNotificationStreamToken,
  markAllNotificationsRead,
  markNotificationSeen,
  type NotificationItem,
  type NotificationLevel,
} from "../api/notifications"
import { useTranslation } from "../hooks/useTranslation"
import { presentNotification } from "../lib/notificationPresenter"
import { isRateLimitActive } from "../lib/rateLimit"
import {
  getAccessToken,
  SESSION_CHANGED_EVENT,
} from "../lib/session"

type NotificationConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"

interface NotificationsContextValue {
  notifications: NotificationItem[]
  unreadCount: number
  totalCount: number
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  connectionStatus: NotificationConnectionStatus
  loadMore: () => Promise<void>
  markAsSeen: (notification: NotificationItem) => Promise<void>
  deleteOne: (notification: NotificationItem) => Promise<void>
  markAllAsSeen: () => Promise<void>
  handleNotificationClick: (notification: NotificationItem) => Promise<void>
  refreshNotifications: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

const PAGE_SIZE = 20

const mergeNotifications = (
  current: NotificationItem[],
  incoming: NotificationItem[],
) => {
  const notificationsById = new Map<string, NotificationItem>()
  for (const notification of current) {
    notificationsById.set(notification.id, notification)
  }
  for (const notification of incoming) {
    const existing = notificationsById.get(notification.id)
    notificationsById.set(notification.id, existing ? { ...existing, ...notification } : notification)
  }
  return Array.from(notificationsById.values()).sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

const getToastMethod = (level: NotificationLevel) => {
  switch (level) {
    case "success":
      return toast.success
    case "warning":
      return toast.warning
    case "error":
      return toast.error
    default:
      return toast.info
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<NotificationConnectionStatus>("idle")

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const toastedNotificationIdsRef = useRef<Set<string>>(new Set())

  const hasMore = notifications.length < totalCount

  const closeEventSource = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    eventSourceRef.current?.close()
    eventSourceRef.current = null
  }, [])

  const applyUnreadCount = useCallback((count: number | undefined) => {
    if (typeof count === "number") {
      setUnreadCount(count)
    }
  }, [])

  const updateNotification = useCallback((notification: NotificationItem) => {
    setNotifications((current) => mergeNotifications(current, [notification]))
  }, [])

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId))
  }, [])

  const openNotificationTarget = useCallback(async (notification: NotificationItem) => {
    if (!notification.action_url) {
      return
    }

    window.open(notification.action_url, "_blank", "noopener,noreferrer")
  }, [])

  const showIncomingToast = useCallback(
    (notification: NotificationItem) => {
      if (
        notification.is_seen ||
        toastedNotificationIdsRef.current.has(notification.id) ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      ) {
        return
      }

      toastedNotificationIdsRef.current.add(notification.id)
      const notify = getToastMethod(notification.level)
      const presented = presentNotification(notification, t)
      notify(presented.title || (t.notifications?.newTitle || "New notification"), {
        description: presented.message || undefined,
        action: notification.action_url
          ? {
              label: t.notifications?.openAction || "Open",
              onClick: () => {
                void openNotificationTarget(notification)
              },
            }
          : undefined,
      })
    },
    [openNotificationTarget, t.notifications],
  )

  const refreshNotifications = useCallback(async () => {
    if (!getAccessToken() || isRateLimitActive()) {
      setNotifications([])
      setUnreadCount(0)
      setTotalCount(0)
      setConnectionStatus("idle")
      return
    }

    setIsLoading(true)
    try {
      const response = await getNotifications({ limit: PAGE_SIZE, offset: 0 })
      setNotifications(response.notifications)
      setUnreadCount(response.unread_count)
      setTotalCount(response.count)
    } catch {
      toast.error(t.notifications?.loadError || "Failed to load notifications")
    } finally {
      setIsLoading(false)
    }
  }, [t.notifications])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return
    }

    setIsLoadingMore(true)
    try {
      const response = await getNotifications({
        limit: PAGE_SIZE,
        offset: notifications.length,
      })
      setNotifications((current) => mergeNotifications(current, response.notifications))
      setUnreadCount(response.unread_count)
      setTotalCount(response.count)
    } catch {
      toast.error(t.notifications?.loadError || "Failed to load notifications")
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMore, isLoadingMore, notifications.length, t.notifications])

  const markAsSeen = useCallback(async (notification: NotificationItem) => {
    if (notification.is_seen) {
      return
    }

    try {
      const response = await markNotificationSeen(notification.id)
      setUnreadCount((current) => {
        if (typeof response?.unread_count === "number") {
          return response.unread_count
        }
        return Math.max(current - 1, 0)
      })
      if (response?.deleted) {
        removeNotification(notification.id)
        setTotalCount((current) => Math.max(current - 1, 0))
      } else {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, is_seen: true } : item,
          ),
        )
      }
    } catch {
      toast.error(t.notifications?.markSeenError || "Failed to update notification")
    }
  }, [removeNotification, t.notifications])

  const markAllAsSeen = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_seen: true })),
      )
    } catch {
      toast.error(t.notifications?.markAllError || "Failed to update notifications")
    }
  }, [t.notifications])

  const deleteOne = useCallback(async (notification: NotificationItem) => {
    try {
      const response = await deleteNotification(notification.id)
      removeNotification(notification.id)
      setTotalCount((current) => Math.max(current - 1, 0))
      setUnreadCount((current) => {
        if (typeof response?.unread_count === "number") {
          return response.unread_count
        }
        return notification.is_seen ? current : Math.max(current - 1, 0)
      })
    } catch {
      toast.error(t.notifications?.deleteError || "Failed to delete notification")
    }
  }, [removeNotification, t.notifications])

  const handleNotificationClick = useCallback(async (notification: NotificationItem) => {
    await markAsSeen(notification)
    try {
      await openNotificationTarget(notification)
    } catch {
      toast.error(t.notifications?.openError || "Failed to open notification")
    }
  }, [markAsSeen, openNotificationTarget, t.notifications])

  const connectToStream = useCallback(async () => {
    if (!getAccessToken() || isRateLimitActive()) {
      closeEventSource()
      setConnectionStatus("idle")
      return
    }

    closeEventSource()
    setConnectionStatus("connecting")

    try {
      const tokenResponse = await issueNotificationStreamToken()
      const stream = new EventSource(buildNotificationStreamUrl(tokenResponse.token))
      eventSourceRef.current = stream

      stream.onopen = () => {
        reconnectAttemptRef.current = 0
        setConnectionStatus("connected")
      }

      stream.addEventListener("connected", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          notifications?: NotificationItem[]
          unread_count?: number
        }
        if (Array.isArray(payload.notifications)) {
          setNotifications((current) => mergeNotifications(current, payload.notifications || []))
          setTotalCount((current) => Math.max(current, payload.notifications?.length || 0))
        }
        applyUnreadCount(payload.unread_count)
      })

      stream.addEventListener("notification", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          notification?: NotificationItem
          unread_count?: number
        }
        if (!payload.notification) {
          return
        }
        const incomingNotification = payload.notification
        setNotifications((current) => {
          const isExisting = current.some(
            (notification) => notification.id === incomingNotification.id,
          )
          if (!isExisting) {
            setTotalCount((count) => count + 1)
          }
          return mergeNotifications(current, [incomingNotification])
        })
        applyUnreadCount(payload.unread_count)
        showIncomingToast(incomingNotification)
      })

      stream.addEventListener("notification_seen", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          notification_id?: string
          deleted?: boolean
          notification?: NotificationItem | null
          unread_count?: number
        }
        if (payload.deleted && payload.notification_id) {
          removeNotification(payload.notification_id)
          setTotalCount((current) => Math.max(current - 1, 0))
        } else if (payload.notification) {
          updateNotification(payload.notification)
        } else if (payload.notification_id) {
          setNotifications((current) =>
            current.map((notification) =>
              notification.id === payload.notification_id
                ? { ...notification, is_seen: true }
                : notification,
            ),
          )
        }
        applyUnreadCount(payload.unread_count)
      })

      stream.addEventListener("notification_mark_all_read", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          type?: string | null
          unread_count?: number
        }
        setNotifications((current) =>
          current.map((notification) =>
            payload.type && notification.type !== payload.type
              ? notification
              : { ...notification, is_seen: true },
          ),
        )
        applyUnreadCount(payload.unread_count)
      })

      stream.addEventListener("unread_count", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          unread_count?: number
        }
        applyUnreadCount(payload.unread_count)
      })

      stream.onerror = async () => {
        stream.close()
        eventSourceRef.current = null
        setConnectionStatus("disconnected")

        reconnectAttemptRef.current += 1
        const reconnectDelay = Math.min(
          1000 * 2 ** reconnectAttemptRef.current,
          30000,
        )

        reconnectTimeoutRef.current = window.setTimeout(async () => {
          if (!getAccessToken()) {
            return
          }
          try {
            await connectToStream()
          } catch {
            setConnectionStatus("disconnected")
          }
        }, reconnectDelay)
      }
    } catch {
      setConnectionStatus("disconnected")
    }
  }, [
    applyUnreadCount,
    closeEventSource,
    showIncomingToast,
    removeNotification,
    updateNotification,
  ])

  useEffect(() => {
    const startNotifications = async () => {
      if (!getAccessToken() || isRateLimitActive()) {
        closeEventSource()
        setNotifications([])
        setUnreadCount(0)
        setTotalCount(0)
        setConnectionStatus("idle")
        return
      }

      await refreshNotifications()
      await connectToStream()
    }

    void startNotifications()

    const handleSessionChange = () => {
      void startNotifications()
    }

    window.addEventListener(SESSION_CHANGED_EVENT, handleSessionChange)

    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, handleSessionChange)
      closeEventSource()
    }
  }, [closeEventSource, connectToStream, refreshNotifications])

  const value = useMemo<NotificationsContextValue>(() => {
    return {
      notifications,
      unreadCount,
      totalCount,
      hasMore,
      isLoading,
      isLoadingMore,
      connectionStatus,
      loadMore,
      markAsSeen,
      deleteOne,
      markAllAsSeen,
      handleNotificationClick,
      refreshNotifications,
    }
  }, [
    connectionStatus,
    handleNotificationClick,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    markAllAsSeen,
    markAsSeen,
    deleteOne,
    notifications,
    refreshNotifications,
    totalCount,
    unreadCount,
  ])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationsProvider")
  }
  return context
}

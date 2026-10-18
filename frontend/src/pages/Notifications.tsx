import { CheckCheck, Loader2 } from "lucide-react";

import { NotificationList } from "../components/notifications/NotificationList";
import { Button } from "../components/ui/button";
import { useNotifications } from "../context/NotificationsContext";
import { useTranslation } from "../hooks/useTranslation";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    totalCount,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    markAllAsSeen,
    deleteOne,
    handleNotificationClick,
  } = useNotifications();

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t.notifications?.title || "Notifications"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.notifications?.pageDescription || "Review all notifications and export updates."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void markAllAsSeen()}
            disabled={unreadCount === 0}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            {t.notifications?.markAllRead || "Mark all as read"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {t.notifications?.totalLabel || "Total notifications"}
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{totalCount}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {t.notifications?.unreadLabel || "Unread notifications"}
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{unreadCount}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center px-4 py-12 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {t.notifications?.loading || "Loading notifications..."}
          </div>
        ) : (
          <NotificationList
            notifications={notifications}
            emptyLabel={t.notifications?.empty || "No notifications yet."}
            onClick={(item) => void handleNotificationClick(item)}
            onDelete={(item) => void deleteOne(item)}
          />
        )}

        {hasMore ? (
          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t.notifications?.loadingMore || "Loading more..."}
                </>
              ) : (
                t.notifications?.loadMore || "Load more"
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

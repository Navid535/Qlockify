import { Trash2 } from "lucide-react";

import type { NotificationItem } from "../../api/notifications";
import { useTranslation } from "../../hooks/useTranslation";
import { presentNotification } from "../../lib/notificationPresenter";
import { cn } from "../../lib/utils";

const NOTIFICATION_DELETE_ENABLED = false;

const formatNotificationTimestamp = (value: string, locale: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export function NotificationList({
  notifications,
  emptyLabel,
  onClick,
  onDelete,
  className = "",
}: {
  notifications: NotificationItem[];
  emptyLabel: string;
  onClick: (notification: NotificationItem) => void;
  onDelete: (notification: NotificationItem) => void;
  className?: string;
}) {
  const { t, lang } = useTranslation();

  if (notifications.length === 0) {
    return (
      <div className={cn("px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400", className)}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={className}>
      {notifications.map((notification) => {
        const presented = presentNotification(notification, t);

        return (
          <div
            key={notification.id}
            className={cn(
              "border-b border-slate-100 px-4 py-3 transition-colors dark:border-slate-800",
              notification.is_seen
                ? "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80"
                : "bg-sky-50/70 hover:bg-sky-100/70 dark:bg-sky-500/10 dark:hover:bg-sky-500/15",
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onClick(notification)}
                className="flex min-w-0 flex-1 items-start gap-3 text-start"
              >
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    notification.is_seen ? "bg-slate-300 dark:bg-slate-700" : "bg-sky-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {presented.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {formatNotificationTimestamp(notification.created_at, lang)}
                    </span>
                  </div>
                  {presented.message ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                      {presented.message}
                    </p>
                  ) : null}
                </div>
              </button>
              {NOTIFICATION_DELETE_ENABLED ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onDelete(notification);
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  aria-label={t.notifications?.deleteLabel || "Delete notification"}
                  title={t.notifications?.deleteLabel || "Delete notification"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

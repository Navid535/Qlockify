import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { NotificationList } from "./NotificationList";
import { useTranslation } from "../../hooks/useTranslation";
import { useNotifications } from "../../context/NotificationsContext";
import { Button } from "../ui/button";

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAllAsSeen,
    deleteOne,
    handleNotificationClick,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_seen),
    [notifications],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border-slate-200 text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-600 dark:border-slate-800 dark:text-slate-300 dark:hover:border-sky-500/50 dark:hover:text-sky-300"
        aria-label={t.notifications?.open || "Open notifications"}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute end-0 top-full z-[80] mt-3 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t.notifications?.title || "Notifications"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.notifications?.summary?.(unreadNotifications.length, unreadCount) ||
                  `${unreadNotifications.length} total, ${unreadCount} unread`}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void markAllAsSeen()}
              className="h-8 px-2 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4" />
              <span className="sr-only">{t.notifications?.markAllRead || "Mark all as read"}</span>
            </Button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-12 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t.notifications?.loading || "Loading notifications..."}
              </div>
            ) : (
              <NotificationList
                notifications={unreadNotifications}
                emptyLabel={t.notifications?.emptyUnread || "No unread notifications."}
                onClick={(item) => void handleNotificationClick(item)}
                onDelete={(item) => void deleteOne(item)}
              />
            )}
          </div>

          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                navigate("/notifications");
              }}
            >
              {t.notifications?.viewAll || "View all notifications"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

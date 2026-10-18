import type { NotificationItem } from "../api/notifications";

const roleLabel = (role: unknown, dictionary: any) => {
  if (typeof role !== "string" || !role) return "";
  return dictionary?.workspace?.roles?.[role] || role;
};

export const presentNotification = (notification: NotificationItem, dictionary: any) => {
  const notifications = dictionary?.notifications;
  const meta = notification.meta || {};
  const workspaceName = typeof meta.workspace_name === "string" ? meta.workspace_name : "";
  const actorName = typeof meta.actor_name === "string" ? meta.actor_name : "";
  const previousRole = roleLabel(meta.previous_role, dictionary);
  const newRole = roleLabel(meta.new_role, dictionary);

  switch (notification.type) {
    case "workspace_membership_added":
      return {
        title: notifications?.workspaceMembershipAddedTitle || notification.title || notification.type,
        message:
          notifications?.workspaceMembershipAddedMessage?.(actorName, workspaceName, newRole) ||
          notification.message ||
          "",
      };
    case "workspace_membership_role_changed":
      return {
        title: notifications?.workspaceMembershipRoleChangedTitle || notification.title || notification.type,
        message:
          notifications?.workspaceMembershipRoleChangedMessage?.(
            actorName,
            workspaceName,
            previousRole,
            newRole,
          ) ||
          notification.message ||
          "",
      };
    case "workspace_membership_deactivated":
      return {
        title: notifications?.workspaceMembershipDeactivatedTitle || notification.title || notification.type,
        message:
          notifications?.workspaceMembershipDeactivatedMessage?.(actorName, workspaceName) ||
          notification.message ||
          "",
      };
    case "workspace_membership_removed":
      return {
        title: notifications?.workspaceMembershipRemovedTitle || notification.title || notification.type,
        message:
          notifications?.workspaceMembershipRemovedMessage?.(actorName, workspaceName) ||
          notification.message ||
          "",
      };
    default:
      return {
        title: notification.title || notification.type,
        message: notification.message || "",
      };
  }
};

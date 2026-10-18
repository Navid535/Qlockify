export type WorkspaceRole = "owner" | "admin" | "member";

export const WORKSPACE_VIEW = "workspace.view";
export const WORKSPACE_EDIT = "workspace.edit";
export const WORKSPACE_DELETE = "workspace.delete";
export const WORKSPACE_MEMBERS_VIEW = "workspace.members.view";
export const WORKSPACE_MEMBERS_ADD = "workspace.members.add";
export const WORKSPACE_MEMBERS_REMOVE = "workspace.members.remove";
export const WORKSPACE_MEMBERS_CHANGE_ROLE = "workspace.members.change_role";
export const WORKSPACE_LOGS_VIEW = "workspace.logs.view";
export const CLIENTS_VIEW = "clients.view";
export const CLIENTS_CREATE = "clients.create";
export const CLIENTS_EDIT = "clients.edit";
export const CLIENTS_DELETE = "clients.delete";
export const TAGS_VIEW = "tags.view";
export const TAGS_CREATE = "tags.create";
export const TAGS_EDIT = "tags.edit";
export const TAGS_DELETE = "tags.delete";
export const PROJECTS_VIEW = "projects.view";
export const PROJECTS_CREATE = "projects.create";
export const PROJECTS_EDIT = "projects.edit";
export const PROJECTS_DELETE = "projects.delete";
export const PROJECTS_ARCHIVE = "projects.archive";
export const TIME_ENTRIES_VIEW_OWN = "time_entries.view_own";
export const TIME_ENTRIES_MANAGE_OWN = "time_entries.manage_own";

export type WorkspaceCapability =
  | typeof WORKSPACE_VIEW
  | typeof WORKSPACE_EDIT
  | typeof WORKSPACE_DELETE
  | typeof WORKSPACE_MEMBERS_VIEW
  | typeof WORKSPACE_MEMBERS_ADD
  | typeof WORKSPACE_MEMBERS_REMOVE
  | typeof WORKSPACE_MEMBERS_CHANGE_ROLE
  | typeof WORKSPACE_LOGS_VIEW
  | typeof CLIENTS_VIEW
  | typeof CLIENTS_CREATE
  | typeof CLIENTS_EDIT
  | typeof CLIENTS_DELETE
  | typeof TAGS_VIEW
  | typeof TAGS_CREATE
  | typeof TAGS_EDIT
  | typeof TAGS_DELETE
  | typeof PROJECTS_VIEW
  | typeof PROJECTS_CREATE
  | typeof PROJECTS_EDIT
  | typeof PROJECTS_DELETE
  | typeof PROJECTS_ARCHIVE
  | typeof TIME_ENTRIES_VIEW_OWN
  | typeof TIME_ENTRIES_MANAGE_OWN;

const CAPABILITIES_BY_ROLE: Record<WorkspaceRole, Set<WorkspaceCapability>> = {
  owner: new Set([
    WORKSPACE_VIEW,
    WORKSPACE_EDIT,
    WORKSPACE_DELETE,
    WORKSPACE_MEMBERS_VIEW,
    WORKSPACE_MEMBERS_ADD,
    WORKSPACE_MEMBERS_REMOVE,
    WORKSPACE_MEMBERS_CHANGE_ROLE,
    WORKSPACE_LOGS_VIEW,
    CLIENTS_VIEW,
    CLIENTS_CREATE,
    CLIENTS_EDIT,
    CLIENTS_DELETE,
    TAGS_VIEW,
    TAGS_CREATE,
    TAGS_EDIT,
    TAGS_DELETE,
    PROJECTS_VIEW,
    PROJECTS_CREATE,
    PROJECTS_EDIT,
    PROJECTS_DELETE,
    PROJECTS_ARCHIVE,
    TIME_ENTRIES_VIEW_OWN,
    TIME_ENTRIES_MANAGE_OWN,
  ]),
  admin: new Set([
    WORKSPACE_VIEW,
    WORKSPACE_EDIT,
    WORKSPACE_MEMBERS_VIEW,
    WORKSPACE_MEMBERS_ADD,
    WORKSPACE_MEMBERS_REMOVE,
    WORKSPACE_MEMBERS_CHANGE_ROLE,
    WORKSPACE_LOGS_VIEW,
    CLIENTS_VIEW,
    CLIENTS_CREATE,
    CLIENTS_EDIT,
    CLIENTS_DELETE,
    TAGS_VIEW,
    TAGS_CREATE,
    TAGS_EDIT,
    TAGS_DELETE,
    PROJECTS_VIEW,
    PROJECTS_CREATE,
    PROJECTS_EDIT,
    PROJECTS_DELETE,
    PROJECTS_ARCHIVE,
    TIME_ENTRIES_VIEW_OWN,
    TIME_ENTRIES_MANAGE_OWN,
  ]),
  member: new Set([
    WORKSPACE_VIEW,
    CLIENTS_VIEW,
    TAGS_VIEW,
    TAGS_CREATE,
    PROJECTS_VIEW,
    TIME_ENTRIES_VIEW_OWN,
    TIME_ENTRIES_MANAGE_OWN,
  ]),
};

export const canWorkspace = (
  role: WorkspaceRole | null | undefined,
  capability: WorkspaceCapability,
) => {
  if (!role) return false;
  return CAPABILITIES_BY_ROLE[role]?.has(capability) ?? false;
};

export const canDeleteWorkspaceResource = ({
  workspaceRole,
  currentUserId,
  createdById,
}: {
  workspaceRole: WorkspaceRole | null | undefined;
  currentUserId?: string | null;
  createdById?: string | null;
}) => {
  if (!workspaceRole) return false;
  if (workspaceRole === "owner") return true;
  if (!currentUserId || !createdById) return false;
  return currentUserId === createdById;
};

export const canChangeWorkspaceMember = ({
  actorRole,
  actorUserId,
  targetRole,
  targetUserId,
  ownerUserId,
  newRole,
}: {
  actorRole: WorkspaceRole | null | undefined;
  actorUserId?: string | null;
  targetRole: WorkspaceRole;
  targetUserId?: string | null;
  ownerUserId?: string | null;
  newRole?: WorkspaceRole;
}) => {
  if (!actorRole || !actorUserId || !targetUserId) return false;
  if (actorUserId === targetUserId) return false;

  const targetIsCanonicalOwner = !!ownerUserId && targetUserId === ownerUserId;
  if (actorRole === "admin") {
    if (targetRole === "owner" || targetIsCanonicalOwner) return false;
    if (newRole === "owner") return false;
    return true;
  }

  if (actorRole === "owner") {
    if (targetIsCanonicalOwner) return false;
    return true;
  }

  return false;
};

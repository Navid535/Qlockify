from apps.workspaces.models import WorkspaceMembership

ROLE_RANK = {
    "owner": 3,
    "admin": 2,
    "manager": 2,
    "member": 1,
}

def get_workspace_membership(user, workspace):
    if not user or not user.is_authenticated:
        return None
    return WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=user,
        is_deleted=False,
        is_active=True,
    ).first()


def get_workspace_role(user, workspace):
    if not user or not user.is_authenticated:
        return None

    if workspace.owner == user:
        return WorkspaceMembership.Role.OWNER

    membership = get_workspace_membership(user, workspace)
    if membership:
        return membership.role

    return None


def has_workspace_role(user, workspace, minimum_role):
    role = get_workspace_role(workspace=workspace, user=user)

    if not role:
        return False

    return ROLE_RANK.get(role, 0) >= ROLE_RANK.get(minimum_role, 0)


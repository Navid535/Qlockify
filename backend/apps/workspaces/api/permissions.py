from rest_framework import permissions

from apps.workspaces.permissions import has_workspace_role


class CanManageWorkspace(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return has_workspace_role(user=request.user, workspace=obj, minimum_role="admin")
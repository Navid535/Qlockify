from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.services import create_notification
from apps.workspaces.api.serializers import WorkspaceMembershipSerializer, WorkspaceSerializer
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.workspaces.permissions import get_workspace_role, has_workspace_role


class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Workspace.objects.visible_to(self.request.user).select_related("owner")
        search = self.request.query_params.get("search")
        ordering = self.request.query_params.get("ordering", "-created_at")
        if search:
            queryset = queryset.filter(name__icontains=search)
        if ordering in {"name", "-name", "created_at", "-created_at", "updated_at", "-updated_at"}:
            queryset = queryset.order_by(ordering)
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def my_role(self, request, pk=None):
        return Response({"role": get_workspace_role(request.user, self.get_object())})


class WorkspaceMembershipViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceMembershipSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = WorkspaceMembership.objects.filter(
            is_deleted=False,
            workspace__in=Workspace.objects.visible_to(self.request.user)
        ).select_related("workspace", "user")
        workspace = self.request.query_params.get("workspace")
        if workspace:
            queryset = queryset.filter(workspace_id=workspace)
        return queryset

    def perform_create(self, serializer):
        workspace = serializer.validated_data["workspace"]
        if not has_workspace_role(self.request.user, workspace, "admin"):
            raise PermissionDenied("You cannot manage this workspace.")
        membership = serializer.save()
        actor_name = self.request.user.full_name
        create_notification(
            membership.user,
            title="You were added to a workspace",
            body=f"{actor_name} added you to {workspace.name} as {membership.role}.",
            event_type="workspace_membership_added",
            meta={
                "workspace_name": workspace.name,
                "actor_name": actor_name,
                "new_role": membership.role,
            },
        )

    def perform_update(self, serializer):
        membership = self.get_object()
        workspace = membership.workspace
        if not has_workspace_role(self.request.user, workspace, "admin"):
            raise PermissionDenied("You cannot manage this workspace.")
        previous_role = membership.role
        updated = serializer.save()
        if previous_role != updated.role:
            actor_name = self.request.user.full_name
            create_notification(
                updated.user,
                title="Your workspace role changed",
                body=f"{actor_name} changed your role in {workspace.name} from {previous_role} to {updated.role}.",
                event_type="workspace_membership_role_changed",
                meta={
                    "workspace_name": workspace.name,
                    "actor_name": actor_name,
                    "previous_role": previous_role,
                    "new_role": updated.role,
                },
            )

    def perform_destroy(self, instance):
        workspace = instance.workspace
        if not has_workspace_role(self.request.user, workspace, "admin"):
            raise PermissionDenied("You cannot manage this workspace.")
        target_user = instance.user
        actor_name = self.request.user.full_name
        instance.delete()
        create_notification(
            target_user,
            title="You were removed from a workspace",
            body=f"{actor_name} removed you from {workspace.name}.",
            event_type="workspace_membership_removed",
            meta={
                "workspace_name": workspace.name,
                "actor_name": actor_name,
            },
        )

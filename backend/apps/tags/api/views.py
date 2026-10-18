from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated

from apps.notifications.services import create_notification
from apps.tags.api.serializers import TagSerializer
from apps.tags.models import Tag


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated,]
    parser_classes = [MultiPartParser, JSONParser, FormParser]


    def get_queryset(self):
        queryset = Tag.objects.visible_to(self.request.user)

        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)

        ordering = self.request.query_params.get("ordering")

        if ordering in ("name", "-name", "created_at", "-created_at"):
            queryset = queryset.order_by(ordering)

        return queryset

    def _notify_workspace_members(self, workspace, title, body, event_type):
        memberships = workspace.memberships.filter(
            is_active=True,
            is_deleted=False,
        ).select_related("user")

        for membership in memberships:
            create_notification(
                user=membership.user,
                title=title,
                body=body,
                event_type=event_type,
                meta={
                    "workspace": workspace.name,
                },
            )

    def perform_create(self, serializer):
        tag = serializer.save()

        self._notify_workspace_members(
            workspace=tag.workspace,
            title="New tag added",
            body=f"New tag {tag.name} was added.",
            event_type="tag_created",
        )

    def perform_destroy(self, instance):
        workspace = instance.workspace
        tag_name = instance.name

        instance.delete()

        self._notify_workspace_members(
            workspace=workspace,
            title="Tag deleted",
            body=f"tag {tag_name} was deleted.",
            event_type="tag_deleted",
        )
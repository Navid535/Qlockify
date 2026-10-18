from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.clients.api.serializers import ClientSerializer
from apps.clients.models import Client
from apps.notifications.services import create_notification


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Client.objects.visible_to(self.request.user)

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
        client = serializer.save()

        self._notify_workspace_members(
            workspace=client.workspace,
            title="New client added",
            body=f"New client {client.name} was added.",
            event_type="client_created",
        )

    def perform_destroy(self, instance):
        workspace = instance.workspace
        client_name = instance.name

        instance.delete()

        self._notify_workspace_members(
            workspace=workspace,
            title="Client deleted",
            body=f"Client {client_name} was deleted.",
            event_type="client_deleted",
        )
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.services import create_notification
from apps.projects.api.serializers import ProjectSerializer
from apps.projects.models import Project

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, ]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Project.objects.visible_to(
            self.request.user
        ).select_related("client")

        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)

        client = self.request.query_params.get("client")
        if client:
            queryset = queryset.filter(client_id=client)

        clients = self.request.query_params.get("clients")
        if clients:
            client_ids = [
                client_id.strip()
                for client_id in clients.split(",")
                if client_id.strip()
            ]
            queryset = queryset.filter(client_id__in=client_ids)

        is_archived = self.request.query_params.get("is_archived")
        if is_archived is not None:
            if is_archived.lower() == "true":
                queryset = queryset.filter(is_archived=True)
            elif is_archived.lower() == "false":
                queryset = queryset.filter(is_archived=False)

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
        project = serializer.save()

        self._notify_workspace_members(
            workspace=project.workspace,
            title="New project added",
            body=f"New project {project.name} was added.",
            event_type="project_created",
        )

    def perform_destroy(self, instance):
        workspace = instance.workspace
        project_name = instance.name

        instance.delete()

        self._notify_workspace_members(
            workspace=workspace,
            title="Project deleted",
            body=f"project {project_name} was deleted.",
            event_type="project_deleted",
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        project = self.get_object()
        project.is_archived = True
        project.save()
        return Response(
            data=ProjectSerializer(project).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        project = self.get_object()
        project.is_archived = False
        project.save()
        return Response(
            data=ProjectSerializer(project).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        return self.unarchive(request, pk)
from django.utils import timezone
from rest_framework import serializers

from apps.clients.models import Client
from apps.projects.models import Project
from apps.time_entries.models import TimeEntry
from apps.workspaces.permissions import has_workspace_role


class TimeEntrySerializer(serializers.ModelSerializer):
    duration_seconds = serializers.IntegerField(read_only=True)
    start_time_ms = serializers.SerializerMethodField()
    end_time_ms = serializers.SerializerMethodField()
    server_now_ms = serializers.SerializerMethodField()
    project_details = serializers.SerializerMethodField()
    tag_details = serializers.SerializerMethodField()

    class Meta:
        model = TimeEntry
        fields = (
            "id", "workspace", "user", "project",
            "tags", "description", "start_time", "end_time", "duration",
            "is_billable", "created_at", "updated_at",

            "duration_seconds", "start_time_ms", "end_time_ms", "server_now_ms",
            "project_details", "tag_details"
        )
        read_only_fields = (
            "id", "user", "duration", "duration_seconds", "is_billable",

            "start_time_ms", "end_time_ms", "server_now_ms",
            "project_details", "tag_details"
        )

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()

        if "workspace_id" in data and "workspace" not in data:
            data["workspace"] = data["workspace_id"]


        if "project_id" in data and "project" not in data:
            data["project"] = data["project_id"]


        return super().to_internal_value(data)

    def get_start_time_ms(self, obj):
        return int(obj.start_time.timestamp() * 1000)

    def get_end_time_ms(self, obj):
        if obj.end_time is not None:
            return int(obj.end_time.timestamp() * 1000)
        return None

    def get_server_now_ms(self, obj):
        now = timezone.now()
        return int(now.timestamp() * 1000)


    def get_project_details(self, obj):
        project = obj.project
        if project is None:
            return None
        project_details = {
            "id": str(project.id),
            "name": project.name,
            "is_deleted": project.is_deleted,
            "client_name": project.client.name if project.client else None,
        }
        return project_details

    def get_tag_details(self, obj):
        return [
            {
                "id": str(tag.id),
                "name": tag.name,
                "color": tag.color,
                "is_deleted": tag.is_deleted,
            }
            for tag in obj.tags.all()
        ]

    def create(self, validated_data):
        tags = validated_data.pop("tags", None)
        validated_data.pop("user", None)

        entry = TimeEntry.objects.create(
            user=self.context["request"].user,
            **validated_data,
        )

        if tags is not None:
            entry.tags.set(tags)

        return entry

    def validate(self, attrs):
        request = self.context.get("request")

        workspace = attrs.get("workspace")
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        project = attrs.get("project")
        tags = attrs.get("tags")

        if self.instance:
            if workspace is None:
                workspace = self.instance.workspace

            if start_time is None:
                start_time = self.instance.start_time

            if "end_time" not in attrs:
                end_time = self.instance.end_time

            if "project" not in attrs:
                project = self.instance.project

            if "tags" not in attrs:
                tags = self.instance.tags.all()

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError({
                "workspace": "You do not have access to this workspace."
            })

        if not has_workspace_role(
                user=request.user,
                workspace=workspace,
                minimum_role="member",
        ):
            raise serializers.ValidationError({
                "workspace": "You do not have access to this workspace."
            })

        if end_time is None:
            queryset = TimeEntry.objects.filter(
                workspace=workspace,
                user=request.user,
                end_time__isnull=True,
                is_deleted=False,
            )

            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)

            if queryset.exists():
                raise serializers.ValidationError({
                    "end_time": (
                        "You already have a running time entry "
                        "in this workspace."
                    )
                })

        if start_time is not None and end_time is not None:
            if end_time <= start_time:
                raise serializers.ValidationError({
                    "end_time": "End time must be greater than start time."
                })

        if project is not None:
            if project.workspace_id != workspace.id:
                raise serializers.ValidationError({
                    "project": "Selected project does not belong to this workspace."
                })

        if tags is not None:
            if any(tag.workspace_id != workspace.id for tag in tags):
                raise serializers.ValidationError({
                    "tags": "All selected tags must belong to the same workspace."
                })

        return attrs

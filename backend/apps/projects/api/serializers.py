from rest_framework import serializers

from apps.clients.models import Client
from apps.projects.models import Project
from apps.workspaces.permissions import has_workspace_role


def absolute_media_url(request, field):
    if not field:
        return None
    url = field.url
    return request.build_absolute_uri(url) if request else url

class AbsoluteImageField(serializers.ImageField):
    def to_representation(self, value):
        if not value:
            return None
        url = value.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class ProjectSerializer(serializers.ModelSerializer):
    client = serializers.SerializerMethodField()
    client_id = serializers.PrimaryKeyRelatedField(
        source="client",
        queryset=Client.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    thumbnail = AbsoluteImageField(required=False, allow_null=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "workspace",
            "name",
            "color",
            "description",
            "thumbnail",
            "is_archived",
            "client",
            "client_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        validators = []

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()

        if "workspace_id" in data and "workspace" not in data:
            data["workspace"] = data["workspace_id"]

        if "client" in data and "client_id" not in data:
            client = data["client"]

            if client is None or client == "":
                data["client_id"] = None

            elif isinstance(client, dict):
                data["client_id"] = client.get("id")

            elif hasattr(client, "id"):
                data["client_id"] = client.id

            else:
                data["client_id"] = client

        ct = data.get("clear_thumbnail")
        if ct is not None:
            if ct in ("true", "True", True):
                data["thumbnail"] = None
            data.pop("clear_thumbnail", None)

        return super().to_internal_value(data)


    def get_client(self, obj):
        if obj.client is None:
            return None
        else:
            data = {
                "id": str(obj.client.id),
                "name": str(obj.client.name),
                "thumbnail": obj.client.thumbnail.url if obj.client.thumbnail else None,
            }
        return data

    def validate(self, attrs):
        request = self.context.get("request")

        workspace = attrs.get("workspace")
        name = attrs.get("name")
        client = attrs.get("client")

        if self.instance:
            workspace = workspace or self.instance.workspace
            name = name if name is not None else self.instance.name
            client = client if client is not None else self.instance.client

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

        name = name.strip()

        queryset = Project.objects.filter(
            workspace=workspace,
            name__iexact=name,
            is_deleted=False,
        )

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError({
                "name": "A project with this name already exists in this workspace."
            })

        attrs["name"] = name

        if client is not None:
            if client.workspace != workspace:
                raise serializers.ValidationError({
                    "client_id": "Selected client does not belong to this workspace."
                })

        return attrs

    def create(self, validated_data):
        validated_data.pop("clear_thumbnail", None)
        return super().create(validated_data)

from rest_framework import serializers

from apps.clients.models import Client
from apps.tags.models import Tag
from apps.workspaces.permissions import has_workspace_role


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"
        validators = []

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()

        ct = data.get("clear_thumbnail")
        if ct is not None:
            if ct in ("true", "True", True):
                data["thumbnail"] = None
            data.pop("clear_thumbnail", None)

        if "workspace_id" in data and "workspace" not in data:
            data["workspace"] = data["workspace_id"]

        return super().to_internal_value(data)


    def validate(self, attrs):
        request = self.context.get("request")

        workspace = attrs.get("workspace")
        name = attrs.get("name")

        if self.instance:
            workspace = workspace or self.instance.workspace
            name = name if name is not None else self.instance.name

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

        queryset = Tag.objects.filter(
            workspace=workspace,
            name__iexact=name,
            is_deleted=False,
        )

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError({
                "name": "A tag with this name already exists in this workspace."
            })

        attrs["name"] = name

        return attrs


    def create(self, validated_data):
        validated_data.pop("clear_thumbnail", None)
        return super().create(validated_data)

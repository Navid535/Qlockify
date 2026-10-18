from rest_framework import serializers

from apps.users.api.serializers import UserSerializer
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.workspaces.permissions import get_workspace_role


class AbsoluteImageField(serializers.ImageField):
    def to_representation(self, value):
        if not value:
            return None
        url = value.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class WorkspaceSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    thumbnail = AbsoluteImageField(required=False, allow_null=True)

    class Meta:
        model = Workspace
        fields = ("id", "name", "description", "thumbnail", "owner", "my_role", "created_at", "updated_at")
        read_only_fields = ("id", "owner", "my_role", "created_at", "updated_at")

    def get_my_role(self, obj):
        request = self.context.get("request")
        return get_workspace_role(request.user, obj) if request else None

    def validate_name(self, value):
        request = self.context.get("request")
        owner = getattr(request, "user", None)
        if not owner or not owner.is_authenticated:
            return value

        queryset = Workspace.objects.filter(owner=owner, name__iexact=value.strip())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("You already have a workspace with this name.")
        return value.strip()


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source="user", queryset=WorkspaceMembership._meta.get_field("user").remote_field.model.objects.all(), write_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ("id", "workspace", "user", "user_id", "role", "is_active", "joined_at")
        read_only_fields = ("id", "joined_at", "user")
        validators = []

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        if "user" in data and "user_id" not in data:
            data["user_id"] = data.get("user")
        return super().to_internal_value(data)

    def validate(self, attrs):
        workspace = attrs.get("workspace") or (self.instance.workspace if self.instance else None)
        user = attrs.get("user") or (self.instance.user if self.instance else None)
        if workspace and user:
            queryset = WorkspaceMembership.objects.filter(workspace=workspace, user=user)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({
                    "user_id": "This user is already a member of the selected workspace."
                })
        return attrs

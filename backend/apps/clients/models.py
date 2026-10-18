from django.db import models
from django.db.models import UniqueConstraint, Q

from apps.workspaces.models import Workspace
from core.models import TimestampedModel
from core.models.base import SoftDeleteQuerySet, SoftDeleteManager


class ClientQuerySet(SoftDeleteQuerySet):
    def visible_to(self, user):
        if not user:
            return self.none()
        return self.filter(
            workspace__memberships__user=user,
            workspace__memberships__is_active=True,
            workspace__memberships__is_deleted=False,
            is_deleted=False,
        ).distinct()


class Client(TimestampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="clients")
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    thumbnail = models.ImageField(null=True, blank=True, upload_to="clients/")

    objects = SoftDeleteManager.from_queryset(ClientQuerySet)()

    class Meta:
        ordering = ("name",)
        constraints = [
            UniqueConstraint(
                fields=["workspace", "name"],
                condition=Q(is_deleted=False),
                name="unique_client_name_per_workspace",
            )
        ]

    def __str__(self):
        return self.name